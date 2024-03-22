/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <stddef.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include "jemalloc.h"
#include "util/array_field.h"
#include "util/auto_free.h"
#include "util/svector.h"
#include "selva_error.h"
#include "selva_io.h"
#include "selva_log.h"
#include "selva_server.h"
#include "selva_db.h"
#include "comparator.h"
#include "hierarchy.h"
#include "schema.h"
#include "selva_object.h"
#include "subscriptions.h"
#include "edge.h"

#define EDGE_QP(T, F, S, ...) \
    STATIC_IF(IS_POINTER_CONST((S)), \
              (T const *) (F) ((S) __VA_OPT__(,) __VA_ARGS__), \
              (T *) (F) ((S) __VA_OPT__(,) __VA_ARGS__))

static void clear_all_fields(struct SelvaHierarchy *hierarchy, struct SelvaHierarchyNode *node);
static void EdgeField_Reply(struct selva_server_response_out *resp, void *p);
static void EdgeField_Free(void *p);
static size_t EdgeField_Len(void *p);
static void *EdgeField_Load(struct selva_io *io, int encver, void *data);
static void EdgeField_Save(struct selva_io *io, void *value, void *data);

static const struct SelvaObjectPointerOpts obj_opts = {
    .ptr_type_id = SELVA_OBJECT_POINTER_EDGE,
    .ptr_reply = EdgeField_Reply,
    .ptr_free = EdgeField_Free,
    .ptr_len = EdgeField_Len,
    .ptr_save = EdgeField_Save,
    .ptr_load = EdgeField_Load,
};
SELVA_OBJECT_POINTER_OPTS(obj_opts);

static void init_node_metadata_edge(
        Selva_NodeId id __unused,
        struct SelvaHierarchyMetadata *metadata) {
    metadata->edge_fields.edges = NULL;
    metadata->edge_fields.origins = NULL;
}
SELVA_MODIFY_HIERARCHY_METADATA_CONSTRUCTOR(init_node_metadata_edge);

/**
 * Get the backwards edge field of this edge field.
 */
static struct EdgeField *get_bck_edge_field(struct EdgeField *src_edge_field, struct SelvaHierarchyNode *dst_node) {
    const struct EdgeFieldConstraint *src_constraint = src_edge_field->constraint;
    const char *bck_field_name_str = src_constraint->bck_field_name_str;
    size_t bck_field_name_len = src_constraint->bck_field_name_len;

    return Edge_GetField(dst_node, bck_field_name_str, bck_field_name_len);
}

/**
 * Get a pointer to the metadata object of an EdgeField.
 * @param edge_field is a pointer to the EdgeField.
 * @param create if set the object will be created if it didn't exist before.
 * @returns A pointer to the metadata object; Otherwise a NULL pointer is returned.
 */
static struct SelvaObject *get_field_metadata(struct EdgeField *edge_field, bool create) {
    if (!edge_field->metadata && create) {
        edge_field->metadata = SelvaObject_New();
    }

    return edge_field->metadata;
}

/**
 * Apply edge_metadata to an edge/arc.
 * Only one-way.
 */
static void apply_edge_metadata(struct SelvaObject *edge_field_metadata, const Selva_NodeId dst_node_id, struct SelvaObject *edge_metadata)
{
    int err;

    err = SelvaObject_SetObjectStr(edge_field_metadata, dst_node_id, SELVA_NODE_ID_SIZE, edge_metadata);
    if (err) {
        SELVA_LOG(SELVA_LOGL_ERR, "Failed to apply edge metadata: %s",
                  selva_strerror(err));
    }
}

static struct SelvaObject *get_edge_metadata(struct SelvaObject *edge_field_metadata, const Selva_NodeId dst_node_id) {
    struct SelvaObject *edge_metadata = NULL;
    int err;

    err = SelvaObject_GetObjectStr(edge_field_metadata, dst_node_id, SELVA_NODE_ID_SIZE, &edge_metadata);
    if (err && err != SELVA_ENOENT) {
        SELVA_LOG(SELVA_LOGL_ERR, "Odd error: dst: %.*s err: %s",
                  (int)SELVA_NODE_ID_SIZE, dst_node_id,
                  selva_strerror(err));
    }

    return (err) ? NULL : edge_metadata;
}

/**
 * Delete metadata for an edge/arc.
 * Only one-way.
 */
static void del_edge_metadata(struct SelvaObject *edge_field_metadata, const Selva_NodeId dst_node_id)
{
    (void)SelvaObject_DelKeyStr(edge_field_metadata, dst_node_id, SELVA_NODE_ID_SIZE);
}

/**
 * Delete arc and its metadata.
 * Only one-way.
 */
static void remove_arc(struct EdgeField *edge_field, const Selva_NodeId node_id) {
    if (edge_field->constraint->flags & EDGE_FIELD_CONSTRAINT_FLAG_ARRAY) {
        struct SVector *arcs = &edge_field->arcs;
        struct SVectorIterator it;
        size_t i = 0;

        SVector_ForeachBegin(&it, arcs);
        while (!SVector_Done(&it)) {
            struct SelvaHierarchyNode *dst = SVector_Foreach(&it);
            Selva_NodeId dst_id;

            SelvaHierarchy_GetNodeId(dst_id, dst);
            if (!memcmp(dst_id, node_id, SELVA_NODE_ID_SIZE)) {
                SVector_RemoveIndex(arcs, i);
                goto finish;
            }
            i++;
        }
        return; /* not found. */
    } else {
        /*
         * This works even in RB mode because we know this SVector uses
         * SelvaSVectorComparator_Node and the deletion happens by comparison.
         */
        (void)SVector_Remove(&edge_field->arcs, (void *)node_id);

    }

finish:
    if (edge_field->metadata) {
        del_edge_metadata(edge_field->metadata, node_id);
    }
}

static void deinit_node_metadata_edge(
        SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        struct SelvaHierarchyMetadata *metadata) {
    struct SelvaObject *origins;
    struct SelvaObject *edges;

    /*
     * Remove the edges pointing to this node.
     */
    origins = metadata->edge_fields.origins;
    if (origins) {
        void *obj_it;
        SVector *edge_fields;
        const char *src_node_id;

        obj_it = SelvaObject_ForeachBegin(origins);
        while ((edge_fields = SelvaObject_ForeachValue(origins, &obj_it, &src_node_id, SELVA_OBJECT_ARRAY))) {
            struct SVectorIterator vec_it;
            struct EdgeField *src_field;

            /*
             * Delete each edge connecting to this node.
             */
            SVector_ForeachBegin(&vec_it, edge_fields);
            while ((src_field = SVector_Foreach(&vec_it))) {
                Selva_NodeId node_id;

                SelvaHierarchy_GetNodeId(node_id, node);
                remove_arc(src_field, node_id);
            }
        }

        SelvaObject_Destroy(metadata->edge_fields.origins);
        metadata->edge_fields.origins = NULL;
    }

    /*
     * Remove the edges pointing from this node to other nodes.
     */
    edges = metadata->edge_fields.edges;
    if (edges) {
        clear_all_fields(hierarchy, node);
        SelvaObject_Destroy(edges);
        metadata->edge_fields.edges = NULL;
    }
}
SELVA_MODIFY_HIERARCHY_METADATA_DESTRUCTOR(deinit_node_metadata_edge);

/**
 * Allocate a new EdgeField struct and initialize it.
 */
__attribute__((nonnull (1, 2))) static struct EdgeField *alloc_EdgeField(
        const Selva_NodeId src_node_id,
        const struct EdgeFieldConstraint *constraint,
        size_t initial_size) {
    struct EdgeField *edgeField;

    assert(constraint);

    edgeField = selva_calloc(1, sizeof(struct EdgeField));
    edgeField->constraint = constraint;
    memcpy(edgeField->src_node_id, src_node_id, SELVA_NODE_ID_SIZE);
    SVector_Init(&edgeField->arcs, initial_size,
                 (constraint->flags & EDGE_FIELD_CONSTRAINT_FLAG_ARRAY) ? NULL : SelvaSVectorComparator_Node);

    return edgeField;
}

static struct SelvaObject *get_edges(const struct SelvaHierarchyNode *node) {
    const struct SelvaHierarchyMetadata *metadata;
    struct SelvaObject *edges;

    /* Some callers expect that src_node can be NULL. */
    if (!node) {
        return NULL;
    }

    /*
     * The edges object is allocated lazily so the called might need to allocate it.
     */
    metadata = SelvaHierarchy_GetNodeMetadataByPtr(node);
    edges = metadata->edge_fields.edges;

    return edges;
}

#define get_edges(NODE) \
    EDGE_QP(struct SelvaObject, get_edges, (NODE))

struct EdgeField *Edge_GetField(const struct SelvaHierarchyNode *src_node, const char *field_name_str, size_t field_name_len) {
    struct SelvaObject *edges;
    void *p;
    struct EdgeField *src_edge_field;
    int err;

    /* TODO This needs C23 typeof_unqual not yet supported on macOs. */
    edges = get_edges((struct SelvaHierarchyNode *)src_node);
    if (!edges) {
        return NULL;
    }

    err = SelvaObject_GetPointerStr(edges, field_name_str, field_name_len, &p);
    src_edge_field = p;

    return err ? NULL : src_edge_field;
}

static struct SelvaHierarchyNode *EdgeField_Search(const struct EdgeField *edge_field, const Selva_NodeId dst_node_id) {
    if (edge_field->constraint->flags & EDGE_FIELD_CONSTRAINT_FLAG_ARRAY) {
        struct EdgeFieldIterator it;
        struct SelvaHierarchyNode *node;

        Edge_ForeachBegin(&it, edge_field);

        while ((node = Edge_Foreach(&it))) {
            Selva_NodeId node_id;

            SelvaHierarchy_GetNodeId(node_id, node);
            if (!memcmp(node_id, dst_node_id, SELVA_NODE_ID_SIZE)) {
                return node;
            }
        }

        return NULL;
    } else {
        return SVector_Search(&edge_field->arcs, (void *)dst_node_id);
    }
}

#define EdgeField_Search(EDGE_FIELD, NODE_ID) \
    EDGE_QP(struct SelvaHierarchyNode, EdgeField_Search, (EDGE_FIELD), (NODE_ID))

int Edge_GetFieldEdgeMetadata(struct EdgeField *edge_field, const Selva_NodeId dst_node_id, bool create, struct SelvaObject **out) {
    struct SelvaHierarchyNode *dst_node;
    struct EdgeField *bck_edge_field = NULL;
    struct SelvaObject *fwd_edge_field_metadata = NULL;
    struct SelvaObject *bck_edge_field_metadata = NULL;
    struct SelvaObject *edge_metadata = NULL;

    dst_node = EdgeField_Search(edge_field, dst_node_id);
    if (!dst_node) {
        return SELVA_ENOENT;
    }

    fwd_edge_field_metadata = get_field_metadata(edge_field, create);

    /*
     * In case of a bidirectional edge field it's possible that the backwards edge
     * could already have metadata.
     */
    if (edge_field->constraint->flags & EDGE_FIELD_CONSTRAINT_FLAG_BIDIRECTIONAL) {
        bck_edge_field = get_bck_edge_field(edge_field, dst_node);
        if (bck_edge_field) {
            /* We don't want to create it yet. */
            bck_edge_field_metadata = get_field_metadata(bck_edge_field, false);
        }
    }

    if (fwd_edge_field_metadata) {
        edge_metadata = get_edge_metadata(fwd_edge_field_metadata, dst_node_id);
    }
    if (!edge_metadata && bck_edge_field_metadata) {
        /*
         * RFE will this ever return the metadata.
         */
        edge_metadata = get_edge_metadata(bck_edge_field_metadata, edge_field->src_node_id);
        apply_edge_metadata(fwd_edge_field_metadata, dst_node_id, edge_metadata);
    }
    if (!edge_metadata) {
        /*
         * Create it.
         */
        if (!create) {
            return SELVA_ENOENT;
        }

        edge_metadata = SelvaObject_New();
        apply_edge_metadata(fwd_edge_field_metadata, dst_node_id, edge_metadata);

        /*
         * Bidirectional edges must share the edge metadata.
         */
        if (edge_field->constraint->flags & EDGE_FIELD_CONSTRAINT_FLAG_BIDIRECTIONAL && bck_edge_field) {
            SelvaObject_Ref(edge_metadata);
            apply_edge_metadata(get_field_metadata(bck_edge_field, true), edge_field->src_node_id, edge_metadata);
        }
    }

    *out = edge_metadata;
    return 0;
}

/**
 * Bidirectional edge fields share the same edge/arc metadata objects
 * referenced in the metadata object of the fields at both ends. We
 * need to trackback those fields and delete the references.
 */
static void del_bidir_metadata(struct EdgeField *edge_field) {
    struct EdgeFieldIterator it;
    struct SelvaHierarchyNode *dst_node;

    Edge_ForeachBegin(&it, edge_field);
    while ((dst_node = Edge_Foreach(&it))) {
        struct EdgeField *bck_edge_field;

        bck_edge_field = get_bck_edge_field(edge_field, dst_node);
        if (bck_edge_field && bck_edge_field->metadata) {
            /*
             * This will delete the key and deref the actual object.
             */
            del_edge_metadata(bck_edge_field->metadata, edge_field->src_node_id);
        }
    }
}

void Edge_DeleteFieldMetadata(struct EdgeField *edge_field) {
    if (edge_field->constraint->flags & EDGE_FIELD_CONSTRAINT_FLAG_BIDIRECTIONAL) {
        del_bidir_metadata(edge_field);
    }

    SelvaObject_Destroy(edge_field->metadata);
}

/**
 * Create a new edge field and store it on the hierarchy node.
 */
__attribute__((nonnull (1, 4))) static struct EdgeField *Edge_NewField(
        struct SelvaHierarchyNode *node,
        const char *field_name_str,
        size_t field_name_len,
        const struct EdgeFieldConstraint *constraint) {
    Selva_NodeId node_id;
    struct SelvaHierarchyMetadata *node_metadata;
    struct SelvaObject *edges;
    struct EdgeField *edge_field;

    SelvaHierarchy_GetNodeId(node_id, node);
    node_metadata = SelvaHierarchy_GetNodeMetadataByPtr(node);

    edges = node_metadata->edge_fields.edges;
    if (!edges) {
        edges = SelvaObject_New();
        node_metadata->edge_fields.edges = edges;
    }

    edge_field = alloc_EdgeField(node_id, constraint, 0);
    if (!edge_field) {
        /* Just leave the edges obj there as it's already properly initialized. */
        return NULL;
    }

    SelvaObject_SetPointerStr(edges, field_name_str, field_name_len, edge_field, &obj_opts);

    return edge_field;
}

static struct SelvaObject *upsert_origins(struct SelvaHierarchyNode *node) {
    struct SelvaHierarchyMetadata *node_metadata;

    /*
     * Add origin reference.
     * Note that we must ensure that this insertion is only ever done once.
     */
    node_metadata = SelvaHierarchy_GetNodeMetadataByPtr(node);

    if (!node_metadata->edge_fields.origins) {
        /* The edge origin refs struct is initialized lazily. */
        node_metadata->edge_fields.origins = SelvaObject_New();
    }

    return node_metadata->edge_fields.origins;
}

/**
 * Insert an edge.
 * The edge must not exist before calling this function because this
 * function doesn't perform any checks.
 */
static void insert_edge(struct EdgeField *src_edge_field, struct SelvaHierarchyNode *dst_node) {
    int err;

    /*
     *  Insert the hierarchy node to the edge field.
     */
    SVector_Insert(&src_edge_field->arcs, dst_node);

    /*
     * Add origin reference.
     * Note that we must ensure that this insertion is only ever done once.
     */
    err = SelvaObject_InsertArrayStr(upsert_origins(dst_node),
                                    src_edge_field->src_node_id, SELVA_NODE_ID_SIZE,
                                    SELVA_OBJECT_POINTER, src_edge_field);
    if (err) {
        SELVA_LOG(SELVA_LOGL_ERR, "Edge origin update failed: %s",
                  selva_strerror(err));
        abort();
    }
}

/**
 * Insert dst_node into an index.
 * @param index >= 0 index from first; < 0 index from last.
 */
static int insert_edge_index(struct EdgeField * restrict src_edge_field, struct SelvaHierarchyNode * restrict dst_node, ssize_t index) {
    size_t i;
    int err;

    i = vec_idx_to_abs(&src_edge_field->arcs, index);

    /*
     * Creating gaps is not allowed.
     */
    if (i > SVector_Size(&src_edge_field->arcs)) {
        return SELVA_EINVAL;
    }

    SVector_InsertIndex(&src_edge_field->arcs, i, dst_node);

    err = SelvaObject_InsertArrayStr(upsert_origins(dst_node),
                                    src_edge_field->src_node_id, SELVA_NODE_ID_SIZE,
                                    SELVA_OBJECT_POINTER, src_edge_field);
    if (err) {
        SELVA_LOG(SELVA_LOGL_ERR, "Edge origin update failed: %s",
                  selva_strerror(err));
        abort();
    }

    return 0;
}

/**
 * Get an existing edge_field from node or create a new one.
 */
static int get_or_create_EdgeField(
        const struct EdgeFieldConstraints *constraints,
        struct SelvaHierarchyNode *node,
        const char *field_name_str,
        size_t field_name_len,
        struct EdgeField **out) {
    Selva_NodeType node_type;
    struct EdgeField *edge_field;

    SelvaHierarchy_GetNodeType(node_type, node);

    edge_field = Edge_GetField(node, field_name_str, field_name_len);
    if (!edge_field) {
        const struct EdgeFieldConstraint *constraint;

        constraint = Edge_GetConstraint(constraints, node_type, field_name_str, field_name_len);
        if (!constraint) {
            return SELVA_EINVAL;
        }

        edge_field = Edge_NewField(node, field_name_str, field_name_len, constraint);
        if (!edge_field) {
            return SELVA_ENOMEM;
        }
    }

    *out = edge_field;
    return 0;
}

int Edge_Usage(const struct SelvaHierarchyNode *node) {
    const struct EdgeFieldContainer *efc = &SelvaHierarchy_GetNodeMetadataByPtr(node)->edge_fields;
    int res = 0;

    if (efc->edges && SelvaObject_Len(efc->edges, NULL) > 0) {
        res |= 1;
    }

    if (efc->origins && SelvaObject_Len(efc->origins, NULL) > 0) {
        res |= 2;
    }

    return res;
}

int Edge_Has(const struct EdgeField *edge_field, struct SelvaHierarchyNode *dst_node) {

    Selva_NodeId node_id;

    SelvaHierarchy_GetNodeId(node_id, dst_node);
    return !!EdgeField_Search(edge_field, node_id);
}

int Edge_HasNodeId(const struct EdgeField *edge_field, const Selva_NodeId dst_node_id) {
    Selva_NodeId node_id;

    memcpy(node_id, dst_node_id, SELVA_NODE_ID_SIZE);
    return !!EdgeField_Search(edge_field, node_id);
}

int Edge_DerefSingleRef(const struct EdgeField *edge_field, struct SelvaHierarchyNode **node_out) {
    const struct EdgeFieldConstraint *constraint = edge_field->constraint;
    struct SelvaHierarchyNode *node;

    assert(constraint);
    if (!(constraint->flags & EDGE_FIELD_CONSTRAINT_FLAG_SINGLE_REF)) {
        return SELVA_EINTYPE; /* Not a single ref. */
    }

    node = SVector_GetIndex(&edge_field->arcs, 0);
    if (!node) {
        return SELVA_ENOENT;
    }

    if (node_out) {
        *node_out = node;
    }
    return 0;
}

int Edge_Add(
        struct SelvaHierarchy *hierarchy,
        const char *field_name_str,
        size_t field_name_len,
        struct SelvaHierarchyNode *src_node,
        struct SelvaHierarchyNode *dst_node)
{
    return Edge_AddIndex(hierarchy, field_name_str, field_name_len, src_node, dst_node, -1);
}

/* RFE Optimize by taking edgeField as an arg. */
int Edge_AddIndex(
        struct SelvaHierarchy *hierarchy,
        const char *field_name_str,
        size_t field_name_len,
        struct SelvaHierarchyNode *src_node,
        struct SelvaHierarchyNode *dst_node,
        ssize_t index) {
    Selva_NodeId src_node_id;
    const struct EdgeFieldConstraints *constraints;
    const struct EdgeFieldConstraint *constraint;
    enum EdgeFieldConstraintFlag constraint_flags;
    struct EdgeField *src_edge_field = NULL;
    int err;

    SelvaHierarchy_GetNodeId(src_node_id, src_node);
    constraints = &SelvaSchema_FindNodeSchema(hierarchy, src_node_id)->efc;

    /*
     * Get src_edge_field
     */
    err = get_or_create_EdgeField(constraints, src_node, field_name_str, field_name_len, &src_edge_field);
    if (err) {
        return err;
    }
    assert(src_edge_field);

    if (Edge_Has(src_edge_field, dst_node)) {
        return SELVA_EEXIST;
    }

    constraint = src_edge_field->constraint;
    assert(constraint); /* A constraint should be always set. */
    constraint_flags = constraint->flags;

    /*
     * Single reference edge constraint.
     */
    if (constraint_flags & EDGE_FIELD_CONSTRAINT_FLAG_SINGLE_REF) {
        int res;

        /*
         * Single ref shouldn't have EDGE_FIELD_CONSTRAINT_FLAG_ARRAY set
         * but this ensures that we'll never even need to check it.
         */
        index = -1;

        /*
         * single_ref allows only one edge to exist in the field.
         */
        res = Edge_ClearField(hierarchy, src_node, field_name_str, field_name_len);
        if (res < 0) {
            return res;
        }
    }

    if (index != -1 && (constraint->flags & EDGE_FIELD_CONSTRAINT_FLAG_ARRAY)) {
        err = insert_edge_index(src_edge_field, dst_node, index);
        if (err) {
            return err;
        }
    } else {
        insert_edge(src_edge_field, dst_node);
    }

    err = 0; /* Just to be sure. */

    /*
     * Bidirectional edge constraint.
     */
    if (constraint_flags & EDGE_FIELD_CONSTRAINT_FLAG_BIDIRECTIONAL) {
        /*
         * This field is bidirectional and so we need to create an edge pointing back.
         */
        err = Edge_AddIndex(hierarchy, constraint->bck_field_name_str, constraint->bck_field_name_len,
                       dst_node, src_node, -1);
        if (err && err != SELVA_EEXIST) {
            Selva_NodeId dst_node_id;
            int err1; /* We must retain the original err. */

            /*
             * Ok so, this is a bit dumb but we break an infinite loop by
             * ignoring SELVA_EEXIST. It's terribly inefficient to attempt to
             * create the same edge again just to figure that both ends were
             * created already. This implementation also practically allows
             * multidirectional edges between two nodes.
             * The normal flow should be like this:
             * Edge_Add(src, dst) -> Edge_Add(dst, src) -> Edge_Add(src, dst) => SELVA_EEXIST
             */
            SELVA_LOG(SELVA_LOGL_ERR,
                      "An error occurred while creating a bidirectional edge: %s",
                      selva_strerror(err));

            /*
             * In case of an error we can't actually rollback anymore but we can
             * delete the edge we just created, perhaps it's still better than
             * leaving a half-broken bidir edge.
             * Surely this can fail too if we are OOMing.
             */
            SelvaHierarchy_GetNodeId(dst_node_id, dst_node);
            err1 = Edge_Delete(hierarchy, src_edge_field, src_node, dst_node_id);
            if (err1 && err1 != SELVA_ENOENT) {
                SELVA_LOG(SELVA_LOGL_ERR,
                          "Failed to remove the broken edge: %s",
                          selva_strerror(err1));
            }
        } else {
            /* We don't want to leak the SELVA_EEXIST. */
            err = 0;
        }
    }

    SelvaSubscriptions_InheritEdge(hierarchy, src_node, dst_node, field_name_str, field_name_len);
    SelvaSubscriptions_DeferFieldChangeEvents(hierarchy, src_node, field_name_str, field_name_len);

    return err;
}

static ssize_t edge_field_array_search_index(struct EdgeField *edge_field, const Selva_NodeId dst_node_id) {
  struct EdgeFieldIterator it;
  struct SelvaHierarchyNode *node;
  size_t i = 0;

  Edge_ForeachBegin(&it, edge_field);

  while ((node = Edge_Foreach(&it))) {
      Selva_NodeId node_id;

      SelvaHierarchy_GetNodeId(node_id, node);
      if (!memcmp(node_id, dst_node_id, SELVA_NODE_ID_SIZE)) {
          return i;
      }
      i++;
  }

  return -1;
}

int Edge_Move(
        struct EdgeField *edge_field,
        const Selva_NodeId dst_node_id,
        size_t index) {
    ssize_t old_index;
    struct SelvaHierarchyNode *dst_node;

    if (!(edge_field->constraint->flags & EDGE_FIELD_CONSTRAINT_FLAG_ARRAY)) {
        return SELVA_ENOTSUP;
    }

    if (index >= Edge_GetFieldLength(edge_field)) {
        return SELVA_EINVAL;
    }

    old_index = edge_field_array_search_index(edge_field, (void *)dst_node_id);
    if (old_index == -1) {
        return SELVA_ENOENT;
    } else if ((size_t)old_index == index) {
        return 0;
    }
    dst_node = SVector_RemoveIndex(&edge_field->arcs, old_index);
    if (!dst_node) {
        return SELVA_ENOENT;
    }

    SVector_InsertIndex(&edge_field->arcs, index, dst_node);

    return 0;
}

/*
 * Remove origin references to src_edge_field from dst_node.
 * Origin references are needed to know the origin of an edge. This allows
 * things like removing edges from both ways.
 * This function should be only called when an edge is being deleted.
 */
static int remove_origin_ref(struct EdgeField *src_edge_field, struct SelvaHierarchyNode *dst_node) {
    struct SelvaHierarchyMetadata *dst_metadata;
    enum SelvaObjectType out_subtype;
    SVector *origin_fields; /* type: struct EdgeField */
    int err;

    dst_metadata = SelvaHierarchy_GetNodeMetadataByPtr(dst_node);
    err = SelvaObject_GetArrayStr(dst_metadata->edge_fields.origins, src_edge_field->src_node_id, SELVA_NODE_ID_SIZE, &out_subtype, &origin_fields);
    if (err) {
        return err;
    }
    if (out_subtype != SELVA_OBJECT_POINTER) {
        return SELVA_EINTYPE;
    }

    /*
     * Delete the edge origin reference from the destination.
     * The same origin node might point dst_node from multiple edge fields.
     */
    if (SVector_Size(origin_fields) == 1) {
        /*
         * We assume that the only remaining origin field reference is
         * edge_field, as it should be so if all the ref counting is done
         * correctly.
         */
        SelvaObject_DelKeyStr(dst_metadata->edge_fields.origins, src_edge_field->src_node_id, SELVA_NODE_ID_SIZE);
    } else {
        /* Otherwise remove the specific edge_field from the origin_fields SVector. */
        ssize_t i;

        i = SVector_SearchIndex(origin_fields, src_edge_field);
        if (i != -1) {
            SVector_RemoveIndex(origin_fields, i);
        }
    }

    return 0;
}

int Edge_Delete(
        struct SelvaHierarchy *hierarchy,
        struct EdgeField *edge_field,
        struct SelvaHierarchyNode *src_node,
        const Selva_NodeId dst_node_id) {
    Selva_NodeId src_node_id;
    struct SelvaHierarchyNode *dst_node;
    const struct EdgeFieldConstraint *src_constraint;
    int err;

    SelvaHierarchy_GetNodeId(src_node_id, src_node);
    dst_node = EdgeField_Search(edge_field, dst_node_id);
    if (!dst_node) {
        return SELVA_ENOENT;
    }

    SelvaSubscriptions_ClearAllMarkers(hierarchy, src_node);

    /*
     * Reference to the origin can be deleted now.
     */
    err = remove_origin_ref(edge_field, dst_node);
    if (err) {
        return err;
    }

    /*
     * Delete the edge.
     */
    remove_arc(edge_field, dst_node_id);

    /*
     * For bidirectional edge fields we need to also remove the edge directed
     * back to src_node from dst_node.
     */
    src_constraint = edge_field->constraint;
    assert(src_constraint);
    if (src_constraint->flags & EDGE_FIELD_CONSTRAINT_FLAG_BIDIRECTIONAL) {
        struct EdgeField *bck_edge_field;

        bck_edge_field = get_bck_edge_field(edge_field, dst_node);
        if (bck_edge_field) {
            err = Edge_Delete(hierarchy, bck_edge_field, dst_node, src_node_id);
            if (err && err != SELVA_ENOENT) {
                SELVA_LOG(SELVA_LOGL_ERR, "Failed to to remove a backwards edge of a bidirectional edge field: %s", selva_strerror(err));
            }
        }
    }

    return 0;
}

/**
 * Delete all edges of edge_field.
 * @returns the number of edges deleted.
 */
static int clear_field(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *src_node,
        struct EdgeField *edge_field) {
    SVECTOR_AUTOFREE(arcs);
    struct SVectorIterator it;
    const struct SelvaHierarchyNode *dst_node;
    int err = 0, err_bck = 0;

    if (!Edge_CloneArcs(&arcs, edge_field)) {
        return SELVA_EGENERAL;
    }

    SVector_ForeachBegin(&it, &arcs);
    while ((dst_node = SVector_Foreach(&it))) {
        Selva_NodeId dst_node_id;

        SelvaHierarchy_GetNodeId(dst_node_id, dst_node);
        err = Edge_Delete(
                hierarchy,
                edge_field,
                src_node,
                dst_node_id);
        if (err) {
            Selva_NodeId src_node_id;

            SelvaHierarchy_GetNodeId(src_node_id, src_node);
            SELVA_LOG(SELVA_LOGL_ERR, "Unable to delete an edge %.*s (edge_field: %p) -> %.*s: %s",
                      (int)SELVA_NODE_ID_SIZE, src_node_id,
                      edge_field,
                      (int)SELVA_NODE_ID_SIZE, dst_node_id,
                      selva_strerror(err));
            err_bck = err;
        }
    }

    /* Return only the last error. */
    return err_bck ? err_bck : (int)SVector_Size(&arcs);
}

static void _clear_all_fields(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        struct SelvaObject *obj) {
    SelvaObject_Iterator *it;
    const char *name;
    enum SelvaObjectType type;
    void *p;

    it = SelvaObject_ForeachBegin(obj);
    while ((p = SelvaObject_ForeachValueType(obj, &it, &name, &type))) {
        if (type == SELVA_OBJECT_POINTER) {
            /* The pointer value is a pointer to an edge_field. */
            /* RFE Presumably we can get away with any errors? */
            (void)clear_field(hierarchy, node, p);
        } else if (type == SELVA_OBJECT_OBJECT) {
            _clear_all_fields(hierarchy, node, p);
        } else if (type == SELVA_OBJECT_ARRAY) {
            struct SVector *array = p;
            enum SelvaObjectType subtype;

            if (SelvaObject_GetArrayStr(obj, name, strlen(name), &subtype, NULL)) {
                SELVA_LOG(SELVA_LOGL_ERR, "Failed to read the subtype of an edges array: \"%s\"", name);
                continue;
            }

            if (subtype == SELVA_OBJECT_POINTER) {
                struct SVectorIterator sub_it;
                void *efield_p;

                SVector_ForeachBegin(&sub_it, array);
                while ((efield_p = SVector_Foreach(&sub_it))) {
                    /* The pointer value is a pointer to an edge_field. */
                    /* RFE Presumably we can get away with any errors? */
                    (void)clear_field(hierarchy, node, efield_p);
                }
            } else if (subtype == SELVA_OBJECT_OBJECT) {
                struct SVectorIterator sub_it;
                void *arr_obj;

                SVector_ForeachBegin(&sub_it, array);
                while ((arr_obj = SVector_Foreach(&sub_it))) {
                    _clear_all_fields(hierarchy, node, arr_obj);
                }
            } else {
                SELVA_LOG(SELVA_LOGL_ERR, "Unsupported subtype for an array in edges: %s key: \"%s\"",
                          SelvaObject_Type2String(subtype, NULL),
                          name);
            }
        } else {
            SELVA_LOG(SELVA_LOGL_ERR, "Unsupported value type in an edges object: %s key: \"%s\"",
                      SelvaObject_Type2String(type, NULL),
                      name);
        }
    }
}

/**
 * Clear all edge fields of node.
 */
static void clear_all_fields(struct SelvaHierarchy *hierarchy, struct SelvaHierarchyNode *node) {
    struct SelvaObject *edges = SelvaHierarchy_GetNodeMetadataByPtr(node)->edge_fields.edges;

    if (edges) {
        _clear_all_fields(hierarchy, node, edges);
    }
}

int Edge_ClearField(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *src_node,
        const char *field_name_str,
        size_t field_name_len) {
    struct EdgeField *src_edge_field;

    if (!src_node) {
        return SELVA_ENOENT;
    }

    src_edge_field = Edge_GetField(src_node, field_name_str, field_name_len);
    if (!src_edge_field) {
        return SELVA_ENOENT;
    }

    return clear_field(hierarchy, src_node, src_edge_field);
}

static int delete_field(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *src_node,
        const char *field_name_str,
        size_t field_name_len,
        struct EdgeField *src_edge_field) {
    struct SelvaObject *edges;
    int res, err;

    /*
     * The field should be empty before its deleted from the edges object
     * because EdgeField_Free() can't call clear_field().
     */
    res = clear_field(hierarchy, src_node, src_edge_field);
    if (res < 0) {
        return res;
    }

    edges = SelvaHierarchy_GetNodeMetadataByPtr(src_node)->edge_fields.edges;
    if (!edges) {
        return SELVA_ENOENT;
    }

    /*
     * Doing this will cause a full cleanup of the edges and origin pointers (EdgeField_Free()).
     */
    err = SelvaObject_DelKeyStr(edges, field_name_str, field_name_len);
    if (err) {
        SELVA_LOG(SELVA_LOGL_ERR, "Failed to delete the edge field (\"%.*s\"): %s",
                  (int)field_name_len, field_name_str,
                  selva_strerror(err));
    }

    return 0;
}

int Edge_DeleteField(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *src_node,
        const char *field_name_str,
        size_t field_name_len) {
    struct EdgeField *src_edge_field;

    src_edge_field = Edge_GetField(src_node, field_name_str, field_name_len);
    if (!src_edge_field) {
        return SELVA_ENOENT;
    }

    return delete_field(hierarchy, src_node, field_name_str, field_name_len, src_edge_field);
}

int Edge_DeleteAll(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *src_node,
        const char *field_name_str,
        size_t field_name_len) {
    struct SelvaObject *edges;
    struct SelvaObjectAny any;
    int err;

    edges = get_edges(src_node);
    if (!edges) {
        return SELVA_ENOENT;
    }

    err = SelvaObject_GetAnyStr(edges, field_name_str, field_name_len, &any);
    if (err) {
        return err;
    }

    if (any.type == SELVA_OBJECT_POINTER) {
        struct EdgeField *src_edge_field = any.p;

        if (!src_edge_field) {
            return SELVA_ENOENT;
        }

        /*
         * A pointer in edges is always an edge field.
         */
        return delete_field(hierarchy, src_node, field_name_str, field_name_len, src_edge_field);
    } else if (any.type == SELVA_OBJECT_OBJECT) {
        SelvaObject_Iterator *it;
        const char *key_str;

        it = SelvaObject_ForeachBegin(any.obj);
        while ((key_str = SelvaObject_ForeachKey(any.obj, &it))) {
            const size_t key_len = strlen(key_str);
            const size_t slen = field_name_len + key_len + 1;
            char s[slen + 1];

            snprintf(s, slen + 1, "%.*s.%.*s",
                     (int)field_name_len, field_name_str,
                     (int)key_len, key_str);

            /* recurse */
            err = Edge_DeleteAll(hierarchy, src_node, s, slen);
            if (err < 0) {
                /* RFE Should we delete all we can? */
                return err;
            }

            /* Now we should be able to delete this field safely. */
            err = SelvaObject_DelKeyStr(edges, field_name_str, field_name_len);
            if (err) {
                return err;
            }
        }
    } else if (any.type == SELVA_OBJECT_ARRAY) {
        /* An array of edges is not supported and shouldn't be here. */
        return SELVA_EINTYPE;
    } else {
        /* Shouldn't happen? */
        return SELVA_EINTYPE;
    }

    return 0;
}

size_t Edge_Refcount(const struct SelvaHierarchyNode *node) {
    const struct SelvaHierarchyMetadata *metadata;
    size_t refcount = 0;

    metadata = SelvaHierarchy_GetNodeMetadataByPtr(node);

    if (metadata->edge_fields.origins) {
        refcount = SelvaObject_Len(metadata->edge_fields.origins, NULL);
    }

    return refcount;
}

static void EdgeField_Reply(struct selva_server_response_out *resp, void *p) {
    const struct EdgeField *edge_field = (struct EdgeField *)p;
    const struct SelvaHierarchyNode *dst_node;
    struct EdgeFieldIterator it;

    selva_send_array(resp, Edge_GetFieldLength(edge_field));

    Edge_ForeachBegin(&it, edge_field);
    while ((dst_node = Edge_Foreach(&it))) {
        Selva_NodeId dst_node_id;

        SelvaHierarchy_GetNodeId(dst_node_id, dst_node);
        selva_send_str(resp, dst_node_id, Selva_NodeIdLen(dst_node_id));
    }
}

void replyWithEdgeField(struct selva_server_response_out *resp, struct EdgeField *edge_field) {
    EdgeField_Reply(resp, edge_field);
}

/**
 * Used by SelvaObject.
 */
static void EdgeField_Free(void *p) {
    struct EdgeField *edge_field = (struct EdgeField *)p;

    /*
     * We don't need to call clear_field() here if we manage to always call it
     * before this function is called, and thus we avoid passing the context.
     */
#if 0
    clear_field(ctx, hierarchy, node, edge_field);
#endif
    SVector_Destroy(&edge_field->arcs);
    Edge_DeleteFieldMetadata(edge_field);
    selva_free(p);
}

/**
 * Used by SelvaObject.
 */
static size_t EdgeField_Len(void *p) {
    const struct EdgeField *edge_field = (struct EdgeField *)p;

    return Edge_GetFieldLength(edge_field);
}

/**
 * Context for loading edges objects.
 */
struct EdgeField_load_data {
    struct SelvaHierarchy *hierarchy;
    struct SelvaHierarchyNode *src_node;
};

/*
 * A custom SelvaObject pointer loader for EdgeFields.
 * Storage format: [
 *   nr_edges,
 *   dst_id...
 * ]
 */
static void *EdgeField_Load(struct selva_io *io, __unused int encver __unused, void *p) {
    struct EdgeField_load_data *load_data = (struct EdgeField_load_data *)p;
    struct SelvaHierarchy *hierarchy = load_data->hierarchy;
    Selva_NodeId src_node_id;
    const struct EdgeFieldConstraint *constraint;
    size_t nr_edges;
    struct EdgeField *edge_field;

    /*
     * Constraint.
     */
    __selva_autofree const char *node_type = NULL;
    __selva_autofree const char *field_name_str = NULL;
    size_t field_name_len;

    node_type = selva_io_load_str(io, NULL);
    field_name_str = selva_io_load_str(io, &field_name_len);
    struct EdgeFieldConstraints *constraints = &SelvaSchema_FindNodeSchema(hierarchy, src_node_id)->efc;
    constraint = Edge_GetConstraint(constraints, node_type, field_name_str, field_name_len);

    if (!constraint) {
        SELVA_LOG(SELVA_LOGL_CRIT, "Constraint not found");
        return NULL;
    }

    nr_edges = selva_io_load_unsigned(io);

    SelvaHierarchy_GetNodeId(src_node_id, load_data->src_node);
    edge_field = alloc_EdgeField(src_node_id, constraint, nr_edges);
    if (!edge_field) {
        return NULL;
    }

    /*
     * Edges/arcs.
     */
    for (size_t i = 0; i < nr_edges; i++) {
        Selva_NodeId dst_id;
        struct SelvaHierarchyNode *dst_node;
        int err;

        selva_io_load_str_fixed(io, dst_id, SELVA_NODE_ID_SIZE);

        /*
         * Ensure that the destination node exist before creating an edge.
         */
        err = SelvaHierarchy_UpsertNode(hierarchy, dst_id, &dst_node);
        if (err < 0 && err != SELVA_HIERARCHY_EEXIST) {
            SELVA_LOG(SELVA_LOGL_CRIT, "Upserting node %.*s failed: %s",
                      (int)SELVA_NODE_ID_SIZE, dst_id,
                      selva_strerror(err));
            return NULL;
        }

        insert_edge(edge_field, dst_node);
    }

    /*
     * Field metadata.
     * [dst_id] = obj
     */
    edge_field->metadata = SelvaObjectTypeLoad2(io, encver, NULL);

    if (edge_field->metadata && constraint->flags & EDGE_FIELD_CONSTRAINT_FLAG_BIDIRECTIONAL) {
        SelvaObject_Iterator *obj_it;
        const char *dst_id_str;
        struct EdgeField *bck_edge_field;

        obj_it = SelvaObject_ForeachBegin(edge_field->metadata);
        while ((dst_id_str = SelvaObject_ForeachKey(edge_field->metadata, &obj_it))) {
            Selva_NodeId dst_node_id;
            struct SelvaHierarchyNode *dst_node;

            Selva_NodeIdCpy(dst_node_id, dst_id_str);
            dst_node = SelvaHierarchy_FindNode(hierarchy, dst_node_id);
            assert(dst_node);

            /*
             * Check if a shared edge_metadata is already created and
             * should be shared.
             */
            bck_edge_field = get_bck_edge_field(edge_field, dst_node);
            if (bck_edge_field) {
                struct SelvaObject *bck_edge_field_metadata;
                struct SelvaObject *bck_edge_metadata;

                /*
                 * We don't create it because it will be created later when the
                 * dst_node is actually loaded. This way we don't need to Merge
                 * two objects later.
                 */
                bck_edge_field_metadata = get_field_metadata(bck_edge_field, false);
                bck_edge_metadata = (bck_edge_field_metadata) ? get_edge_metadata(bck_edge_field_metadata, src_node_id) : NULL;
                if (bck_edge_metadata) {
                    /*
                     * Share previously loaded edge/arc metadata.
                     * We assume that if it wasn't in dst_node yet then dst_node
                     * will be loaded later and it will share edge_metadata
                     * stored in our edge_field_metadata. The following apply
                     * will now free our copy, so that we have only one copy
                     * in memory.
                     */
                    SelvaObject_Ref(bck_edge_metadata);
                    apply_edge_metadata(edge_field->metadata, dst_node_id, bck_edge_metadata);
                }
            }
        }
    }

    return edge_field;
}

int Edge_Load(struct selva_io *io, int encver, SelvaHierarchy *hierarchy, struct SelvaHierarchyNode *node) {
    struct SelvaHierarchyMetadata *metadata;

    metadata = SelvaHierarchy_GetNodeMetadataByPtr(node);

    /*
     * We use the SelvaObject loader to load the object which will then
     * call EdgeField_Load for each field stored in the object to
     * initialize the actual EdgeField structures.
     */
    metadata->edge_fields.edges = SelvaObjectTypeLoad2(io, encver, &(struct EdgeField_load_data){
        .hierarchy = hierarchy,
        .src_node = node,
    });

    return 0;
}

/**
 * Custom save function for saving EdgeFields.
 */
static void EdgeField_Save(struct selva_io *io, void *value, __unused void *save_data) {
    const struct EdgeField *edge_field = (struct EdgeField *)value;
    const struct EdgeFieldConstraint *constraint = edge_field->constraint;
    struct EdgeFieldIterator edge_it;
    const struct SelvaHierarchyNode *dst_node;

    /*
     * Constraint.
     */
    selva_io_save_str(io, constraint->src_node_type, SELVA_NODE_TYPE_SIZE);
    selva_io_save_str(io, constraint->field_name_str, constraint->field_name_len);

    /*
     * Edges/arcs.
     */
    selva_io_save_unsigned(io, Edge_GetFieldLength(edge_field));
    Edge_ForeachBegin(&edge_it, edge_field);
    while ((dst_node = Edge_Foreach(&edge_it))) {
        Selva_NodeId dst_node_id;

        SelvaHierarchy_GetNodeId(dst_node_id, dst_node);
        selva_io_save_str(io, dst_node_id, SELVA_NODE_ID_SIZE);
    }

    /*
     * Metadata.
     */
    SelvaObjectTypeSave2(io, edge_field->metadata, NULL);
}

void Edge_Save(struct selva_io *io, struct SelvaHierarchyNode *node) {
    struct SelvaHierarchyMetadata *metadata = SelvaHierarchy_GetNodeMetadataByPtr(node);

    SelvaObjectTypeSave2(io, metadata->edge_fields.edges, NULL);
}
