/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#define SELVA_IO_TYPE
#include <alloca.h>
#include <assert.h>
#include <errno.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <time.h>
#include "jemalloc.h"
#include "util/auto_free.h"
#include "util/backoff_timeout.h"
#include "util/ctime.h"
#include "util/finalizer.h"
#include "util/ptag.h"
#include "util/selva_proto_builder.h"
#include "util/selva_string.h"
#include "util/svector.h"
#include "util/timestamp.h"
#include "sha3iuf/sha3.h"
#include "event_loop.h"
#include "selva_db.h"
#include "selva_error.h"
#include "selva_io.h"
#include "selva_log.h"
#include "selva_proto.h"
#include "selva_server.h"
#include "db_config.h"
#include "edge.h"
#include "field_lookup.h"
#include "modify.h"
#include "parsers.h"
#include "rpn.h"
#include "selva_index.h"
#include "selva_object.h"
#include "selva_onload.h"
#include "selva_set.h"
#include "selva_trace.h"
#include "subscriptions.h"
#include "traversal.h"
#include "hierarchy.h"
#include "hierarchy_detached.h"
#include "hierarchy_inactive.h"

#define IS_EXPIRED(_ts_, _now_) ((time_t)(_ts_) <= (time_t)(_now_))

/**
 * Node flags changing the node behavior.
 */
enum SelvaNodeFlags {
    /**
     * Detached node.
     * When set this is the head of a compressed subtree stored in
     * hierarchy_detached. Some information has been removed from the node
     * and the subtree must be restored to make this node usable.
     */
    SELVA_NODE_FLAGS_DETACHED = 0x01,
    /**
     * Implicitly created node.
     * Nodes that are created through child or references lists are implicit.
     * The flag should be cleared when the node is actually taken into use.
     */
    SELVA_NODE_FLAGS_IMPLICIT = 0x02,
} __packed;

/**
 * The core type of Selva hierarchy.
 */
typedef struct SelvaHierarchyNode {
    Selva_NodeId id; /* Must be first. */
    enum SelvaNodeFlags flags;
    /**
     * Expiration timestamp for this node.
     * epoch = UNIX 2023-01-01T00:00:00Z = 1672531200000 (UNIX)
     * 0 = never expires
     * As this is a 32-bit unsigned integer, it means that we should be good
     * until the year 2106.
     * 1970+(2^32)/60/60/24/365 = 2106
     */
    uint32_t expire;
    struct trx_label trx_label;
    STATIC_SELVA_OBJECT(_obj_data);
    struct SelvaHierarchyMetadata metadata;
    SVector parents;
    SVector children;
    /**
     * Children metadata.
     * Used the same way as metadata in struct EdgeField.
     * Only parent has metadata as it's easy enough to find this object
     * anyway.
     */
    struct SelvaObject *children_metadata;
    RB_ENTRY(SelvaHierarchyNode) _index_entry;
} SelvaHierarchyNode;

/**
 * Filter struct used for RB searches from hierarchy_index_tree.
 * This should somewhat match to SelvaHierarchyNode to the level necessary for
 * comparing nodes.
 */
struct SelvaHierarchySearchFilter {
    Selva_NodeId id;
};

/**
 * Hierarchy ancestral relationship types.
 */
enum SelvaHierarchyNode_Relationship {
    RELATIONSHIP_PARENT,
    RELATIONSHIP_CHILD,
};

#define GET_NODE_OBJ(_node_) \
    ((struct SelvaObject *)((_node_)->_obj_data))

/**
 * Structure for traversal cb of verifyDetachableSubtree().
 */
struct verifyDetachableSubtree {
    const char *err; /*!< Set to a reason string if subtree doesn't verify. */
    struct trx trx_cur; /*!< This is used to check if the children of node form a true subtree. */
    SelvaHierarchyNode *head;
    struct SelvaSet edge_origin_node_ids;
};

/**
 * HierarchySaveNode() args struct.
 */
struct HierarchySaveNode {
    struct selva_io *io;
};

/**
 * Period to check for expiring nodes.
 * The resolution of the expire property is 1 sec.
 */
static const struct timespec hierarchy_expire_period = {
    .tv_sec = 1,
};

static void SelvaHierarchy_DestroyNode(
        SelvaHierarchy *hierarchy,
        SelvaHierarchyNode *node);
static int removeRelationships(
        SelvaHierarchy *hierarchy,
        SelvaHierarchyNode *node,
        enum SelvaHierarchyNode_Relationship rel);
static void hierarchy_expire_tim_proc(struct event *e __unused, void *data);
static void hierarchy_set_expire(struct SelvaHierarchy *hierarchy, SelvaHierarchyNode *node, uint32_t expire);
RB_PROTOTYPE_STATIC(hierarchy_index_tree, SelvaHierarchyNode, _index_entry, SelvaHierarchyNode_Compare)
static int detach_subtree(SelvaHierarchy *hierarchy, struct SelvaHierarchyNode *node, enum SelvaHierarchyDetachedType type);
static int restore_subtree(SelvaHierarchy *hierarchy, const Selva_NodeId id);
static void auto_compress_proc(struct event *, void *data);
static void Hierarchy_SubtreeLoad(SelvaHierarchy *hierarchy, struct selva_string *s);
static struct selva_string *Hierarchy_SubtreeSave(SelvaHierarchy *hierarchy, struct SelvaHierarchyNode *node);

/* Node metadata constructors. */
SET_DECLARE(selva_HMCtor, SelvaHierarchyMetadataConstructorHook);
/* Node metadata destructors. */
SET_DECLARE(selva_HMDtor, SelvaHierarchyMetadataDestructorHook);

__nonstring static const Selva_NodeId HIERARCHY_SERIALIZATION_EOF;

SelvaHierarchy *main_hierarchy;

SELVA_TRACE_HANDLE(find_inmem);
SELVA_TRACE_HANDLE(find_detached);
SELVA_TRACE_HANDLE(restore_subtree);
SELVA_TRACE_HANDLE(auto_compress_proc);
SELVA_TRACE_HANDLE(traverse_children);
SELVA_TRACE_HANDLE(traverse_parents);
SELVA_TRACE_HANDLE(traverse_edge_field);
SELVA_TRACE_HANDLE(traverse_bfs_ancestors);
SELVA_TRACE_HANDLE(traverse_bfs_descendants);
SELVA_TRACE_HANDLE(traversal_array);

/**
 * A pointer to the hierarchy subtree being loaded.
 * Redis doesn't allow passing any pointers when loading a stringified RDB so a
 * global variable is needed for Hierarchy_SubtreeLoad().
 */
static int isDecompressingSubtree;
static int flag_isLoading;

static int isLoading(void) {
    return flag_isLoading || isDecompressingSubtree;
}

static int SVector_HierarchyNode_id_compare(const void ** restrict a_raw, const void ** restrict b_raw) {
    const SelvaHierarchyNode *a = *(const SelvaHierarchyNode **)a_raw;
    const SelvaHierarchyNode *b = *(const SelvaHierarchyNode **)b_raw;

    assert(a && b);

    return memcmp(a->id, b->id, SELVA_NODE_ID_SIZE);
}

static int SVector_HierarchyNode_expire_compare(const void ** restrict a_raw, const void ** restrict b_raw) {
    const SelvaHierarchyNode *a = *(const SelvaHierarchyNode **)a_raw;
    const SelvaHierarchyNode *b = *(const SelvaHierarchyNode **)b_raw;
    int diff;

    assert(a && b);

    diff = a->expire - b->expire;
    if (diff) {
        return diff;
    }

    return memcmp(a->id, b->id, SELVA_NODE_ID_SIZE);
}

static int SelvaHierarchyNode_Compare(const SelvaHierarchyNode *a, const SelvaHierarchyNode *b) {
    return memcmp(a->id, b->id, SELVA_NODE_ID_SIZE);
}

RB_GENERATE_STATIC(hierarchy_index_tree, SelvaHierarchyNode, _index_entry, SelvaHierarchyNode_Compare)

SelvaHierarchy *SelvaModify_NewHierarchy(void) {
    SelvaHierarchy *hierarchy = selva_calloc(1, sizeof(*hierarchy));

    mempool_init(&hierarchy->node_pool, HIERARCHY_SLAB_SIZE, sizeof(SelvaHierarchyNode), _Alignof(SelvaHierarchyNode));
    RB_INIT(&hierarchy->index_head);
    SVector_Init(&hierarchy->heads, 1, SVector_HierarchyNode_id_compare);
    SelvaObject_Init(hierarchy->types._obj_data);
    SelvaObject_Init(hierarchy->aliases._obj_data);
    Edge_InitEdgeFieldConstraints(&hierarchy->edge_field_constraints);
    SelvaSubscriptions_InitHierarchy(hierarchy);
    SelvaIndex_Init(hierarchy);

    if (SelvaModify_SetHierarchy(hierarchy, ROOT_NODE_ID, 0, NULL, 0, NULL, 0, NULL) < 0) {
        SelvaModify_DestroyHierarchy(hierarchy);
        hierarchy = NULL;
        goto fail;
    }
    assert(hierarchy->root && !memcmp(hierarchy->root->id, ROOT_NODE_ID, SELVA_NODE_ID_SIZE)); /* should be set by now. */

    /*
     * Initialize auto compression.
     */
    if (selva_glob_config.hierarchy_auto_compress_period_ms > 0) {
        struct timespec timeout;

        if (SelvaHierarchy_InitInactiveNodes(hierarchy, HIERARCHY_AUTO_COMPRESS_INACT_NODES_LEN)) {
            SelvaModify_DestroyHierarchy(hierarchy);
            hierarchy = NULL;
            goto fail;
        }

        msec2timespec(&timeout, selva_glob_config.hierarchy_auto_compress_period_ms);
        hierarchy->inactive.auto_compress_timer = evl_set_timeout(&timeout, auto_compress_proc, hierarchy);
        if (hierarchy->inactive.auto_compress_timer < 0) {
            SELVA_LOG(SELVA_LOGL_ERR, "Failed to setup a timer for auto compression: %s",
                      selva_strerror(hierarchy->inactive.auto_compress_timer));
        }
    } else {
        hierarchy->inactive.auto_compress_timer = SELVA_ENOENT;
    }

    SVector_Init(&hierarchy->expiring.list, 0, SVector_HierarchyNode_expire_compare);
    hierarchy->expiring.next = HIERARCHY_EXPIRING_NEVER;
    hierarchy->expiring.tim_id = evl_set_timeout(&hierarchy_expire_period, hierarchy_expire_tim_proc, hierarchy);

fail:
    return hierarchy;
}

static void end_auto_compress(SelvaHierarchy *hierarchy) {
    if (hierarchy->inactive.auto_compress_timer >= 0) {
        evl_clear_timeout(hierarchy->inactive.auto_compress_timer, NULL);
    }
    SelvaHierarchy_DeinitInactiveNodes(hierarchy);
}

void SelvaModify_DestroyHierarchy(SelvaHierarchy *hierarchy) {
    SelvaHierarchyNode *node;
    SelvaHierarchyNode *next;

    /*
     * Destroy expire control.
     */
    evl_clear_timeout(hierarchy->expiring.tim_id, NULL);
    SVector_Destroy(&hierarchy->expiring.list);

    for (node = RB_MIN(hierarchy_index_tree, &hierarchy->index_head); node != NULL; node = next) {
        next = RB_NEXT(hierarchy_index_tree, &hierarchy->index_head, node);
        RB_REMOVE(hierarchy_index_tree, &hierarchy->index_head, node);
        SelvaHierarchy_DestroyNode(hierarchy, node);
    }

    SelvaSubscriptions_DestroyAll(hierarchy);
    /*
     * If SelvaSubscriptions_DestroyAll() is ran first then we don't need to
     * bother about cleaning up subscriptions used by the indexing.
     */
    SelvaIndex_Deinit(hierarchy);
    Edge_DeinitEdgeFieldConstraints(&hierarchy->edge_field_constraints);
    SVector_Destroy(&hierarchy->heads);

    end_auto_compress(hierarchy);
    mempool_destroy(&hierarchy->node_pool);

    memset(hierarchy, 0, sizeof(*hierarchy));
    selva_free(hierarchy);
}

/**
 * Create the default fields of a node object.
 * This function should be called when creating a new node but not when loading
 * nodes from a serialized data.
 */
static int create_node_object(struct SelvaHierarchy *hierarchy, SelvaHierarchyNode *node) {
    const long long now = ts_now();
    struct SelvaObject *obj;
    struct selva_string *node_name;
    int err;

    node_name = selva_string_createf("%.*s", (int)SELVA_NODE_ID_SIZE, node->id);
    obj = SelvaObject_Init(node->_obj_data);

    err = SelvaObject_SetStringStr(obj, SELVA_ID_FIELD, sizeof(SELVA_ID_FIELD) - 1, node_name);
    if (err) {
        selva_string_free(node_name);
        return err;
    }

    struct selva_string *type;

    type = SelvaHierarchyTypes_Get(hierarchy, node->id);
    if (type) {
        err = SelvaObject_SetStringStr(obj, SELVA_TYPE_FIELD, sizeof(SELVA_TYPE_FIELD) - 1, type);
        if (err) {
            return err;
        }
    }

    SelvaObject_SetLongLongStr(obj, SELVA_UPDATED_AT_FIELD, sizeof(SELVA_UPDATED_AT_FIELD) - 1, now);
    SelvaObject_SetLongLongStr(obj, SELVA_CREATED_AT_FIELD, sizeof(SELVA_CREATED_AT_FIELD) - 1, now);

    return 0;
}

/*
 * This function is not really necessary but we have it to make sure that
 * the metadata constructor linker set is always created.
 */
static void node_metadata_init(
        const Selva_NodeId id __unused,
        struct SelvaHierarchyMetadata *metadata __unused) {
    /* NOP */
}
SELVA_MODIFY_HIERARCHY_METADATA_CONSTRUCTOR(node_metadata_init);

/**
 * Create a new node.
 */
static SelvaHierarchyNode *newNode(struct SelvaHierarchy *hierarchy, const Selva_NodeId id) {
    SelvaHierarchyNode *node;

    if (!memcmp(id, EMPTY_NODE_ID, SELVA_NODE_ID_SIZE) ||
        !memcmp(id, HIERARCHY_SERIALIZATION_EOF, SELVA_NODE_ID_SIZE)) {
        SELVA_LOG(SELVA_LOGL_WARN, "An attempt to create a node with a reserved id");
        return NULL;
    }

    node = mempool_get(&hierarchy->node_pool);
    memset(node, 0, sizeof(*node));

#if 0
    SELVA_LOG(SELVA_LOGL_DBG, "Creating node %.*s",
              (int)SELVA_NODE_ID_SIZE, id);
#endif

    memcpy(node->id, id, SELVA_NODE_ID_SIZE);
    SVector_Init(&node->parents,  selva_glob_config.hierarchy_initial_vector_len, SVector_HierarchyNode_id_compare);
    SVector_Init(&node->children, selva_glob_config.hierarchy_initial_vector_len, SVector_HierarchyNode_id_compare);

    /* The SelvaObject is created elsewhere if we are loading. */
    if (likely(!isLoading())) {
        int err;

        err = create_node_object(hierarchy, node);
        if (err) {
            SELVA_LOG(SELVA_LOGL_ERR, "Failed to create a node object for \"%.*s\". err: \"%s\"",
                      (int)SELVA_NODE_ID_SIZE, id,
                      selva_strerror(err));
        }

        /*
         * Every node is implicit unless it isn't. Modify should clear this flag
         * when explicitly creating a node, that can happen on a later command
         * call. This flag will be also persisted in the serialized format.
         */
        node->flags |= SELVA_NODE_FLAGS_IMPLICIT;
    }

    SelvaHierarchyMetadataConstructorHook **metadata_ctor_p;

    SET_FOREACH(metadata_ctor_p, selva_HMCtor) {
        SelvaHierarchyMetadataConstructorHook *ctor = *metadata_ctor_p;
        ctor(node->id, &node->metadata);
    }

    if (unlikely(!memcmp(node->id, ROOT_NODE_ID, SELVA_NODE_ID_SIZE))) {
        /* Establish fast access to the root. */
        hierarchy->root = node;
    }

    return node;
}

/**
 * Destroy node.
 * parents and children etc. must be empty unless the whole hierarchy is being freed.
 */
static void SelvaHierarchy_DestroyNode(SelvaHierarchy *hierarchy, SelvaHierarchyNode *node) {
    SelvaHierarchyMetadataDestructorHook **dtor_p;

    hierarchy_set_expire(hierarchy, node, 0); /* Remove expire */

    SET_FOREACH(dtor_p, selva_HMDtor) {
        SelvaHierarchyMetadataDestructorHook *dtor = *dtor_p;
        dtor(hierarchy, node, &node->metadata);
    }

    SVector_Destroy(&node->parents);
    SVector_Destroy(&node->children);
    SelvaObject_Destroy(GET_NODE_OBJ(node));
#if MEM_DEBUG
    memset(node, 0, sizeof(*node));
#endif
    mempool_return(&hierarchy->node_pool, node);
}

/**
 * Create a new detached node with given parents.
 */
static void new_detached_node(SelvaHierarchy *hierarchy, const Selva_NodeId node_id, Selva_NodeId *parents, size_t nr_parents) {
    const int prevIsDecompressingSubtree = isDecompressingSubtree;
    struct SelvaHierarchyNode *node;
    int err;

    /*
     * We are not actually decompressing but we need to make it look like we are.
     */
    isDecompressingSubtree = 1;
    err = SelvaHierarchy_UpsertNode(hierarchy, node_id, &node);
    isDecompressingSubtree = prevIsDecompressingSubtree;

    if (!err) {
        err = SelvaModify_AddHierarchyP(hierarchy, node, nr_parents, parents, 0, NULL);
        node->flags |= SELVA_NODE_FLAGS_DETACHED;
        SelvaObject_Destroy(GET_NODE_OBJ(node));
    }

    if (unlikely(err < 0)) {
        SELVA_LOG(SELVA_LOGL_CRIT, "Fatal error while creating a detached node %.*s. err: \"%s\"",
                  (int)SELVA_NODE_ID_SIZE, node_id,
                  selva_strerror(err));
        abort();
    }
}

/**
 * Reinit everything that was removed when the subtree head was made detached.
 * There should be no need to ever call this function from anywhere else but
 * SelvaHierarchy_FindNode().
 */
static int repopulate_detached_head(struct SelvaHierarchy *hierarchy, SelvaHierarchyNode *node) {
    int err;

    err = create_node_object(hierarchy, node);
    if (err) {
        SELVA_LOG(SELVA_LOGL_ERR, "Failed to repopulate a detached dummy node %.*s. err: \"%s\"",
                  (int)SELVA_NODE_ID_SIZE, node->id,
                  selva_strerror(err));
        return err;
    }

    node->flags &= ~SELVA_NODE_FLAGS_DETACHED;

    return 0;
}

/**
 * Search from the normal node index.
 * This function doesn't decompress subtrees nor checks if the node exists in
 * the detached node index.
 */
static SelvaHierarchyNode *find_node_index(SelvaHierarchy *hierarchy, const Selva_NodeId id) {
    if (!memcmp(id, ROOT_NODE_ID, SELVA_NODE_ID_SIZE)) {
        return hierarchy->root;
    } else {
        struct SelvaHierarchySearchFilter filter;
        SelvaHierarchyNode *node;

        memcpy(&filter.id, id, SELVA_NODE_ID_SIZE);
        node = RB_FIND(hierarchy_index_tree, &hierarchy->index_head, (SelvaHierarchyNode *)(&filter));

        return node;
    }
}

SelvaHierarchyNode *SelvaHierarchy_FindNode(SelvaHierarchy *hierarchy, const Selva_NodeId id) {
    SelvaHierarchyNode *node;
    int err;

    SELVA_TRACE_BEGIN(find_inmem);
    node = find_node_index(hierarchy, id);
    SELVA_TRACE_END(find_inmem);

    if (node && !(node->flags & SELVA_NODE_FLAGS_DETACHED)) {
        return node;
    } else if (node && isDecompressingSubtree) {
        err = repopulate_detached_head(hierarchy, node);
        if (err) {
            return NULL;
        }

        return node;
    } else if (!isDecompressingSubtree && SelvaHierarchyDetached_IndexExists(hierarchy)) {
        SELVA_TRACE_BEGIN(find_detached);
        err = restore_subtree(hierarchy, id);
        SELVA_TRACE_END(find_detached);
        if (err) {
            if (err != SELVA_ENOENT && err != SELVA_HIERARCHY_ENOENT) {
                SELVA_LOG(SELVA_LOGL_ERR, "Restoring a subtree containing %.*s failed. err: \"%s\"",
                          (int)SELVA_NODE_ID_SIZE, id,
                          selva_strerror(err));
            }

            return NULL;
        }

        return SelvaHierarchy_FindNode(hierarchy, id);
    } else {
        return NULL;
    }
}

struct SelvaObject *SelvaHierarchy_GetNodeObject(const struct SelvaHierarchyNode *node) {
    return GET_NODE_OBJ(node);
}

const struct SelvaHierarchyMetadata *_SelvaHierarchy_GetNodeMetadataByConstPtr(const SelvaHierarchyNode *node) {
    return &node->metadata;
}

struct SelvaHierarchyMetadata *_SelvaHierarchy_GetNodeMetadataByPtr(SelvaHierarchyNode *node) {
    return &node->metadata;
}

struct SelvaHierarchyMetadata *SelvaHierarchy_GetNodeMetadata(
        SelvaHierarchy *hierarchy,
        const Selva_NodeId id) {
    SelvaHierarchyNode *node;

    node = SelvaHierarchy_FindNode(hierarchy, id);

    return !node ? NULL : &node->metadata;
}

/**
 * Delete all edge_metadata from a parent to child relationship.
 * @returns 0 if deleted or no edge_metadata was set for this relationship;
 *          Otherwise a SelvaObject_DelKey() error is returned.
 */
static int delete_all_hierarchy_edge_metadata(struct SelvaHierarchyNode *parent, const Selva_NodeId dst_node_id)
{
    int err;

    if (!parent->children_metadata) {
        return 0;
    }

    err = SelvaObject_DelKeyStr(parent->children_metadata, dst_node_id, SELVA_NODE_ID_SIZE);
    return (err == SELVA_ENOENT) ? 0 : err;
}

/**
 * Get or create the edge_metadata object for a parent to child arc.
 */
static int get_hierarchy_edge_metadata(struct SelvaHierarchyNode *parent, const Selva_NodeId dst_node_id, bool create, struct SelvaObject **out) {
    int err = SELVA_ENOENT;

    if (!parent->children_metadata && create) {
        parent->children_metadata = SelvaObject_New();
    }

    if (parent->children_metadata) {
        err = SelvaObject_GetObjectStr(parent->children_metadata, dst_node_id, SELVA_NODE_ID_SIZE, out);
        if (err == SELVA_ENOENT && create) {
            struct SelvaObject *edge_metadata = SelvaObject_New();

            err = SelvaObject_SetObjectStr(parent->children_metadata, dst_node_id, SELVA_NODE_ID_SIZE, edge_metadata);
            if (err) {
                SelvaObject_Destroy(edge_metadata);
            } else {
                *out = edge_metadata;
            }
        }
    }

    return err;
}

int SelvaHierarchy_GetEdgeMetadata(
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        const Selva_NodeId dst_node_id,
        bool delete_all,
        bool create,
        struct SelvaObject **out) {
#define IS_FIELD(name) \
    (field_len == (sizeof(name) - 1) && !memcmp(name, field_str, sizeof(name) - 1))

    if (IS_FIELD(SELVA_PARENTS_FIELD)) {
        struct SelvaHierarchyNode *parent;

        parent = SVector_Search(&node->parents, (void *)dst_node_id);
        if (!parent) {
            return SELVA_HIERARCHY_ENOENT;
        }

        if (delete_all) {
            int err;

            err = delete_all_hierarchy_edge_metadata(parent, node->id);
            if (err) {
                return err;
            }
        }

        return get_hierarchy_edge_metadata(parent, node->id, create, out);
    } else if (IS_FIELD(SELVA_CHILDREN_FIELD)) {
        if (delete_all) {
            int err;

            err = delete_all_hierarchy_edge_metadata(node, dst_node_id);
            if (err) {
                return err;
            }
        }

        return get_hierarchy_edge_metadata(node, dst_node_id, create, out);
    } else {
        struct EdgeField *edge_field;

        edge_field = Edge_GetField(node, field_str, field_len);
        if (!edge_field) {
            return SELVA_HIERARCHY_ENOENT;
        }

        if (delete_all) {
            Edge_DeleteFieldMetadata(edge_field);
            if (!create) {
                *out = NULL;
                return 0;
            }
        }

        return Edge_GetFieldEdgeMetadata(edge_field, dst_node_id, create, out);
    }
    unreachable();
#undef IS_FIELD
}

/**
 * Get edge metadata.
 * @param node is the destination node.
 * @param adj_vec is the source vector.
 */
static struct SelvaObject *get_edge_metadata(struct SelvaHierarchyNode *node, enum SelvaTraversal field_type, const SVector *adj_vec) {
    struct SelvaObject *edge_metadata = NULL;

    if (field_type & (SELVA_HIERARCHY_TRAVERSAL_PARENTS |
                      SELVA_HIERARCHY_TRAVERSAL_CHILDREN)) {
        struct SelvaHierarchyNode *parent;
        struct SelvaHierarchyNode *child;
        struct SelvaObject *field_metadata;

        switch (field_type) {
        case SELVA_HIERARCHY_TRAVERSAL_PARENTS:
            parent = node;
            child = containerof(adj_vec, struct SelvaHierarchyNode, parents);
            break;
        case SELVA_HIERARCHY_TRAVERSAL_CHILDREN:
            parent = containerof(adj_vec, struct SelvaHierarchyNode, children);
            child = node;
            break;
        default:
            unreachable();
        }

        field_metadata = parent->children_metadata;
        if (field_metadata) {
            int err;

            err = SelvaObject_GetObjectStr(field_metadata, child->id, SELVA_NODE_ID_SIZE, &edge_metadata);
            if (err && err != SELVA_ENOENT) {
                SELVA_LOG(SELVA_LOGL_ERR, "Odd error: dst: %.*s err: %s",
                          (int)SELVA_NODE_ID_SIZE, node->id,
                          selva_strerror(err));
            }
        }
    } else if (field_type == SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD) {
        struct EdgeField *edge_field = containerof(adj_vec, struct EdgeField, arcs);
        (void)Edge_GetFieldEdgeMetadata(edge_field, node->id, false, &edge_metadata);
    }

    return edge_metadata;
}

struct SelvaObject *SelvaHierarchy_GetEdgeMetadataByTraversal(const struct SelvaHierarchyTraversalMetadata *traversal_metadata, struct SelvaHierarchyNode *node) {
    const enum SelvaHierarchyTraversalSVecPtag tag = PTAG_GETTAG(traversal_metadata->origin_field_svec_tagp);
    enum SelvaTraversal field_type;

    switch (tag) {
    case SELVA_TRAVERSAL_SVECTOR_PTAG_PARENTS:
        field_type = SELVA_HIERARCHY_TRAVERSAL_PARENTS;
        break;
    case SELVA_TRAVERSAL_SVECTOR_PTAG_CHILDREN:
        field_type = SELVA_HIERARCHY_TRAVERSAL_CHILDREN;
        break;
    case SELVA_TRAVERSAL_SVECTOR_PTAG_EDGE:
        field_type = SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD;
        break;
    default:
        abort();
    }

    return get_edge_metadata(node, field_type, PTAG_GETP(traversal_metadata->origin_field_svec_tagp));
}

static const char * const excluded_fields[] = {
    SELVA_ID_FIELD,
    SELVA_TYPE_FIELD,
    SELVA_CREATED_AT_FIELD,
    SELVA_ALIASES_FIELD,
    NULL
};

int SelvaHierarchy_ClearNodeFlagImplicit(SelvaHierarchyNode *node) {
    const int v = !!(node->flags & SELVA_NODE_FLAGS_IMPLICIT);

    if (v) {
        node->flags &= ~SELVA_NODE_FLAGS_IMPLICIT;
    }

    return v;
}

void SelvaHierarchy_ClearNodeFields(struct SelvaObject *obj) {
    SelvaObject_Clear(obj, excluded_fields);
}

static inline void mkHead(SelvaHierarchy *hierarchy, SelvaHierarchyNode *node) {
    (void)SVector_Insert(&hierarchy->heads, node);
}

static inline void rmHead(SelvaHierarchy *hierarchy, SelvaHierarchyNode *node) {
    /* Root should be never removed from heads. */
    if (memcmp(node->id, ROOT_NODE_ID, SELVA_NODE_ID_SIZE)) {
        SVector_Remove(&hierarchy->heads, node);
    }
}

static void del_node(SelvaHierarchy *hierarchy, SelvaHierarchyNode *node) {
    const int send_events = !isLoading();
    struct SelvaObject *obj = GET_NODE_OBJ(node);
    Selva_NodeId id;
    int is_root;
    int err;

    memcpy(id, node->id, SELVA_NODE_ID_SIZE);
    is_root = !memcmp(id, ROOT_NODE_ID, SELVA_NODE_ID_SIZE);

    if (send_events) {
        SelvaSubscriptions_DeferTriggerEvents(hierarchy, node, SELVA_SUBSCRIPTION_TRIGGER_TYPE_DELETED);
    }

    err = removeRelationships(hierarchy, node, RELATIONSHIP_PARENT);
    if (err < 0) {
        /* Presumably bad things could happen if we'd proceed now. */
        SELVA_LOG(SELVA_LOGL_ERR, "Failed to remove node parent relationships. node: %.*s err: %s",
                  (int)SELVA_NODE_ID_SIZE, id,
                  selva_strerror(err));
        return;
    }

    delete_all_node_aliases(hierarchy, obj);

    /*
     * Never delete the root node.
     */
    if (is_root) {
        SelvaHierarchy_ClearNodeFields(obj);

        /*
         * There might be something to collect if this was a large hierarchy.
         * Regardless, running the gc is a relatively cheap operation and makes
         * sense here.
         */
        mempool_gc(&hierarchy->node_pool);
    } else {
        err = removeRelationships(hierarchy, node, RELATIONSHIP_CHILD);
        if (err < 0) {
            /*
             * Well, this is embarassing. The caller won't be happy about
             * having a half-deleted node dangling there.
             */
            SELVA_LOG(SELVA_LOGL_ERR, "Failed to remove node child relationships. node: %.*s err: \"%s\"",
                      (int)SELVA_NODE_ID_SIZE, id,
                      selva_strerror(err));
            return;
        }

        /*
         * The node was now marked as a head but we are going to get rid of it
         * soon, so there is no reason to make it a tree head. In fact, doing
         * so would break things.
         */
        rmHead(hierarchy, node);

        RB_REMOVE(hierarchy_index_tree, &hierarchy->index_head, node);
        SelvaHierarchy_DestroyNode(hierarchy, node);
    }
}

/**
 * Actions that must be executed for a new node.
 * Generally this must be always called after newNode().
 */
static void publishNewNode(SelvaHierarchy *hierarchy, SelvaHierarchyNode *node) {
    if (!isLoading()) {
        SelvaSubscriptions_DeferFieldChangeEvents(hierarchy, node, SELVA_CREATED_AT_FIELD, sizeof(SELVA_CREATED_AT_FIELD) - 1);
        SelvaSubscriptions_DeferFieldChangeEvents(hierarchy, node, SELVA_UPDATED_AT_FIELD, sizeof(SELVA_UPDATED_AT_FIELD) - 1);
        SelvaSubscriptions_DeferMissingAccessorEvents(hierarchy, node->id, SELVA_NODE_ID_SIZE);
    }
}

static inline void publishAncestorsUpdate(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node) {
    if (!isLoading()) {
        const char *field_str = SELVA_ANCESTORS_FIELD;
        const size_t field_len = sizeof(SELVA_ANCESTORS_FIELD) - 1;

        SelvaSubscriptions_DeferFieldChangeEvents(hierarchy, node, field_str, field_len);
    }
}

static inline void publishDescendantsUpdate(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node) {
    if (!isLoading()) {
        const char *field_str = SELVA_DESCENDANTS_FIELD;
        const size_t field_len = sizeof(SELVA_DESCENDANTS_FIELD) - 1;

        SelvaSubscriptions_DeferFieldChangeEvents(hierarchy, node, field_str, field_len);
    }
}

static inline void publishChildrenUpdate(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node) {
    if (!isLoading()) {
        const char *field_str = SELVA_CHILDREN_FIELD;
        const size_t field_len = sizeof(SELVA_CHILDREN_FIELD) - 1;

        SelvaSubscriptions_DeferFieldChangeEvents(hierarchy, node, field_str, field_len);
    }
}

static inline void publishParentsUpdate(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node) {
    if (!isLoading()) {
        const char *field_str = SELVA_PARENTS_FIELD;
        const size_t field_len = sizeof(SELVA_PARENTS_FIELD) - 1;

        SelvaSubscriptions_DeferFieldChangeEvents(hierarchy, node, field_str, field_len);
    }
}

static int cross_insert_children(
        SelvaHierarchy *hierarchy,
        SelvaHierarchyNode *node,
        size_t n,
        const Selva_NodeId *nodes) {
    int res = 0;

    if (n == 0) {
        return 0; /* No changes. */
    }

    if (unlikely(node->flags & SELVA_NODE_FLAGS_DETACHED)) {
        /* The subtree must be restored before adding nodes here. */
        SELVA_LOG(SELVA_LOGL_ERR, "Cannot add children to a detached node %s",
                  node->id);
        return SELVA_HIERARCHY_ENOTSUP;
    }

    for (size_t i = 0; i < n; i++) {
        SelvaHierarchyNode *child;

        /* TODO Could we upsert here? */
        child = SelvaHierarchy_FindNode(hierarchy, nodes[i]);
        if (!child) {
            int err;

            err = SelvaModify_SetHierarchy(hierarchy, nodes[i],
                    0, NULL,
                    0, NULL,
                    0,
                    &child);
            if (err < 0) {
                SELVA_LOG(SELVA_LOGL_ERR, "Failed to create a child \"%.*s\" for \"%.*s\". err: \"%s\"",
                        (int)SELVA_NODE_ID_SIZE, nodes[i],
                        (int)SELVA_NODE_ID_SIZE, node->id,
                        selva_strerror(err));
                continue;
            }
        }

        if (SVector_Insert(&node->children, child) == NULL) {
            /* The child node is no longer an orphan */
            if (SVector_Size(&child->parents) == 0) {
                rmHead(hierarchy, child);
            }

            (void)SVector_Insert(&child->parents, node);

#if 0
            SELVA_LOG(SELVA_LOGL_DBG, "Inserted %.*s.children <= %.*s",
                      (int)SELVA_NODE_ID_SIZE, node->id,
                      (int)SELVA_NODE_ID_SIZE, child->id);
#endif

            /*
             * Inherit markers from the parent node to the new child.
             */
            SelvaSubscriptions_InheritParent(
                    hierarchy,
                    child->id, &child->metadata,
                    SVector_Size(&child->children),
                    node);

            /*
             * Inherit markers from the new child to the parent node.
             */
            SelvaSubscriptions_InheritChild(
                    hierarchy,
                    node->id, &node->metadata,
                    SVector_Size(&node->parents),
                    child);

            /*
             * Publish that the parents field was changed.
             * Actual events are only sent if there are subscription markers
             * set on this node.
             */
            publishParentsUpdate(hierarchy, child);
            publishAncestorsUpdate(hierarchy, child);

            res++; /* Count actual insertions */
        }

        publishChildrenUpdate(hierarchy, node);
        publishDescendantsUpdate(hierarchy, node);
    }

    /*
     * Publish that the children field was changed.
     */
    if (res > 0) {
        publishChildrenUpdate(hierarchy, node);
        publishDescendantsUpdate(hierarchy, node);
    }

    return res;
}

static int cross_insert_parents(
        SelvaHierarchy *hierarchy,
        SelvaHierarchyNode *node,
        size_t n,
        const Selva_NodeId *nodes,
        enum SelvaModify_SetFlags flags) {
    int res = 0;

    if (n == 0) {
        return 0; /* No changes. */
    }

    /* The node is no longer an orphan */
    if (SVector_Size(&node->parents) == 0) {
        rmHead(hierarchy, node);
    }

    for (size_t i = 0; i < n; i++) {
        SelvaHierarchyNode *parent;

        parent = SelvaHierarchy_FindNode(hierarchy, nodes[i]);
        if (!parent) {
            int err;

            err = SelvaModify_SetHierarchy(hierarchy, nodes[i],
                    !(flags & SELVA_MODIFY_SET_FLAG_NO_ROOT), ((Selva_NodeId []){ ROOT_NODE_ID }),
                    0, NULL,
                    0,
                    &parent);
            if (err < 0) {
                SELVA_LOG(SELVA_LOGL_ERR, "Failed to create a parent \"%.*s\" for \"%.*s\". err: \"%s\"",
                        (int)SELVA_NODE_ID_SIZE, nodes[i],
                        (int)SELVA_NODE_ID_SIZE, node->id,
                        selva_strerror(err));
                continue;
            }
        }

        /* Do inserts only if the relationship doesn't exist already */
        if (SVector_Insert(&node->parents, parent) == NULL) {
            (void)SVector_Insert(&parent->children, node);

#if 0
            SELVA_LOG(SELVA_LOGL_DBG, "Inserted %.*s.parents <= %.*s",
                      (int)SELVA_NODE_ID_SIZE, node->id,
                      (int)SELVA_NODE_ID_SIZE, parent->id);
#endif

            /*
             * Inherit subscription markers from the new parent to the node.
             */
            SelvaSubscriptions_InheritParent(
                    hierarchy,
                    node->id, &node->metadata,
                    SVector_Size(&node->children),
                    parent);

            /*
             * Inherit subscription markers from the node to the new parent.
             */
            SelvaSubscriptions_InheritChild(
                    hierarchy,
                    parent->id, &parent->metadata,
                    SVector_Size(&parent->parents),
                    node);

            /*
             * Publish that the children field was changed.
             * Actual events are only sent if there are subscription markers
             * set on this node.
             */
            publishChildrenUpdate(hierarchy, parent);
            publishDescendantsUpdate(hierarchy, parent);

            res++;
        }
    }

    /*
     * Publish that the parents field was changed.
     */
    if (res > 0) {
        publishParentsUpdate(hierarchy, node);
        publishAncestorsUpdate(hierarchy, node);
    }

    return res;
}

/*
 * @param pointers is set if nodes array contains pointers instead of Ids.
 */
static int crossRemove(
        SelvaHierarchy *hierarchy,
        SelvaHierarchyNode *node,
        enum SelvaHierarchyNode_Relationship rel,
        size_t n,
        const Selva_NodeId *nodes,
        int pointers) {
    SVECTOR_AUTOFREE(sub_markers);

    /*
     * Take a backup of the subscription markers so we can refresh them after
     * the operation.
     */
#ifndef PU_TEST_BUILD
    if (unlikely(!SVector_Clone(&sub_markers, &node->metadata.sub_markers.vec, NULL))) {
        return SELVA_HIERARCHY_ENOMEM;
    }
    SelvaSubscriptions_ClearAllMarkers(hierarchy, node);
#endif

    if (rel == RELATIONSHIP_CHILD) { /* no longer a child of adjacent */
        const size_t initialNodeParentsSize = SVector_Size(&node->parents);
        int pubParents = 0;

        for (size_t i = 0; i < n; i++) {
            SelvaHierarchyNode *parent;

            if (pointers) {
                memcpy(&parent, nodes[i], sizeof(SelvaHierarchyNode *));
            } else {
                parent = SelvaHierarchy_FindNode(hierarchy, nodes[i]);
            }

            if (!parent) {
                /*
                 * The most Redis thing to do is probably to ignore any
                 * missing nodes.
                 */
                continue;
            }

            SVector_Remove(&parent->children, node);
            SVector_Remove(&node->parents, parent);

            publishChildrenUpdate(hierarchy, parent);
            pubParents = 1;
        }

        if (initialNodeParentsSize > 0 && SVector_Size(&node->parents) == 0) {
            /* node is an orphan now */
            mkHead(hierarchy, node);
        }

        if (pubParents) {
            publishParentsUpdate(hierarchy, node);
        }
    } else if (rel == RELATIONSHIP_PARENT) { /* no longer a parent of adjacent */
        int pubChildren = 0;

        for (size_t i = 0; i < n; i++) {
            SelvaHierarchyNode *child;

            if (pointers) {
                memcpy(&child, nodes[i], sizeof(SelvaHierarchyNode *));
            } else {
                child = SelvaHierarchy_FindNode(hierarchy, nodes[i]);
            }

            if (!child) {
                /*
                 * The most Redis thing to do is probably to ignore any
                 * missing nodes.
                 */
                continue;
            }

            SVector_Remove(&child->parents, node);
            SVector_Remove(&node->children, child);

            if (SVector_Size(&child->parents) == 0) {
                /* child is an orphan now */
                mkHead(hierarchy, child);
            }

            publishParentsUpdate(hierarchy, child);
            pubChildren = 1;
        }

        if (pubChildren) {
            publishChildrenUpdate(hierarchy, node);
        }
    } else {
        return SELVA_HIERARCHY_ENOTSUP;
    }

    SelvaSubscriptions_RefreshSubsByMarker(hierarchy, &sub_markers);

    return 0;
}

/**
 * Remove all relationships rel of node.
 * @returns the number removed relationships. The nodes aren't necessary deleted.
 */
static int removeRelationships(
        SelvaHierarchy *hierarchy,
        SelvaHierarchyNode *node,
        enum SelvaHierarchyNode_Relationship rel) {
    SVector *vec_a;
    size_t offset_a;
    size_t offset_b;
    int nr_removed;
    SVECTOR_AUTOFREE(sub_markers);

    switch (rel) {
    case RELATIONSHIP_PARENT:
        /* Remove parent releationship to other nodes */
        offset_a = offsetof(SelvaHierarchyNode, children);
        offset_b = offsetof(SelvaHierarchyNode, parents);
        break;
    case RELATIONSHIP_CHILD:
        /* Remove child releationship to other nodes */
        offset_a = offsetof(SelvaHierarchyNode, parents);
        offset_b = offsetof(SelvaHierarchyNode, children);
        break;
    default:
        /* rel is invalid */
        assert(0);
        return 0;
    }

    vec_a = (SVector *)((char *)node + offset_a);
    nr_removed = SVector_Size(vec_a);
    if (nr_removed == 0) {
        return nr_removed;
    }

    /*
     * Backup the subscription markers so we can refresh them after the
     * operation.
     */
#ifndef PU_TEST_BUILD
    if (unlikely(!SVector_Clone(&sub_markers, &node->metadata.sub_markers.vec, NULL))) {
        SELVA_LOG(SELVA_LOGL_ERR, "Cloning markers of the node %.*s failed",
                  (int)SELVA_NODE_ID_SIZE, node->id);
        return SELVA_HIERARCHY_EINVAL;
    }
#endif

    SelvaSubscriptions_ClearAllMarkers(hierarchy, node);

    struct SVectorIterator it;
    SelvaHierarchyNode *adj;

    SVector_ForeachBegin(&it, vec_a);
    while ((adj = SVector_Foreach(&it))) {
        SVector *vec_b = (SVector *)((char *)adj + offset_b);

        SVector_Remove(vec_b, node);

        if (rel == RELATIONSHIP_PARENT && SVector_Size(vec_b) == 0) {
            /* This node is now orphan */
            mkHead(hierarchy, adj);
        }

    }
    SVector_Clear(vec_a);

    SelvaSubscriptions_RefreshSubsByMarker(hierarchy, &sub_markers);

    if (rel == RELATIONSHIP_CHILD) {
        mkHead(hierarchy, node);
    }

    return nr_removed;
}

int SelvaHierarchy_DelChildren(
        SelvaHierarchy *hierarchy,
        SelvaHierarchyNode *node) {
    return removeRelationships(hierarchy, node, RELATIONSHIP_PARENT);
}

int SelvaHierarchy_DelParents(
        SelvaHierarchy *hierarchy,
        SelvaHierarchyNode *node) {
    return removeRelationships(hierarchy, node, RELATIONSHIP_CHILD);
}

static inline SelvaHierarchyNode *index_new_node(SelvaHierarchy *hierarchy, SelvaHierarchyNode *node) {
    return RB_INSERT(hierarchy_index_tree, &hierarchy->index_head, node);
}

int SelvaModify_SetHierarchy(
        SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        size_t nr_parents,
        const Selva_NodeId parents[nr_parents],
        size_t nr_children,
        const Selva_NodeId children[nr_children],
        enum SelvaModify_SetFlags flags,
        struct SelvaHierarchyNode **node_out) {
    SelvaHierarchyNode *node;
    int isNewNode = 0;
    int err, res = 0;

    node = SelvaHierarchy_FindNode(hierarchy, id);
    if (!node) {
        node = newNode(hierarchy, id);
        if (unlikely(!node)) {
            return SELVA_HIERARCHY_ENOMEM;
        }

        publishNewNode(hierarchy, node);
        isNewNode = 1;
    }

    if (isNewNode) {
        if (unlikely(index_new_node(hierarchy, node))) {
            SelvaHierarchy_DestroyNode(hierarchy, node);

            return SELVA_HIERARCHY_EEXIST;
        }

        if (nr_parents == 0) {
            /* This node is orphan */
            mkHead(hierarchy, node);
        }

        res++;
    } else {
        /*
         * Clear the existing node relationships.
         * Note that we can't really tell the caller how many relationships were
         * removed because there is only one count we return.
         */
        (void)removeRelationships(hierarchy, node, RELATIONSHIP_PARENT);
        (void)removeRelationships(hierarchy, node, RELATIONSHIP_CHILD);
    }

    /*
     * Set relationship relative to other nodes
     * RFE if isNewNode == 0 then errors are not handled properly as
     * we don't know how to rollback.
     */
    err = cross_insert_parents(hierarchy, node, nr_parents, parents, flags);
    if (err < 0) {
        if (isNewNode) {
            del_node(hierarchy, node);
        }
        return err;
    }
    res += err;

    /* Same for the children */
    err = cross_insert_children(hierarchy, node, nr_children, children);
    if (err < 0) {
        if (isNewNode) {
            del_node(hierarchy, node);
        }
        return err;
    }
    res += err;

    if (node_out) {
        *node_out = node;
    }

    return res;
}

/**
 * Remove adjacents not on the nodes list.
 */
static int remove_missing(
        SelvaHierarchy *hierarchy,
        SelvaHierarchyNode *node,
        size_t nr_nodes,
        const Selva_NodeId nodes[nr_nodes],
        enum SelvaHierarchyNode_Relationship rel) {
    SVECTOR_AUTOFREE(old_adjs);
    struct SVectorIterator it;
    SelvaHierarchyNode *adj;
    int res = 0;

    if (unlikely(!SVector_Clone(&old_adjs, rel == RELATIONSHIP_CHILD ? &node->parents : &node->children, NULL))) {
        SELVA_LOG(SELVA_LOGL_ERR, "SVector clone failed");
        return SELVA_HIERARCHY_ENOMEM;
    }

    SVector_ForeachBegin(&it, &old_adjs);
    while ((adj = SVector_Foreach(&it))) {
        int found = 0;

        for (size_t i = 0; i < nr_nodes; i++) {
            if (!memcmp(adj->id, nodes[i], SELVA_NODE_ID_SIZE)) {
                found = 1;
                break;
            }
        }

        if (!found) {
            Selva_NodeId arr[1];

#if 0
            SELVA_LOG(SELVA_LOGL_DBG, "Removing %.*s.%s.%.*s",
                    (int)SELVA_NODE_ID_SIZE, node->id,
                    rel == RELATIONSHIP_CHILD ? SELVA_PARENTS_FIELD : SELVA_CHILDREN_FIELD,
                    (int)SELVA_NODE_ID_SIZE, adj->id);
#endif

            memcpy(arr, &adj, sizeof(SelvaHierarchyNode *));
            crossRemove(hierarchy, node, rel, 1, arr, 1);
            res++;
        }
    }

    return res;
}

int SelvaModify_SetHierarchyParents(
        SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        size_t nr_parents,
        const Selva_NodeId parents[nr_parents],
        enum SelvaModify_SetFlags flags) {
    SelvaHierarchyNode *node;
    int err, res = 0;

    node = SelvaHierarchy_FindNode(hierarchy, id);
    if (!node) {
        return SELVA_HIERARCHY_ENOENT;
    }

    if (nr_parents == 0) {
        /* Clear the existing node relationships. */
        return removeRelationships(hierarchy, node, RELATIONSHIP_CHILD);
    }

    /*
     * Set relationship relative to other nodes.
     */
    err = cross_insert_parents(hierarchy, node, nr_parents, parents, flags);
    if (err < 0) {
        return err;
    }
    res += err;

    /*
     * Remove parents that are not in the given list.
     */
    err = remove_missing(hierarchy, node, nr_parents, parents, RELATIONSHIP_CHILD);
    if (err < 0) {
        return err;
    }
    res += err;

    return res;
}

int SelvaModify_SetHierarchyChildren(
        SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        size_t nr_children,
        const Selva_NodeId children[nr_children],
        enum SelvaModify_SetFlags) {
    SelvaHierarchyNode *node;
    int err, res = 0;

    node = SelvaHierarchy_FindNode(hierarchy, id);
    if (!node) {
        return SELVA_HIERARCHY_ENOENT;
    }

    if (nr_children == 0) {
        /* Clear the existing node relationships */
        return removeRelationships(hierarchy, node, RELATIONSHIP_PARENT);
    }

    /*
     * Set relationship relative to other nodes.
     */
    err = cross_insert_children(hierarchy, node, nr_children, children);
    if (err < 0) {
        return err;
    }
    res += err;

    /*
     * Remove children that are not in the given list.
     */
    err = remove_missing(hierarchy, node, nr_children, children, RELATIONSHIP_PARENT);
    if (err < 0) {
        return err;
    }
    res += err;

    return res;
}

int SelvaHierarchy_UpsertNode(
        SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        SelvaHierarchyNode **out) {
    SelvaHierarchyNode *node = SelvaHierarchy_FindNode(hierarchy, id);
    SelvaHierarchyNode *prev_node;

    if (node) {
        if (out) {
            *out = node;
        }

        return SELVA_HIERARCHY_EEXIST;
    }

     node = newNode(hierarchy, id);
     if (unlikely(!node)) {
         return SELVA_HIERARCHY_ENOMEM;
     }

     publishNewNode(hierarchy, node);

     /*
      * All nodes must be indexed.
      */
     prev_node = index_new_node(hierarchy, node);
     if (prev_node) {
         /*
          * We are being extremely paranoid here as this shouldn't be possible.
          */
         SelvaHierarchy_DestroyNode(hierarchy, node);

         if (out) {
             *out = prev_node;
         }
         return SELVA_HIERARCHY_EEXIST;
     }

     /*
      * This node is currently an orphan and it must be marked as such.
      */
     mkHead(hierarchy, node);

     if (out) {
         *out = node;
     }
     return 0;
}

int SelvaModify_AddHierarchyP(
        SelvaHierarchy *hierarchy,
        SelvaHierarchyNode *node,
        size_t nr_parents,
        const Selva_NodeId parents[nr_parents],
        size_t nr_children,
        const Selva_NodeId children[nr_children]) {
    int err, res = 0;

    /*
     * Update relationship relative to other nodes
     * RFE if isNewNode == 0 then errors are not handled properly as
     * we don't know how to rollback.
     */
    err = cross_insert_parents(hierarchy, node, nr_parents, parents, 0);
    if (err < 0) {
        return err;
    }
    res += err;

    /* Same for the children */
    err = cross_insert_children(hierarchy, node, nr_children, children);
    if (err < 0) {
        return err;
    }
    res += err;

    return res;
}

int SelvaModify_AddHierarchy(
        SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        size_t nr_parents,
        const Selva_NodeId parents[nr_parents],
        size_t nr_children,
        const Selva_NodeId children[nr_children]) {
    SelvaHierarchyNode *node;
    int isNewNode;
    int err;

    err = SelvaHierarchy_UpsertNode(hierarchy, id, &node);
    if (err == SELVA_HIERARCHY_EEXIST) {
        isNewNode = 0;
    } else if (err) {
        return err;
    } else {
        isNewNode = 1;
    }

    err = SelvaModify_AddHierarchyP(hierarchy, node, nr_parents, parents, nr_children, children);
    if (err < 0) {
        if (isNewNode) {
            del_node(hierarchy, node);
        }

        return err;
    }

    return err + isNewNode; /* Return the number of changes. */
}

int SelvaModify_DelHierarchy(
        SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        size_t nr_parents,
        const Selva_NodeId parents[nr_parents],
        size_t nr_children,
        const Selva_NodeId children[nr_children]) {
    SelvaHierarchyNode *node;
    int err1, err2;

    node = SelvaHierarchy_FindNode(hierarchy, id);
    if (!node) {
        return SELVA_HIERARCHY_ENOENT;
    }

    err1 = crossRemove(hierarchy, node, RELATIONSHIP_CHILD, nr_parents, parents, 0);
    err2 = crossRemove(hierarchy, node, RELATIONSHIP_PARENT, nr_children, children, 0);

    return err1 ? err1 : err2;
}

/**
 * Copy nodeIds from vec to dst array.
 * The dst array must be large enough.
 * @param dst is an array of Selva_NodeIds
 * @param vec is an SVector pointing to SelvaNodes.
 */
static void copy_nodeIds(Selva_NodeId *dst, const struct SVector *vec) {
    struct SVectorIterator it;
    const SelvaHierarchyNode *node;

    SVector_ForeachBegin(&it, vec);
    while ((node = SVector_Foreach(&it))) {
        memcpy(dst++, node->id, SELVA_NODE_ID_SIZE);
    }
}

static int subr_del_adj_relationship(
        SelvaHierarchy *hierarchy,
        SelvaHierarchyNode *node,
        const Selva_NodeId adj_node_id,
        enum SelvaHierarchyNode_Relationship dir,
        SelvaHierarchyNode **adj_node_out) {
    SelvaHierarchyNode *adj_node;
    Selva_NodeId arr[1];

    /*
     * Find the node.
     */
    adj_node = SelvaHierarchy_FindNode(hierarchy, adj_node_id);
    *adj_node_out = adj_node;
    if (!adj_node) {
        /* Node not found;
         * This is probably fine, as there might have been a circular link.
         */
        return SELVA_HIERARCHY_ENOENT;
    }

    /*
     * Note that we store a pointer in a Selva_NodeId array to save in
     * pointless RB_FIND() lookups.
     */
    memcpy(arr, &adj_node, sizeof(SelvaHierarchyNode *));
    return crossRemove(hierarchy, node, dir, 1, arr, 1);
}

/**
 * Delete a node and its children.
 * @param resp Set to alloc the caller to send deleted ids; Can be NULL if DEL_HIERARCHY_NODE_REPLY_IDS is not given.
 * @param flags controlling how the deletion is executed.
 * @param opt_arg is a pointer to an optional argument, depending on flags.
 */
static int SelvaHierarchy_DelNodeP(
        struct selva_server_response_out *resp,
        SelvaHierarchy *hierarchy,
        SelvaHierarchyNode *node,
        enum SelvaModify_DelHierarchyNodeFlag flags,
        void *opt_arg) {
    size_t nr_ids;
    int nr_deleted = 0;

    assert(hierarchy);
    assert(node);

    if (flags & DEL_HIERARCHY_NODE_DETACH) {
        if (!opt_arg) {
            return SELVA_HIERARCHY_EINVAL;
        }

        /* Add to the detached nodes. */
        SelvaHierarchyDetached_AddNode(hierarchy, node->id, opt_arg);
    } else if (node->flags & SELVA_NODE_FLAGS_DETACHED) {
        /*
         * This should only happen if we have failed to restore the
         * subtree.
         */
        return SELVA_HIERARCHY_ENOTSUP;
    }

    SelvaSubscriptions_ClearAllMarkers(hierarchy, node);

    /*
     * Delete links to parents.
     * This might seem like unnecessary as the parent links will be deleted
     * when then node is deleted. However, if there is a cycle back to this
     * node from its descendants then we'd loop back here and eventually
     * causing invalid/NULL pointers to appear.
     */
    nr_ids = SVector_Size(&node->parents);
    if (nr_ids > 0) {
        Selva_NodeId *ids;

        ids = alloca(nr_ids * SELVA_NODE_ID_SIZE);

        copy_nodeIds(ids, &node->parents);
        for (size_t i = 0; i < nr_ids; i++) {
            SelvaHierarchyNode *parent;
            int err;

            err = subr_del_adj_relationship(hierarchy, node, ids[i], RELATIONSHIP_CHILD, &parent);
            if (err == SELVA_HIERARCHY_ENOENT) {
                continue;
            } else if (err) {
                return err;
            }
        }
    }

    /*
     * Delete orphan children recursively.
     */
    nr_ids = SVector_Size(&node->children);
    if (nr_ids > 0) {
        Selva_NodeId *ids;

        ids = alloca(nr_ids * SELVA_NODE_ID_SIZE);

        copy_nodeIds(ids, &node->children);
        for (size_t i = 0; i < nr_ids; i++) {
            SelvaHierarchyNode *child;
            int err;

            err = subr_del_adj_relationship(hierarchy, node, ids[i], RELATIONSHIP_PARENT, &child);
            if (err == SELVA_HIERARCHY_ENOENT) {
                continue;
            } else if (err) {
                return err;
            }

            /*
             * Recursively delete the child and its children if its parents field is
             * empty and no edge fields are pointing to it.
             */
            if ((flags & DEL_HIERARCHY_NODE_FORCE) || (SVector_Size(&child->parents) == 0 && Edge_Refcount(child) == 0)) {
                err = SelvaHierarchy_DelNodeP(resp, hierarchy, child, flags, opt_arg);
                if (err < 0) {
                    return err;
                } else {
                    nr_deleted += err;
                }
            }
        }
    }

    if ((flags & DEL_HIERARCHY_NODE_REPLY_IDS) != 0) {
        assert(resp);
        selva_send_str(resp, node->id, Selva_NodeIdLen(node->id));
    }
    del_node(hierarchy, node);

    return nr_deleted + 1;
}

static int SelvaHierarchy_DelNode(
        struct selva_server_response_out *resp,
        SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        enum SelvaModify_DelHierarchyNodeFlag flags) {
    SelvaHierarchyNode *node;

    node = SelvaHierarchy_FindNode(hierarchy, id);
    if (!node) {
        return SELVA_HIERARCHY_ENOENT;
    }

    return SelvaHierarchy_DelNodeP(resp, hierarchy, node, flags, NULL);
}

/**
 * Destroy the node if it's expiring.
 * @returns true if the node was expired.
 */
static bool expire_node(struct SelvaHierarchy *hierarchy, struct SelvaHierarchyNode *node, time_t now) {
    if (node->expire && !isLoading() && !hierarchy->flag_isSaving) {
        static_assert(sizeof(time_t) >= sizeof(int64_t));

        if (IS_EXPIRED(node->expire, now)) {
            const enum SelvaModify_DelHierarchyNodeFlag flags = 0;

            SELVA_LOG(SELVA_LOGL_DBG, "Expiring %.*s", (int)SELVA_NODE_ID_SIZE, node->id);
            (void)SelvaHierarchy_DelNodeP(NULL, hierarchy, node, flags, NULL);
            return true;
        }
    }

    return false;
}

static void hierarchy_set_expire(struct SelvaHierarchy *hierarchy, struct SelvaHierarchyNode *node, uint32_t expire) {
    uint32_t prev;
    bool updated = false;

    prev = node->expire;
    if (prev != 0) {
        (void)SVector_Remove(&hierarchy->expiring.list, node);
        updated = true;
    }

    node->expire = expire;
    if (expire != 0) {
        (void)SVector_Insert(&hierarchy->expiring.list, node);
        updated = true;
    }

    if (updated) {
        struct SelvaHierarchyNode *top;

        top = SVector_Peek(&hierarchy->expiring.list);
        hierarchy->expiring.next = (top) ? top->expire : HIERARCHY_EXPIRING_NEVER;
    }
}

/**
 * Process expiring nodes every 1 sec.
 */
static void hierarchy_expire_tim_proc(struct event *e __unused, void *data) {
    struct SelvaHierarchy *hierarchy = (struct SelvaHierarchy *)data;
    const enum replication_mode rmode = selva_replication_get_mode();

    hierarchy->expiring.tim_id = evl_set_timeout(&hierarchy_expire_period, hierarchy_expire_tim_proc, data);

    /*
     * Nodes are only expired on the origin and replicated to the replicas.
     */
    if (rmode == SELVA_REPLICATION_MODE_NONE ||
        rmode == SELVA_REPLICATION_MODE_ORIGIN) {
        struct timespec now;

        ts_monorealtime(&now);

        if (IS_EXPIRED(hierarchy->expiring.next, now.tv_sec)) {
            struct SelvaHierarchyNode *node;

            /*
             * Expire/destroy all expiring nodes.
             */
            if (rmode == SELVA_REPLICATION_MODE_ORIGIN) {
                /*
                 * We need to replicate expirations.
                 */
                while ((node = SVector_Peek(&hierarchy->expiring.list))) {
                    Selva_NodeId node_id;

                    memcpy(node_id, node->id, SELVA_NODE_ID_SIZE);

                    if (expire_node(hierarchy, node, now.tv_sec)) {
                        struct selva_proto_builder_msg msg;

                        selva_proto_builder_init(&msg);
                        selva_proto_builder_insert_string(&msg, NULL, 0);
                        selva_proto_builder_insert_string(&msg, node_id, SELVA_NODE_ID_SIZE);
                        selva_proto_builder_end(&msg);

                        /*
                         * Replicate expiration as a delete cmd.
                         */
                        selva_replication_replicate(ts_now(), CMD_ID_HIERARCHY_DEL, msg.buf, msg.bsize);
                        selva_proto_builder_deinit(&msg);
                    } else {
                        break;
                    }
                }
            } else {
                /*
                 * Non-replication mode code can be much simpler.
                 */
                while ((node = SVector_Peek(&hierarchy->expiring.list))) {
                    if (!expire_node(hierarchy, node, now.tv_sec)) {
                        break;
                    }
                }
            }

            SelvaSubscriptions_SendDeferredEvents(hierarchy);
        }
    }
}

static int SelvaHierarchyHeadCallback_Dummy(
        struct SelvaHierarchy *,
        const struct SelvaHierarchyTraversalMetadata *,
        SelvaHierarchyNode *head __unused,
        void *arg __unused) {
    return 0;
}

static int HierarchyNode_Callback_Dummy(
        struct SelvaHierarchy *,
        const struct SelvaHierarchyTraversalMetadata *,
        struct SelvaHierarchyNode *node __unused,
        void *arg __unused) {
    return 0;
}

static int SelvaHierarchyChildCallback_Dummy(
        struct SelvaHierarchy *,
        const struct SelvaHierarchyTraversalMetadata *,
        struct SelvaHierarchyNode *child __unused,
        void *arg __unused) {
    return 0;
}

/**
 * DFS from a given head node towards its descendants or ancestors.
 */
static int dfs(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *head,
        enum SelvaHierarchyNode_Relationship dir,
        const struct SelvaHierarchyCallback * restrict cb) {
    SelvaHierarchyNodeCallback head_cb = cb->head_cb ? cb->head_cb : &SelvaHierarchyHeadCallback_Dummy;
    SelvaHierarchyNodeCallback node_cb = cb->node_cb ? cb->node_cb : &HierarchyNode_Callback_Dummy;
    SelvaHierarchyNodeCallback child_cb = cb->child_cb ? cb->child_cb : &SelvaHierarchyChildCallback_Dummy;
    enum SelvaHierarchyTraversalSVecPtag vec_tag;
    size_t offset;

    switch (dir) {
    case RELATIONSHIP_PARENT:
        vec_tag = SELVA_TRAVERSAL_SVECTOR_PTAG_PARENTS;
        offset = offsetof(SelvaHierarchyNode, parents);
        break;
    case RELATIONSHIP_CHILD:
        vec_tag = SELVA_TRAVERSAL_SVECTOR_PTAG_CHILDREN;
        offset = offsetof(SelvaHierarchyNode, children);
        break;
    default:
        return SELVA_HIERARCHY_ENOTSUP;
    }

    SVECTOR_AUTOFREE(stack);
    SVECTOR_AUTOFREE(src_stack);
    SVector_Init(&stack, selva_glob_config.hierarchy_expected_resp_len, NULL);
    SVector_Init(&src_stack, selva_glob_config.hierarchy_expected_resp_len, NULL);

    int err = 0;
    struct trx trx_cur;
    if (Trx_Begin(&hierarchy->trx_state, &trx_cur)) {
        return SELVA_HIERARCHY_ETRMAX;
    }

    SVector_Insert(&stack, head);
    SVector_Insert(&src_stack, NULL);
    struct SelvaHierarchyTraversalMetadata head_cb_metadata = {};
    if (head_cb(hierarchy, &head_cb_metadata, head, cb->head_arg)) {
        err = 0;
        goto out;
    }

    while (SVector_Size(&stack) > 0) {
        SelvaHierarchyNode *node = SVector_Pop(&stack);
        const struct SelvaHierarchyTraversalMetadata node_cb_metadata = {
            .origin_field_svec_tagp = SVector_Pop(&src_stack),
        };

        if (Trx_Visit(&trx_cur, &node->trx_label)) {
            if (node_cb(hierarchy, &node_cb_metadata, node, cb->node_arg)) {
                err = 0;
                goto out;
            }

            /* Add parents/children of this node to the stack of unvisited nodes */
            struct SVectorIterator it;
            SelvaHierarchyNode *adj;
            const SVector *vec = (SVector *)((char *)node + offset);

            SVector_ForeachBegin(&it, vec);
            while ((adj = SVector_Foreach(&it))) {
                const struct SelvaHierarchyTraversalMetadata child_metadata = {
                    .origin_field_svec_tagp = PTAG(vec, vec_tag),
                };

                if (adj->flags & SELVA_NODE_FLAGS_DETACHED) {
                    err = restore_subtree(hierarchy, adj->id);
                    if (err) {
                        /*
                         * The error is already logged,
                         * we just try to bail from here.
                         */
                        goto out;
                    }
                }

                (void)child_cb(hierarchy, &child_metadata, adj, cb->child_arg);

                /* Add to the stack of unvisited nodes */
                SVector_Insert(&stack, adj);
                SVector_Insert(&src_stack, (void *)child_metadata.origin_field_svec_tagp);
            }
        }
    }

out:
    Trx_End(&hierarchy->trx_state, &trx_cur);
    return err;
}

/**
 * Returns true if calling SelvaHierarchy_AddInactiveNodeId() is safe.
 * I.e. true if we should track inactive nodes for auto compression.
 */
static bool SelvaHierarchy_CanTrackInactiveNodes(struct SelvaHierarchy *hierarchy)
{
    return
        /* No need to track if auto compression is disabled. */
        selva_glob_config.hierarchy_auto_compress_period_ms > 0 &&
        /*
         * Track only in the dump process.
         * This should also prevent query_forks from writing the
         * tracking data.
         */
        hierarchy->flag_isSaving;
}

/**
 * Traverse through all nodes of the hierarchy from heads to leaves.
 */
static int full_dfs(
        struct SelvaHierarchy *hierarchy,
        const struct SelvaHierarchyCallback * restrict cb) {
    SelvaHierarchyNodeCallback head_cb = cb->head_cb ? cb->head_cb : &SelvaHierarchyHeadCallback_Dummy;
    SelvaHierarchyNodeCallback node_cb = cb->node_cb ? cb->node_cb : &HierarchyNode_Callback_Dummy;
    SelvaHierarchyNodeCallback child_cb = cb->child_cb ? cb->child_cb : &SelvaHierarchyChildCallback_Dummy;
    const int enable_restore = !(cb->flags & SELVA_HIERARCHY_CALLBACK_FLAGS_INHIBIT_RESTORE);
    SelvaHierarchyNode *head;
    SVECTOR_AUTOFREE(stack);
    SVECTOR_AUTOFREE(source_stack);

    SVector_Init(&stack, selva_glob_config.hierarchy_expected_resp_len, NULL);
    SVector_Init(&source_stack, selva_glob_config.hierarchy_expected_resp_len, NULL);

    struct trx trx_cur;
    if (Trx_Begin(&hierarchy->trx_state, &trx_cur)) {
        return SELVA_HIERARCHY_ETRMAX;
    }

    int err = 0;
    struct SVectorIterator it;

    const bool track_auto_compression = SelvaHierarchy_CanTrackInactiveNodes(hierarchy);
    const long long old_age_threshold = selva_glob_config.hierarchy_auto_compress_old_age_lim;

    SVector_ForeachBegin(&it, &hierarchy->heads);
    while ((head = SVector_Foreach(&it))) {
        const struct SelvaHierarchyTraversalMetadata head_cb_metadata = {
            .origin_field_svec_tagp = PTAG(&hierarchy->heads, SELVA_TRAVERSAL_SVECTOR_PTAG_NONE),
        };
        SVector_Insert(&stack, head);
        SVector_Insert(&source_stack, (void *)head_cb_metadata.origin_field_svec_tagp);

        if ((head->flags & SELVA_NODE_FLAGS_DETACHED) && enable_restore) {
            err = restore_subtree(hierarchy, head->id);
            if (err) {
                /*
                 * The error is already logged,
                 * we just try to bail from here.
                 */
                goto out;
            }
        }

        if (head_cb(hierarchy, &head_cb_metadata, head, cb->head_arg)) {
            err = 0;
            goto out;
        }

        /**
         * This variable tracks a contiguous (DFS) path that hasn't been
         * traversed for some time. It starts tracking when the first old node
         * is found and keeps its value unless a subsequent node has been
         * touched recently.
         * The candidate is saved and the variable is reset to NULL once a leaf
         * is reached, and the tracking can start again from the top.
         */
        struct SelvaHierarchyNode *compressionCandidate = NULL;

        while (SVector_Size(&stack) > 0) {
            SelvaHierarchyNode *node = SVector_Pop(&stack);
            struct SelvaHierarchyTraversalMetadata node_cb_metadata = {
                .origin_field_svec_tagp = SVector_Pop(&source_stack),
            };

            /*
             * Note that the serialization child process won't touch the trxids
             * in the parent process (separate address space), therefore old
             * nodes will generally stay old if they are otherwise untouched.
             */
            if (track_auto_compression && !compressionCandidate &&
                memcmp(node->id, ROOT_NODE_ID, SELVA_NODE_ID_SIZE)) {
                if (Trx_LabelAge(&hierarchy->trx_state, &node->trx_label) >= old_age_threshold &&
                    !(node->flags & SELVA_NODE_FLAGS_DETACHED)) {
                    compressionCandidate = node;
                }
            }
            if (compressionCandidate && Trx_LabelAge(&hierarchy->trx_state, &node->trx_label) < old_age_threshold) {
                compressionCandidate = NULL;
            }

            if (Trx_Visit(&trx_cur, &node->trx_label)) {
                struct SVectorIterator it2;
                SelvaHierarchyNode *adj;

                if (node_cb(hierarchy, &node_cb_metadata, node, cb->node_arg)) {
                    err = 0;
                    goto out;
                }
                if (node->flags & SELVA_NODE_FLAGS_DETACHED) {
                    /*
                     * Can't traverse a detached node any further.
                     * This flag can be set only if we inhibit restoring
                     * subtrees with SELVA_HIERARCHY_CALLBACK_FLAGS_INHIBIT_RESTORE.
                     */
                    continue;
                }

                /*
                 * Reset the compressionCandidate tracking and save the current candidate.
                 * No need to test track_auto_compression as compressionCandidate
                 * would be NULL on false case.
                 */
                if (compressionCandidate && SVector_Size(&node->children) == 0) {
                    SelvaHierarchy_AddInactiveNodeId(hierarchy, compressionCandidate->id);
                    compressionCandidate = NULL;
                }

                SVector_ForeachBegin(&it2, &node->children);
                while ((adj = SVector_Foreach(&it2))) {
                    const struct SelvaHierarchyTraversalMetadata child_metadata = {
                        .origin_field_svec_tagp = PTAG(&node->children, SELVA_TRAVERSAL_SVECTOR_PTAG_CHILDREN),
                    };

                    if ((adj->flags & SELVA_NODE_FLAGS_DETACHED) && enable_restore) {
                        err = restore_subtree(hierarchy, adj->id);
                        if (err) {
                            goto out;
                        }
                    }

                    (void)child_cb(hierarchy, &child_metadata, adj, cb->child_arg);

                    /* Add to the stack of unvisited nodes */
                    SVector_Insert(&stack, adj);
                    SVector_Insert(&source_stack, (void *)child_metadata.origin_field_svec_tagp);
                }
            }
        }
    }

out:
    Trx_End(&hierarchy->trx_state, &trx_cur);
    return err;
}

#define BFS_TRAVERSE(hierarchy, head, cb) \
    SelvaHierarchyNodeCallback head_cb = (cb)->head_cb ? (cb)->head_cb : SelvaHierarchyHeadCallback_Dummy; \
    SelvaHierarchyNodeCallback node_cb = (cb)->node_cb ? (cb)->node_cb : HierarchyNode_Callback_Dummy; \
    SelvaHierarchyNodeCallback child_cb = (cb)->child_cb ? (cb)->child_cb : SelvaHierarchyChildCallback_Dummy; \
    \
    SVECTOR_AUTOFREE(_bfs_q); \
    SVECTOR_AUTOFREE(_bfs_sq); /*!< origin PTAG(<SVector>, p/c/e) */ \
    SVector_Init(&_bfs_q,  selva_glob_config.hierarchy_expected_resp_len, NULL); \
    SVector_Init(&_bfs_sq, selva_glob_config.hierarchy_expected_resp_len, NULL); \
    struct { \
        long long cur_depth; /*!< Current depth. */ \
        long long count; /*!< Elements left to next depth Increment. */ \
        long long next_count; /*!< Next initial cont. */ \
    } _bfs_depth = { 0, 1, 0 }; \
    \
    struct trx trx_cur; \
    if (Trx_Begin(&(hierarchy)->trx_state, &trx_cur)) { \
        return SELVA_HIERARCHY_ETRMAX; \
    } \
    \
    Trx_Visit(&trx_cur, &(head)->trx_label); \
    SVector_Insert(&_bfs_q, (head)); \
    SVector_Insert(&_bfs_sq, NULL); \
    if (head_cb((hierarchy), &(const struct SelvaHierarchyTraversalMetadata){ .depth = _bfs_depth.cur_depth }, (head), (cb)->head_arg)) { Trx_End(&(hierarchy)->trx_state, &trx_cur); return 0; } \
    while (SVector_Size(&_bfs_q) > 0) { \
        SelvaHierarchyNode *node = SVector_Shift(&_bfs_q); \
        struct SelvaHierarchyTraversalMetadata _node_cb_metadata = { \
            .origin_field_svec_tagp = SVector_Shift(&_bfs_sq), \
            .depth = _bfs_depth.cur_depth, \
        };

#define BFS_VISIT_NODE(hierarchy, cb) do { \
        /* Note that Trx_Visit() has been already called for this node. */ \
        if (node_cb((hierarchy), &_node_cb_metadata, node, (cb)->node_arg)) { \
            Trx_End(&(hierarchy)->trx_state, &trx_cur); \
            return 0; \
        } \
    } while (0)

#define BFS_VISIT_ADJACENT(hierarchy, cb, _origin_field_tag, _adj_vec, adj_node) do { \
        if (Trx_Visit(&trx_cur, &(adj_node)->trx_label)) { \
            if ((adj_node)->flags & SELVA_NODE_FLAGS_DETACHED) { \
                int subtree_err = restore_subtree((hierarchy), (adj_node)->id); \
                if (subtree_err) { \
                    Trx_End(&(hierarchy)->trx_state, &trx_cur); \
                    return subtree_err; \
                } \
            } \
            const void *_origin_field_svec_tagp = PTAG((_adj_vec), (_origin_field_tag)); \
            const struct SelvaHierarchyTraversalMetadata _child_cb_metadata = { \
                .origin_field_svec_tagp = _origin_field_svec_tagp, \
                .depth = _bfs_depth.cur_depth, \
            }; \
            (void)child_cb((hierarchy), &_child_cb_metadata, (adj_node), (cb)->child_arg); \
            SVector_Insert(&_bfs_q, (adj_node)); \
            SVector_Insert(&_bfs_sq, (void *)_origin_field_svec_tagp); \
            _bfs_depth.next_count++; \
        } \
    } while (0)

#define BFS_VISIT_ADJACENTS(hierarchy, cb, origin_field_tag, adj_vec) do { \
        struct SVectorIterator _bfs_visit_it; \
        \
        SVector_ForeachBegin(&_bfs_visit_it, (adj_vec)); \
        SelvaHierarchyNode *_adj; \
        while ((_adj = SVector_Foreach(&_bfs_visit_it))) { \
            BFS_VISIT_ADJACENT((hierarchy), (cb), (origin_field_tag), (adj_vec), _adj); \
        } \
    } while (0)

#define BFS_TRAVERSE_END(hierarchy) \
        if (--_bfs_depth.count == 0) { \
            _bfs_depth.cur_depth++; \
            _bfs_depth.count = _bfs_depth.next_count; \
            _bfs_depth.next_count = 0; \
        } \
    } \
    Trx_End(&(hierarchy)->trx_state, &trx_cur)

SVector *SelvaHierarchy_GetHierarchyField(struct SelvaHierarchyNode *node, const char *field_str, size_t field_len, enum SelvaTraversal *field_type) {
#define IS_FIELD(name) \
    (field_len == (sizeof(name) - 1) && !memcmp(name, field_str, sizeof(name) - 1))

    if (IS_FIELD(SELVA_CHILDREN_FIELD)) {
        *field_type = SELVA_HIERARCHY_TRAVERSAL_CHILDREN;
        return &node->children;
    } else if (IS_FIELD(SELVA_PARENTS_FIELD)) {
        *field_type = SELVA_HIERARCHY_TRAVERSAL_PARENTS;
        return &node->parents;
    }

    *field_type = SELVA_HIERARCHY_TRAVERSAL_NONE;
    return NULL;
#undef IS_FIELD
}

/**
 * Execute an edge filter for the node.
 * @param edge_filter_ctx is a context for the filter.
 * @param edge_filter is a pointer to the compiled edge filter.
 * @param edge_metadata can be NULL.
 * @param node is a pointer to the node the edge is pointing to.
 */
__attribute__((nonnull (5))) static int exec_edge_filter(
        struct SelvaHierarchy *hierarchy,
        struct rpn_ctx *edge_filter_ctx,
        const struct rpn_expression *edge_filter,
        struct SelvaObject *edge_metadata,
        struct SelvaHierarchyNode *node) {
    STATIC_SELVA_OBJECT(tmp_obj);
    enum rpn_error rpn_err;
    int res;

    if (!edge_metadata) {
        /* Execute the filter with an empty object. */
        edge_metadata = SelvaObject_Init(tmp_obj);
    }

    rpn_set_reg(edge_filter_ctx, 0, node->id, SELVA_NODE_ID_SIZE, RPN_SET_REG_FLAG_IS_NAN);
    edge_filter_ctx->data.hierarchy = hierarchy;
    edge_filter_ctx->data.node = node;
    edge_filter_ctx->data.obj = edge_metadata;
    rpn_err = rpn_bool(edge_filter_ctx, edge_filter, &res);

    return (!rpn_err && res) ? 1 : 0;
}

/**
 * BFS from a given head node towards its ancestors.
 */
static __hot int bfs_ancestors(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *head,
        const struct SelvaHierarchyCallback * restrict cb) {
    BFS_TRAVERSE(hierarchy, head, cb) {
        const SVector *adj_vec = (SVector *)((char *)node + offsetof(SelvaHierarchyNode, parents));

        BFS_VISIT_NODE(hierarchy, cb);
        BFS_VISIT_ADJACENTS(hierarchy, cb, SELVA_TRAVERSAL_SVECTOR_PTAG_PARENTS, adj_vec);
    } BFS_TRAVERSE_END(hierarchy);

    return 0;
}

/**
 * BFS from a given head node towards its descendants.
 */
static __hot int bfs_descendants(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *head,
        const struct SelvaHierarchyCallback * restrict cb) {
    BFS_TRAVERSE(hierarchy, head, cb) {
        const SVector *adj_vec = (SVector *)((char *)node + offsetof(SelvaHierarchyNode, children));

        BFS_VISIT_NODE(hierarchy, cb);
        BFS_VISIT_ADJACENTS(hierarchy, cb, SELVA_TRAVERSAL_SVECTOR_PTAG_CHILDREN, adj_vec);
    } BFS_TRAVERSE_END(hierarchy);

    return 0;
}

static int bfs_edge(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *head,
        const char *field_name_str,
        size_t field_name_len,
        const struct SelvaHierarchyCallback * restrict cb) {
    BFS_TRAVERSE(hierarchy, head, cb) {
        const struct EdgeField *edge_field;

        BFS_VISIT_NODE(hierarchy, cb);

        edge_field = Edge_GetField(node, field_name_str, field_name_len);
        if (!edge_field) {
#if 0
            SELVA_LOG(SELVA_LOGL_DBG, "Edge field %.*s not found in %.*s",
                    (int)field_name_len, field_name_str,
                    (int)SELVA_NODE_ID_SIZE, node->id);
#endif
            /* EdgeField not found! */
            continue;
        }

        BFS_VISIT_ADJACENTS(hierarchy, cb, SELVA_TRAVERSAL_SVECTOR_PTAG_EDGE, &edge_field->arcs);
    } BFS_TRAVERSE_END(hierarchy);

    return 0;
}

static enum SelvaHierarchyTraversalSVecPtag traversal2vec_tag(enum SelvaTraversal field_type) {
    switch (field_type) {
    case SELVA_HIERARCHY_TRAVERSAL_CHILDREN:
        return SELVA_TRAVERSAL_SVECTOR_PTAG_CHILDREN;
    case SELVA_HIERARCHY_TRAVERSAL_PARENTS:
        return SELVA_TRAVERSAL_SVECTOR_PTAG_PARENTS;
    case SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD:
        return SELVA_TRAVERSAL_SVECTOR_PTAG_EDGE;
    default:
        return SELVA_TRAVERSAL_SVECTOR_PTAG_NONE;
    };
}

static int bfs_expression(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *head,
        struct rpn_ctx *rpn_ctx,
        const struct rpn_expression *rpn_expr,
        struct rpn_ctx *edge_filter_ctx,
        const struct rpn_expression *edge_filter,
        const struct SelvaHierarchyCallback * restrict cb) {
    BFS_TRAVERSE(hierarchy, head, cb) {
        enum rpn_error rpn_err;
        struct SelvaSet fields;
        struct SelvaSetElement *field_el;

        SelvaSet_Init(&fields, SELVA_SET_TYPE_STRING);

        rpn_set_reg(rpn_ctx, 0, node->id, SELVA_NODE_ID_SIZE, RPN_SET_REG_FLAG_IS_NAN);
        rpn_ctx->data.hierarchy = hierarchy;
        rpn_ctx->data.node = node;
        rpn_ctx->data.obj = SelvaHierarchy_GetNodeObject(node);
        rpn_err = rpn_selvaset(rpn_ctx, rpn_expr, &fields);
        if (rpn_err) {
            SELVA_LOG(SELVA_LOGL_ERR, "RPN field selector expression failed for %.*s: %s",
                      (int)SELVA_NODE_ID_SIZE, node->id,
                      rpn_str_error[rpn_err]);
            continue;
        }

        BFS_VISIT_NODE(hierarchy, cb);

        SELVA_SET_STRING_FOREACH(field_el, &fields) {
            size_t field_len;
            const char *field_str = selva_string_to_str(field_el->value_string, &field_len);
            struct field_lookup_traversable t;
            enum SelvaHierarchyTraversalSVecPtag adj_tag;
            struct SVectorIterator it;
            SelvaHierarchyNode *adj;
            int err;

            /* Get an SVector for the field. */
            err = field_lookup_traversable(node, field_str, field_len, &t);
            if (err || !t.vec) {
                /* RFE What if it's not ENOENT? */
                continue;
            }

            adj_tag = traversal2vec_tag(t.type);

            /* Visit each node in this field. */
            SVector_ForeachBegin(&it, t.vec);
            while ((adj = SVector_Foreach(&it))) {
                if (!Trx_HasVisited(&trx_cur, &adj->trx_label) && edge_filter) {
                    struct SelvaObject *edge_metadata = get_edge_metadata(adj, t.type, t.vec);

                    if (!exec_edge_filter(hierarchy, edge_filter_ctx, edge_filter, edge_metadata, adj)) {
                        continue;
                    }
                }

                BFS_VISIT_ADJACENT(hierarchy, cb, adj_tag, t.vec, adj);
            }
        }

        SelvaSet_Destroy(&fields);
    } BFS_TRAVERSE_END(hierarchy);

    return 0;
}

/**
 * Traverse adjacent vector.
 * This function can be useful with edge fields,
 * field_lookup_traversable, and SelvaHierarchy_GetHierarchyField().
 * @param adj_vec can be children, parents, or an edge field arcs.
 */
static void SelvaHierarchy_TraverseAdjacents(
        struct SelvaHierarchy *hierarchy,
        enum SelvaHierarchyTraversalSVecPtag adj_tag,
        const SVector *adj_vec,
        const struct SelvaHierarchyCallback *cb) {
    struct SVectorIterator it;

    if (cb->node_cb) {
        const struct SelvaHierarchyTraversalMetadata metadata = {
            .origin_field_svec_tagp = PTAG(adj_vec, adj_tag),
        };
        SelvaHierarchyNode *node;

        SVector_ForeachBegin(&it, adj_vec);
        while ((node = SVector_Foreach(&it))) {
            Trx_Sync(&hierarchy->trx_state, &node->trx_label);

            /* RFE Should we also call child_cb? */
            if (cb->node_cb(hierarchy, &metadata, node, cb->node_arg)) {
                break;
            }
        }
    }
}

int SelvaHierarchy_TraverseEdgeField(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        const char *ref_field_str,
        size_t ref_field_len,
        const struct SelvaHierarchyCallback *cb) {
    struct SelvaHierarchyNode *head;
    const struct EdgeField *edge_field;

    head = SelvaHierarchy_FindNode(hierarchy, id);
    if (!head) {
        return SELVA_HIERARCHY_ENOENT;
    }

    Trx_Sync(&hierarchy->trx_state, &head->trx_label);

    if (cb->head_cb) {
        const struct SelvaHierarchyTraversalMetadata metadata = {};

        if (cb->head_cb(hierarchy, &metadata, head, cb->head_arg)) {
            return 0;
        }
    }

    if (cb->node_cb) {
        edge_field = Edge_GetField(head, ref_field_str, ref_field_len);
        if (edge_field) {
            SelvaHierarchy_TraverseAdjacents(hierarchy, SELVA_TRAVERSAL_SVECTOR_PTAG_EDGE, &edge_field->arcs, cb);
        }
    }

    return 0;
}

int SelvaHierarchy_TraverseEdgeFieldBfs(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        const char *field_name_str,
        size_t field_name_len,
        const struct SelvaHierarchyCallback *cb) {
    struct SelvaHierarchyNode *head;

    head = SelvaHierarchy_FindNode(hierarchy, id);
    if (!head) {
        return SELVA_HIERARCHY_ENOENT;
    }

    Trx_Sync(&hierarchy->trx_state, &head->trx_label);

    return bfs_edge(hierarchy, head, field_name_str, field_name_len, cb);
}

void SelvaHierarchy_TraverseChildren(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        const struct SelvaHierarchyCallback *cb) {
    if (cb->head_cb) {
        const struct SelvaHierarchyTraversalMetadata metadata = {};

        if (cb->head_cb(hierarchy, &metadata, node, cb->head_arg)) {
            return;
        }
    }

    SelvaHierarchy_TraverseAdjacents(hierarchy, SELVA_TRAVERSAL_SVECTOR_PTAG_CHILDREN, &node->children, cb);
}

void SelvaHierarchy_TraverseParents(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        const struct SelvaHierarchyCallback *cb) {
    if (cb->head_cb) {
        const struct SelvaHierarchyTraversalMetadata metadata = {};

        if (cb->head_cb(hierarchy, &metadata, node, cb->head_arg)) {
            return;
        }
    }

    SelvaHierarchy_TraverseAdjacents(hierarchy, SELVA_TRAVERSAL_SVECTOR_PTAG_PARENTS, &node->parents, cb);
}

struct pseudo_field_cb {
    SelvaHierarchyNodeCallback node_cb;
    void *node_arg;
    int skip;
};

/**
 * This is used to skip the first node with BFS ancestors/descendants traversal.
 */
static int pseudo_field_cb(
        struct SelvaHierarchy *hierarchy,
        const struct SelvaHierarchyTraversalMetadata *cb_metadata,
        struct SelvaHierarchyNode *node,
        void *arg) {
    struct pseudo_field_cb *cb = (struct pseudo_field_cb *)arg;

    if (likely(!cb->skip)) {
        return cb->node_cb(hierarchy, cb_metadata, node, cb->node_arg);
    } else {
        cb->skip = 0;
        return 0;
    }
}

int SelvaHierarchy_TraverseBFSAncestors(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        const struct SelvaHierarchyCallback *cb) {
    struct pseudo_field_cb data = {
        .node_cb = cb->node_cb,
        .node_arg = cb->node_arg,
        .skip = 1,
    };
    struct SelvaHierarchyCallback bfs_cb = {
        .node_cb = pseudo_field_cb,
        .node_arg = &data,
    };

    return bfs_ancestors(hierarchy, node, &bfs_cb);
}

int SelvaHierarchy_TraverseBFSDescendants(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        const struct SelvaHierarchyCallback *cb) {
    struct pseudo_field_cb data = {
        .node_cb = cb->node_cb,
        .node_arg = cb->node_arg,
        .skip = 1,
    };
    struct SelvaHierarchyCallback bfs_cb = {
        .node_cb = pseudo_field_cb,
        .node_arg = &data,
    };

    return bfs_descendants(hierarchy, node, &bfs_cb);
}

int SelvaHierarchy_Traverse(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        enum SelvaTraversal dir,
        const struct SelvaHierarchyCallback *cb) {
    SelvaHierarchyNode *head;
    int err = 0;

    if (dir == SELVA_HIERARCHY_TRAVERSAL_NONE) {
        return SELVA_HIERARCHY_EINVAL;
    }

    if (dir != SELVA_HIERARCHY_TRAVERSAL_DFS_FULL) {
        head = SelvaHierarchy_FindNode(hierarchy, id);
        if (!head) {
            return SELVA_HIERARCHY_ENOENT;
        }

        Trx_Sync(&hierarchy->trx_state, &head->trx_label);
    }

    switch (dir) {
    case SELVA_HIERARCHY_TRAVERSAL_NODE:
        cb->node_cb(hierarchy, &(const struct SelvaHierarchyTraversalMetadata){}, head, cb->node_arg);
        break;
    case SELVA_HIERARCHY_TRAVERSAL_CHILDREN:
        SelvaHierarchy_TraverseChildren(hierarchy, head, cb);
        break;
    case SELVA_HIERARCHY_TRAVERSAL_PARENTS:
        SelvaHierarchy_TraverseParents(hierarchy, head, cb);
        break;
    case SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS:
        err = bfs_ancestors(hierarchy, head, cb);
        break;
    case SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS:
        err = bfs_descendants(hierarchy, head, cb);
        break;
    case SELVA_HIERARCHY_TRAVERSAL_DFS_ANCESTORS:
        err = dfs(hierarchy, head, RELATIONSHIP_PARENT, cb);
        break;
     case SELVA_HIERARCHY_TRAVERSAL_DFS_DESCENDANTS:
        err = dfs(hierarchy, head, RELATIONSHIP_CHILD, cb);
        break;
     case SELVA_HIERARCHY_TRAVERSAL_DFS_FULL:
        err = full_dfs(hierarchy, cb);
        break;
     default:
        /* Should probably use some other traversal function. */
        SELVA_LOG(SELVA_LOGL_ERR, "Invalid or unsupported traversal requested (%d)",
                  (int)dir);
        err = SELVA_HIERARCHY_ENOTSUP;
    }

    return err;
}

int SelvaHierarchy_TraverseField2(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId node_id,
        const char *ref_field_str,
        size_t ref_field_len,
        const struct SelvaHierarchyCallback *hcb,
        const struct SelvaObjectArrayForeachCallback *acb) {
    struct SelvaHierarchyNode *head;
    struct field_lookup_traversable t;
    int err;

    head = SelvaHierarchy_FindNode(hierarchy, node_id);
    if (!head) {
        return SELVA_HIERARCHY_ENOENT;
    }

    if (hcb->head_cb) {
        const struct SelvaHierarchyTraversalMetadata metadata = {};

        if (hcb->head_cb(hierarchy, &metadata, head, hcb->head_arg)) {
            return 0;
        }
    }

    /*
     * Otherwise we need to get a traversable SVector field value.
     * TODO We ~~don't~~ know the node where t.vec comes from, so we don't do
     * Trx_Sync(). We probably would need it for some tracking purposes
     * like automatic compression.
     */
    err = field_lookup_traversable(head, ref_field_str, ref_field_len, &t);
    if (err) {
        return err;
    }

    if (t.type == SELVA_HIERARCHY_TRAVERSAL_CHILDREN) {
        assert(t.vec);

        SELVA_TRACE_BEGIN(traverse_children);
        SelvaHierarchy_TraverseAdjacents(hierarchy, SELVA_TRAVERSAL_SVECTOR_PTAG_CHILDREN, t.vec, hcb);
        SELVA_TRACE_END(traverse_children);
        return 0;
    } else if (t.type == SELVA_HIERARCHY_TRAVERSAL_PARENTS) {
        assert(t.vec);

        SELVA_TRACE_BEGIN(traverse_parents);
        SelvaHierarchy_TraverseAdjacents(hierarchy, SELVA_TRAVERSAL_SVECTOR_PTAG_PARENTS, t.vec, hcb);
        SELVA_TRACE_END(traverse_parents);
        return 0;
    } else if (t.type == SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD) {
        assert(t.vec);

        /* TODO Temp hack to prevent multi-hop derefs because we can't handle those in subscriptions. */
        if (t.hops > 1) {
            return SELVA_ENOTSUP;
        }

        SELVA_TRACE_BEGIN(traverse_edge_field);
        SelvaHierarchy_TraverseAdjacents(hierarchy, SELVA_TRAVERSAL_SVECTOR_PTAG_EDGE, t.vec, hcb);
        SELVA_TRACE_END(traverse_edge_field);
        return 0;
    } else if (t.type & SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS) {
        int res;

        SELVA_TRACE_BEGIN(traverse_bfs_ancestors);
        res = SelvaHierarchy_TraverseBFSAncestors(hierarchy, t.node, hcb);
        SELVA_TRACE_END(traverse_bfs_ancestors);

        return res;
    } else if (t.type & SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS) {
        int res;

        SELVA_TRACE_BEGIN(traverse_bfs_descendants);
        res = SelvaHierarchy_TraverseBFSDescendants(hierarchy, t.node, hcb);
        SELVA_TRACE_END(traverse_bfs_descendants);

        return res;
    } else if (t.type == SELVA_HIERARCHY_TRAVERSAL_ARRAY) {
        struct SVectorIterator it;

        assert(t.vec);

        if (!acb) {
            return SELVA_HIERARCHY_EINVAL;
        }

        SELVA_TRACE_BEGIN(traversal_array);

        /*
         * This code comes from selva_object_foreach.c
         */
        SVector_ForeachBegin(&it, t.vec);
        while (!SVector_Done(&it)) {
            union SelvaObjectArrayForeachValue v;

            v.obj = SVector_Foreach(&it);

            if (acb->cb(v, SELVA_OBJECT_OBJECT, acb->cb_arg)) {
                break;
            }
        }

        SELVA_TRACE_END(traversal_array);

        return 0;
    } else {
        return SELVA_HIERARCHY_ENOTSUP; /* Same as SelvaHierarchy_Traverse(). */
    }
}

int SelvaHierarchy_TraverseField2Bfs(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId node_id,
        const char *ref_field_str,
        size_t ref_field_len,
        const struct SelvaHierarchyCallback *hcb,
        const struct SelvaObjectArrayForeachCallback *acb) {
    struct SelvaHierarchyNode *head;

    head = SelvaHierarchy_FindNode(hierarchy, node_id);
    if (!head) {
        return SELVA_HIERARCHY_ENOENT;
    }

    BFS_TRAVERSE(hierarchy, head, hcb) {
        BFS_VISIT_NODE(hierarchy, hcb);

        struct field_lookup_traversable t;
        enum SelvaHierarchyTraversalSVecPtag adj_tag;
        SVector *adj_vec;
        struct SVectorIterator it;
        int err;

        err = field_lookup_traversable(node, ref_field_str, ref_field_len, &t);
        if (err == SELVA_ENOENT || err == SELVA_HIERARCHY_ENOENT) {
            continue;
        } else if (err) {
            SELVA_LOG(SELVA_LOGL_ERR, "err: %s", selva_strerror(err));
            Trx_End(&hierarchy->trx_state, &trx_cur);
            return err;
        }

        if (t.type & (SELVA_HIERARCHY_TRAVERSAL_CHILDREN |
                      SELVA_HIERARCHY_TRAVERSAL_PARENTS |
                      SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD)) {
            switch (t.type) {
            case SELVA_HIERARCHY_TRAVERSAL_CHILDREN:
                adj_tag = SELVA_TRAVERSAL_SVECTOR_PTAG_CHILDREN;
                break;
            case SELVA_HIERARCHY_TRAVERSAL_PARENTS:
                adj_tag = SELVA_TRAVERSAL_SVECTOR_PTAG_PARENTS;
                break;
            case SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD:
                adj_tag = SELVA_TRAVERSAL_SVECTOR_PTAG_EDGE;
                break;
            default:
                adj_tag = SELVA_TRAVERSAL_SVECTOR_PTAG_NONE;
                break;
            }
            adj_vec = t.vec;

            /* TODO Temp hack to prevent multi-hop derefs because we can't handle those in subscriptions. */
            if (t.type == SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD && t.hops > 1) {
                Trx_End(&hierarchy->trx_state, &trx_cur);
                return SELVA_ENOTSUP;
            }
        } else if (t.type & SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS) {
            adj_tag = SELVA_TRAVERSAL_SVECTOR_PTAG_PARENTS;
            adj_vec = &node->parents;
        } else if (t.type & SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS) {
            adj_tag = SELVA_TRAVERSAL_SVECTOR_PTAG_CHILDREN;
            adj_vec = &node->children;
        } else if (t.type == SELVA_HIERARCHY_TRAVERSAL_ARRAY) {
            adj_tag = SELVA_TRAVERSAL_SVECTOR_PTAG_NONE;

            if (acb) {
                assert(t.vec);
                /*
                 * This code comes from selva_object_foreach.c
                 */
                SVector_ForeachBegin(&it, t.vec);
                while (!SVector_Done(&it)) {
                    union SelvaObjectArrayForeachValue v;

                    v.obj = SVector_Foreach(&it);

                    if (acb->cb(v, SELVA_OBJECT_OBJECT, acb->cb_arg)) {
                        break;
                    }
                }
            }

            break;
        } else {
            adj_tag = SELVA_TRAVERSAL_SVECTOR_PTAG_NONE;
            SELVA_LOG(SELVA_LOGL_WARN, "Unsupported traversal: %d", t.type);
            break;
        }
        assert(adj_vec);

        SelvaHierarchyNode *adj;

        /* Visit each node in this field. */
        SVector_ForeachBegin(&it, adj_vec);
        while ((adj = SVector_Foreach(&it))) {
            BFS_VISIT_ADJACENT(hierarchy, hcb, adj_tag, adj_vec, adj);
        }
    } BFS_TRAVERSE_END(hierarchy);

    return 0;
}

int SelvaHierarchy_TraverseExpression(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        struct rpn_ctx *rpn_ctx,
        const struct rpn_expression *rpn_expr,
        struct rpn_ctx *edge_filter_ctx,
        const struct rpn_expression *edge_filter,
        const struct SelvaHierarchyCallback *cb) {
    SelvaHierarchyNode *head;
    struct trx trx_cur;
    enum rpn_error rpn_err;
    struct SelvaSet fields;
    struct SelvaSetElement *field_el;

    head = SelvaHierarchy_FindNode(hierarchy, id);
    if (!head) {
        return SELVA_HIERARCHY_ENOENT;
    }

    if (Trx_Begin(&hierarchy->trx_state, &trx_cur)) {
        return SELVA_HIERARCHY_ETRMAX;
    }

    SelvaSet_Init(&fields, SELVA_SET_TYPE_STRING);

    rpn_set_reg(rpn_ctx, 0, head->id, SELVA_NODE_ID_SIZE, RPN_SET_REG_FLAG_IS_NAN);
    rpn_ctx->data.hierarchy = hierarchy;
    rpn_ctx->data.node = head;
    rpn_ctx->data.obj = SelvaHierarchy_GetNodeObject(head);
    rpn_err = rpn_selvaset(rpn_ctx, rpn_expr, &fields);
    if (rpn_err) {
        Trx_End(&hierarchy->trx_state, &trx_cur);
        SELVA_LOG(SELVA_LOGL_ERR, "RPN field selector expression failed for %.*s: %s",
                  (int)SELVA_NODE_ID_SIZE, head->id,
                  rpn_str_error[rpn_err]);
        return SELVA_HIERARCHY_EINVAL;
    }

    /* For each field in the set. */
    SELVA_SET_STRING_FOREACH(field_el, &fields) {
        size_t field_len;
        const char *field_str = selva_string_to_str(field_el->value_string, &field_len);
        struct field_lookup_traversable t;
        struct SVectorIterator it;
        SelvaHierarchyNode *adj;
        int err;

        /* Get an SVector for the field. */
        err = field_lookup_traversable(head, field_str, field_len, &t);
        if (err || !t.vec) {
            /* RFE What if it's not ENOENT? */
            continue;
        }

        const struct SelvaHierarchyTraversalMetadata node_metadata = {
            .origin_field_svec_tagp = PTAG(t.vec, traversal2vec_tag(t.type)),
        };

        /* Visit each node in this field. */
        SVector_ForeachBegin(&it, t.vec);
        while ((adj = SVector_Foreach(&it))) {
            if (Trx_Visit(&trx_cur, &adj->trx_label)) {
                if (edge_filter) {
                    struct SelvaObject *edge_metadata = get_edge_metadata(adj, t.type, t.vec);

                    if (!exec_edge_filter(hierarchy, edge_filter_ctx, edge_filter, edge_metadata, adj)) {
                        continue;
                    }
                }

                if (cb->node_cb(hierarchy, &node_metadata, adj, cb->node_arg)) {
                    Trx_End(&hierarchy->trx_state, &trx_cur);
                    return 0;
                }
            }
        }
    }

    Trx_End(&hierarchy->trx_state, &trx_cur);
    return 0;
}

int SelvaHierarchy_TraverseExpressionBfs(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        struct rpn_ctx *rpn_ctx,
        const struct rpn_expression *rpn_expr,
        struct rpn_ctx *edge_filter_ctx,
        const struct rpn_expression *edge_filter,
        const struct SelvaHierarchyCallback *cb) {
    SelvaHierarchyNode *head;

    head = SelvaHierarchy_FindNode(hierarchy, id);
    if (!head) {
        return SELVA_HIERARCHY_ENOENT;
    }

    return bfs_expression(hierarchy, head, rpn_ctx, rpn_expr, edge_filter_ctx, edge_filter, cb);
}

int SelvaHierarchy_TraverseArray(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        const char *field_str,
        size_t field_len,
        const struct SelvaObjectArrayForeachCallback *cb) {
    struct SelvaHierarchyNode *head;

    head = SelvaHierarchy_FindNode(hierarchy, id);
    if (!head) {
        return SELVA_HIERARCHY_ENOENT;
    }

    Trx_Sync(&hierarchy->trx_state, &head->trx_label);

    return SelvaObject_ArrayForeach(GET_NODE_OBJ(head), field_str, field_len, cb);
}

int SelvaHierarchy_TraverseSet(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        const char *field_str,
        size_t field_len,
        const struct SelvaObjectSetForeachCallback *cb) {
    struct SelvaHierarchyNode *head;

    head = SelvaHierarchy_FindNode(hierarchy, id);
    if (!head) {
        return SELVA_HIERARCHY_ENOENT;
    }

    Trx_Sync(&hierarchy->trx_state, &head->trx_label);

    return SelvaObject_SetForeach(GET_NODE_OBJ(head), field_str, field_len, cb);
}

int SelvaHierarchy_IsNonEmptyField(const struct SelvaHierarchyNode *node, const char *field_str, size_t field_len) {
#define IS_FIELD(name) \
    (field_len == (sizeof(name) - 1) && !memcmp(name, field_str, sizeof(name) - 1))

    if (IS_FIELD(SELVA_PARENTS_FIELD) ||
        IS_FIELD(SELVA_ANCESTORS_FIELD)) {
        return SVector_Size(&node->parents) > 0;
    } else if (IS_FIELD(SELVA_CHILDREN_FIELD) ||
               IS_FIELD(SELVA_DESCENDANTS_FIELD)) {
        return SVector_Size(&node->children) > 0;
    } else if (field_len > 0) {
        /*
         * Check if field is an edge field name.
         */
        const struct EdgeField *edge_field;

        edge_field = Edge_GetField(node, field_str, field_len);
        if (!edge_field) {
            return 0;
        }

        return Edge_GetFieldLength(edge_field);
    }

    return 0;
#undef IS_FIELD
}

/**
 * DO NOT CALL DIRECTLY. USE verifyDetachableSubtree().
 */
static int verifyDetachableSubtreeNodeCb(
        struct SelvaHierarchy *hierarchy __unused,
        const struct SelvaHierarchyTraversalMetadata *,
        struct SelvaHierarchyNode *node,
        void *arg) {
    struct verifyDetachableSubtree *data = (struct verifyDetachableSubtree *)arg;
    struct SVectorIterator it;
    const SelvaHierarchyNode *parent;

    /*
     * If edges from other nodes are pointing to this node, we want to
     * verify it later that all those edges are within the subtree.
     */
    if (Edge_Usage(node) & 2) {
        struct SelvaObject *origins = node->metadata.edge_fields.origins;
        SelvaObject_Iterator *it;
        const char *origin;

        it = SelvaObject_ForeachBegin(origins);
        while ((origin = SelvaObject_ForeachKey(origins, &it))) {
            Selva_NodeId origin_id;

            Selva_NodeIdCpy(origin_id, origin);
            SelvaSet_Add(&data->edge_origin_node_ids, origin_id);
        }
    }

    /*
     * Check that there are no active subscription markers on the node.
     * Subs starting from root can be ignored.
     */
    if (SelvaSubscriptions_hasActiveMarkers(&node->metadata)) {
        data->err = "markers";
        return 1;
    }

    /*
     * A subtree is allowed be a acyclic but `node` must be its true parent,
     * i.e. the whole subtree has only a single root node that is `node`.
     */
    SVector_ForeachBegin(&it, &node->parents);
    if (node != data->head) {
        while ((parent = SVector_Foreach(&it))) {
            if (!Trx_HasVisited(&data->trx_cur, &parent->trx_label)) {
                data->err = "not_tree";
                return 1; /* not a proper subtree. */
            }
        }
    }

    Trx_Visit(&data->trx_cur, &node->trx_label);

    return 0;
}

/**
 * Verify that the children of node can be safely detached.
 * Detachable subtree is subnetwork that the descendants of node can be safely
 * removed from the hierarchy, serialized and freed from memory.
 * This function checks that the children of node form a proper subtree that
 * and there are no active subscription markers or other live dependencies on
 * any of the nodes.
 * @return 0 is returned if the subtree is detachable;
 *         Otherwise a SelvaError is returned.
 */
static int verifyDetachableSubtree(struct SelvaHierarchy *hierarchy, struct SelvaHierarchyNode *node) {
    struct trx_state * restrict trx_state = &hierarchy->trx_state;
    struct verifyDetachableSubtree data = {
        .err = NULL,
        .head = node,
    };
    const struct SelvaHierarchyCallback cb = {
        .head_cb = NULL,
        .head_arg = NULL,
        .node_cb = verifyDetachableSubtreeNodeCb,
        .node_arg = &data,
        .child_cb = NULL,
        .child_arg = NULL,
    };
    int err;

    if (!Trx_Fin(trx_state)) {
        SELVA_LOG(SELVA_LOGL_ERR, "Cannot compress a subtree of the node %.*s while another transaction is being executed",
                  (int)SELVA_NODE_ID_SIZE, node->id);
        return SELVA_HIERARCHY_ETRMAX;
    }

    if (Trx_Begin(trx_state, &data.trx_cur)) {
        return SELVA_HIERARCHY_ETRMAX;
    }
    SelvaSet_Init(&data.edge_origin_node_ids, SELVA_SET_TYPE_NODEID);

    err = bfs_descendants(hierarchy, node, &cb);
    if (!err && data.err) {
        err = SELVA_HIERARCHY_ENOTSUP;
    }

    /*
     * Verify that all edge sources were visited by the traversal.
     * TODO It would be good to allow referenced nodes that are not
     * children in the subtree but still contained within the subgraph.
     */
    if (!err && SelvaSet_Size(&data.edge_origin_node_ids) > 0) {
        struct SelvaSetElement *el;

        SELVA_SET_NODEID_FOREACH(el, &data.edge_origin_node_ids) {
            SelvaHierarchyNode *node;

            node = find_node_index(hierarchy, el->value_nodeId);
            if (!node ||
                node->trx_label.id != data.trx_cur.id ||
                ((data.trx_cur.cl << 1) & node->trx_label.cl) == 0) {
                err = SELVA_HIERARCHY_ENOTSUP;
            }
        }
    }

    SelvaSet_Destroy(&data.edge_origin_node_ids);
    Trx_End(trx_state, &data.trx_cur);

    return err;
}

/**
 * Compress a subtree using DFS starting from node.
 * @returns The compressed tree is returned as a compressed selva_string.
 */
static struct selva_string *compress_subtree(SelvaHierarchy *hierarchy, struct SelvaHierarchyNode *node) {
    int err;

    err = verifyDetachableSubtree(hierarchy, node);
    if (err) {
        /* Not a valid subtree. */
        SELVA_LOG(SELVA_LOGL_DBG, "%.*s is not a valid subtree for compression: %s",
                  (int)SELVA_NODE_ID_SIZE, node->id,
                  selva_strerror(err));

        return NULL;
    }


    return Hierarchy_SubtreeSave(hierarchy, node);
}

static int detach_subtree(SelvaHierarchy *hierarchy, struct SelvaHierarchyNode *node, enum SelvaHierarchyDetachedType type) {
    Selva_NodeId node_id;
    Selva_NodeId *parents = NULL;
    const size_t nr_parents = SVector_Size(&node->parents);
    void *tag_compressed;
    int err;

    if (!memcmp(node->id, ROOT_NODE_ID, SELVA_NODE_ID_SIZE)) {
        return SELVA_HIERARCHY_ENOTSUP;
    }

    if (node->flags & SELVA_NODE_FLAGS_DETACHED) {
        SELVA_LOG(SELVA_LOGL_ERR, "Node already detached: %.*s",
                  (int)SELVA_NODE_ID_SIZE, node->id);
        return SELVA_HIERARCHY_EINVAL;
    }

    if (nr_parents > 0) {
        parents = alloca(nr_parents * SELVA_NODE_ID_SIZE);
        copy_nodeIds(parents, &node->parents);
    }

    memcpy(node_id, node->id, SELVA_NODE_ID_SIZE);
    tag_compressed = SelvaHierarchyDetached_Store(
            node_id,
            compress_subtree(hierarchy, node),
            type);
    if (!tag_compressed) {
        return SELVA_HIERARCHY_EGENERAL;
    }

    /*
     * Now delete the compressed nodes.
     */
    err = SelvaHierarchy_DelNodeP(
            NULL, hierarchy, node,
            DEL_HIERARCHY_NODE_FORCE | DEL_HIERARCHY_NODE_DETACH,
            tag_compressed);
    err = err < 0 ? err : 0;
    node = NULL;
    /*
     * Note that `compressed` must not be freed as it's actually stored now in
     * the detached hierarchy for now.
     */

    /*
     * Create a new dummy node with the detached flag set.
     */
    new_detached_node(hierarchy, node_id, parents, nr_parents);

    if (!err) {
        SELVA_LOG(SELVA_LOGL_DBG,
                  "Compressed and detached the subtree of %.*s",
                  (int)SELVA_NODE_ID_SIZE, node_id);
    }

    return err;
}

static int restore_compressed_subtree(SelvaHierarchy *hierarchy, struct selva_string *compressed) {
    isDecompressingSubtree = 1;
    Hierarchy_SubtreeLoad(hierarchy, compressed);
    isDecompressingSubtree = 0;

    return 0;
}

/**
 * Restore a compressed subtree back to hierarchy from the detached hierarchy subtree storage.
 * @param id can be the id of any node within a compressed subtree.
 * @returns SELVA_ENOENT if id is not a member of any detached subtree.
 */
static int restore_subtree(SelvaHierarchy *hierarchy, const Selva_NodeId id) {
    struct selva_string *compressed;
    int err;

    SELVA_TRACE_BEGIN(restore_subtree);

    err = SelvaHierarchyDetached_Get(hierarchy, id, &compressed, NULL);
    if (!err) {
        err = restore_compressed_subtree(hierarchy, compressed);
        if (!err) {
            selva_string_free(compressed);
        }
    }

    SELVA_TRACE_END(restore_subtree);

    SELVA_LOG(SELVA_LOGL_DBG, "Restored the subtree of %.*s",
              (int)SELVA_NODE_ID_SIZE, id);

    return err;
}

static void auto_compress_proc(struct event *, void *data) {
    static struct backoff_timeout backoff;
    struct timespec timeout;
    SelvaHierarchy *hierarchy = (struct SelvaHierarchy *)data;

    if (selva_server_is_query_fork()) {
        /* Never do auto compression in a query_fork. */
        return;
    }

    SELVA_TRACE_BEGIN_AUTO(auto_compress_proc);

    if (unlikely(backoff.factor == 0.0)) {
        backoff.t_min = (double)selva_glob_config.hierarchy_auto_compress_period_ms,
        backoff.t_max = (double)(selva_glob_config.hierarchy_auto_compress_period_ms + 300),
        backoff.factor = 1.5;
        backoff_timeout_init(&backoff);
    }

    /*
     * We can't run this if a backup is still running because we share the
     * inactive nodes data structure with the backup process.
     */
    if (selva_io_get_dump_state() == SELVA_DB_DUMP_NONE) {
        HIERARCHY_INACTIVE_FOREACH(hierarchy) {
            const char *node_id = HIERARCHY_INACTIVE_FOREACH_NODE_ID;
            struct SelvaHierarchyNode *node;

            node = find_node_index(hierarchy, node_id);
            if (!node || node->flags & SELVA_NODE_FLAGS_DETACHED) {
                /* This should be unlikely to occur at this point. */
                SELVA_LOG(SELVA_LOGL_DBG, "Ignoring (%p) %.*s",
                          node, (int)SELVA_NODE_ID_SIZE, node_id);
                continue;
            }

            /*
             * Note that calling detach_subtree() should also update the trx
             * struct, meaning that in case detaching the node fails, we
             * still won't see it here again any time soon.
             */
            (void)detach_subtree(hierarchy, node, SELVA_HIERARCHY_DETACHED_COMPRESSED_MEM);
        }

        SelvaHierarchy_ClearInactiveNodeIds(hierarchy);
        backoff.attempt = 0;
    }

    backoff_timeout_next(&backoff, &timeout);
    hierarchy->inactive.auto_compress_timer = evl_set_timeout(&timeout, auto_compress_proc, hierarchy);
    if (hierarchy->inactive.auto_compress_timer < 0) {
        SELVA_LOG(SELVA_LOGL_ERR, "Failed to setup a timer for auto compression: %s",
                  selva_strerror(hierarchy->inactive.auto_compress_timer));
    }
}

static int load_metadata(struct selva_io *io, int encver, SelvaHierarchy *hierarchy, SelvaHierarchyNode *node) {
    int err;

    if (unlikely(!node)) {
        return SELVA_EINVAL;
    }

    /*
     * Note that the metadata must be loaded and saved in predefined order.
     * See save_metadata() for the right order.
     */

    err = Edge_Load(io, encver, hierarchy, node);
    if (err) {
        return err;
    }

    /*
     * node object is currently empty because it's not created when
     * isLoading() is true.
     */
    if (!SelvaObjectTypeLoadTo(io, encver, SelvaObject_Init(node->_obj_data), NULL)) {
        return SELVA_ENOENT;
    }

    return 0;
}

/**
 * Load a node_id.
 * Should be only called by load_node().
 */
static int load_node_id(struct selva_io *io, Selva_NodeId node_id_out) {
    __selva_autofree const char *node_id = NULL;
    size_t len = 0;

    node_id = selva_io_load_str(io, &len);
    if (!node_id || len != SELVA_NODE_ID_SIZE) {
        return SELVA_HIERARCHY_EINVAL;
    }

    memcpy(node_id_out, node_id, SELVA_NODE_ID_SIZE);
    return 0;
}

static int load_detached_node(struct selva_io *io, SelvaHierarchy *hierarchy, Selva_NodeId node_id) {
    enum SelvaHierarchyDetachedType type;
    struct selva_string *compressed;
    SelvaHierarchyNode *node;
    int err;

    type = selva_io_load_signed(io);
    compressed = selva_io_load_string(io);
    selva_string_set_compress(compressed);

    /*
     * It would be cleaner and faster to just attach this node as detached and
     * compressed directly but we don't know the nodeIds inside this compressed
     * subtree and thus can't add them to the detached hierarchy structure. We
     * could save that information separately but at the moment we don't, and
     * therefore it's easier, albeit time and memory intensive, to restore the
     * subtree first and detach it again.
     */

    err = restore_compressed_subtree(hierarchy, compressed);
    if (err) {
        goto out;
    }

    node = SelvaHierarchy_FindNode(hierarchy, node_id);
    if (!node) {
        err = SELVA_HIERARCHY_ENOENT;
        goto out;
    }

    err = detach_subtree(hierarchy, node, type);

out:
    selva_string_free(compressed);
    return err;
}

static int load_hierarchy_node(struct finalizer *fin, struct selva_io *io, int encver, SelvaHierarchy *hierarchy, SelvaHierarchyNode *node) {
    int err;

    /*
     * The node metadata comes right after the node_id and flags.
     */
    err = load_metadata(io, encver, hierarchy, node);
    if (err) {
        SELVA_LOG(SELVA_LOGL_CRIT, "Failed to load hierarchy node (%.*s) metadata: %s",
                  (int)SELVA_NODE_ID_SIZE, node->id,
                  selva_strerror(err));
        return err;
    }

    /*
     * Load the ids of child nodes.
     */
    uint64_t nr_children = selva_io_load_unsigned(io);
    Selva_NodeId *children __selva_autofree = NULL;

    if (nr_children > 0) {
        children = selva_malloc(nr_children * SELVA_NODE_ID_SIZE);

        /* Create/Update children */
        for (uint64_t i = 0; i < nr_children; i++) {
            Selva_NodeId child_id;

            err = load_node_id(io, child_id);
            if (err) {
                SELVA_LOG(SELVA_LOGL_CRIT, "Invalid child node_id: %s",
                          selva_strerror(err));
                return err;
            }

            if (isDecompressingSubtree) {
                SelvaHierarchyDetached_RemoveNode(fin, hierarchy, child_id);
            }

            err = SelvaModify_AddHierarchy(hierarchy, child_id, 0, NULL, 0, NULL);
            if (err < 0) {
                SELVA_LOG(SELVA_LOGL_CRIT, "Unable to rebuild the hierarchy: %s",
                          selva_strerror(err));
                return err;
            }

            memcpy(children + i, child_id, SELVA_NODE_ID_SIZE);
        }
    }

    /*
     * Insert children of the node.
     */
    err = SelvaModify_AddHierarchyP(hierarchy, node, 0, NULL, nr_children, children);
    if (err < 0) {
        SELVA_LOG(SELVA_LOGL_CRIT, "Unable to rebuild the hierarchy: %s",
                  selva_strerror(err));
        return err;
    }

    return 0;
}

/**
 * Load a node and its children.
 * Should be only called by load_tree().
 */
static int load_node(struct finalizer *fin, struct selva_io *io, int encver, SelvaHierarchy *hierarchy, Selva_NodeId node_id) {
    SelvaHierarchyNode *node;
    int err;

    if (isDecompressingSubtree) {
        SelvaHierarchyDetached_RemoveNode(fin, hierarchy, node_id);
    }

    /*
     * Upsert the node.
     */
    err = SelvaHierarchy_UpsertNode(hierarchy, node_id, &node);
    if (err && err != SELVA_HIERARCHY_EEXIST) {
        SELVA_LOG(SELVA_LOGL_CRIT, "Failed to upsert %.*s: %s",
                  (int)SELVA_NODE_ID_SIZE, node_id,
                  selva_strerror(err));
        return err;
    }

    node->flags = selva_io_load_unsigned(io);
    node->expire = selva_io_load_unsigned(io);

    if ((node->flags & SELVA_NODE_FLAGS_DETACHED) && !isDecompressingSubtree) {
        /*
         * This node and its subtree was compressed.
         * In this case we are supposed to load the subtree as detached and
         * keep it compressed.
         * SELVA_NODE_FLAGS_DETACHED should never be set if
         * isDecompressingSubtree is set but the code looks cleaner this way.
         */
        err = load_detached_node(io, hierarchy, node_id);
    } else {
        err = load_hierarchy_node(fin, io, encver, hierarchy, node);
    }

    return err;
}

/**
 * Load a node hierarchy from io.
 * NODE_ID1 | FLAGS | METADATA | NR_CHILDREN | CHILD_ID_0,..
 * NODE_ID2 | FLAGS | METADATA | NR_CHILDREN | ...
 * HIERARCHY_SERIALIZATION_EOF
 */
static int load_tree(struct finalizer *fin, struct selva_io *io, int encver, SelvaHierarchy *hierarchy) {
    while (1) {
        Selva_NodeId node_id;
        int err;

        err = load_node_id(io, node_id);
        if (err) {
            SELVA_LOG(SELVA_LOGL_CRIT, "Failed to load the next nodeId: %s",
                      selva_strerror(err));
            return SELVA_HIERARCHY_EINVAL;
        }

        /*
         * If it's EOF there are no more nodes for this hierarchy.
         */
        if (!memcmp(node_id, HIERARCHY_SERIALIZATION_EOF, SELVA_NODE_ID_SIZE)) {
            break;
        }

        err = load_node(fin, io, encver, hierarchy, node_id);
        if (err) {
            return err;
        }
    }

    return 0;
}

static int load_aliases(struct selva_io *io,int encver, SelvaHierarchy *hierarchy) {
    struct SelvaObject *aliases = GET_STATIC_SELVA_OBJECT(&hierarchy->aliases);

    return SelvaObjectTypeLoadTo(io, encver, aliases, NULL) ? 0 : SELVA_HIERARCHY_EINVAL;
}

SelvaHierarchy *Hierarchy_Load(struct selva_io *io) {
    __auto_finalizer struct finalizer fin;
    SelvaHierarchy *hierarchy = NULL;
    int encver;
    int err;

    finalizer_init(&fin);

    flag_isLoading = 1;

    encver = selva_io_load_signed(io);
    if (encver > HIERARCHY_ENCODING_VERSION) {
        SELVA_LOG(SELVA_LOGL_CRIT, "selva_hierarchy encoding version %d not supported", encver);
        err = SELVA_HIERARCHY_EINVAL;
        goto error;
    }

    hierarchy = SelvaModify_NewHierarchy();
    if (!hierarchy) {
        SELVA_LOG(SELVA_LOGL_CRIT, "Failed to create a new hierarchy");
        err = SELVA_HIERARCHY_ENOMEM;
        goto error;
    }

    if (!SelvaObjectTypeLoadTo(io, encver, SELVA_HIERARCHY_GET_TYPES_OBJ(hierarchy), NULL)) {
        SELVA_LOG(SELVA_LOGL_CRIT, "Failed to node types");
        err = SELVA_HIERARCHY_EINVAL;
        goto error;
    }

    err = EdgeConstraint_Load(io, encver, &hierarchy->edge_field_constraints);
    if (err) {
        SELVA_LOG(SELVA_LOGL_CRIT, "Failed to load the dynamic constraints: %s",
                  selva_strerror(err));
        goto error;
    }

    err = load_tree(&fin, io, encver, hierarchy);
    if (err) {
        goto error;
    }

    err = load_aliases(io, encver, hierarchy);
    if (err) {
        goto error;
    }

    flag_isLoading = 0;
    return hierarchy;
error:
    if (hierarchy) {
        SelvaModify_DestroyHierarchy(hierarchy);
    }

    flag_isLoading = 0;
    return NULL;
}

static void save_detached_node(struct selva_io *io, SelvaHierarchy *hierarchy, const Selva_NodeId id) {
    struct selva_string *compressed;
    enum SelvaHierarchyDetachedType type;
    int err;

    /*
     * Technically we point to the same compressed subtree multiple times in the
     * detached hierarchy. However, we should only point to it once in the
     * actual hierarchy as these are proper subtrees. This means that we'll only
     * store the compressed subtree once. The down side is that the only way to
     * rebuild the SelvaHierarchyDetached structure is by decompressing the
     * subtrees temporarily.
     */

    err = SelvaHierarchyDetached_Get(hierarchy, id, &compressed, &type);
    if (err) {
        SELVA_LOG(SELVA_LOGL_CRIT, "Failed to save a compressed subtree: %s",
                  selva_strerror(err));
        return;
    }

    selva_io_save_signed(io, type);
    selva_io_save_string(io, compressed);
}

static void save_metadata(struct selva_io *io, SelvaHierarchyNode *node) {
    /*
     * Note that the metadata must be loaded and saved in a predefined order.
     */

    Edge_Save(io, node);
    SelvaObjectTypeSave(io, GET_NODE_OBJ(node), NULL);
}

/**
 * Save a node.
 * Used by Hierarchy_Save() when doing a dump.
 */
static int HierarchySaveNode(
        struct SelvaHierarchy *hierarchy,
        const struct SelvaHierarchyTraversalMetadata *,
        struct SelvaHierarchyNode *node,
        void *arg) {
    struct HierarchySaveNode *args = (struct HierarchySaveNode *)arg;
    struct selva_io *io = args->io;

    selva_io_save_str(io, node->id, SELVA_NODE_ID_SIZE);
    selva_io_save_unsigned(io, node->flags);
    selva_io_save_unsigned(io, node->expire);

    if (node->flags & SELVA_NODE_FLAGS_DETACHED) {
        save_detached_node(io, hierarchy, node->id);
    } else {
        save_metadata(io, node);
        selva_io_save_unsigned(io, SVector_Size(&node->children));
    }

    return 0;
}

/**
 * Save a node from a subtree.
 * Used by Hierarchy_SubtreeSave() when saving a subtree into a string.
 * This function should match with HierarchySaveNode() but we don't want
 * to do save_detached() here.
 */
static int HierarchySaveSubtreeNode(
        struct SelvaHierarchy *hierarchy __unused,
        const struct SelvaHierarchyTraversalMetadata *,
        struct SelvaHierarchyNode *node,
        void *arg) {
    struct selva_io *io = (struct selva_io *)arg;

    selva_io_save_str(io, node->id, SELVA_NODE_ID_SIZE);
    selva_io_save_unsigned(io, node->flags & ~SELVA_NODE_FLAGS_DETACHED);
    selva_io_save_unsigned(io, node->expire);
    save_metadata(io, node);
    selva_io_save_unsigned(io, SVector_Size(&node->children));

    return 0;
}

static int HierarchySaveChild(
        struct SelvaHierarchy *hierarchy __unused,
        const struct SelvaHierarchyTraversalMetadata *,
        struct SelvaHierarchyNode *child,
        void *arg) {
    struct selva_io *io = (struct selva_io *)arg;

    /*
     * We don't need to care here whether the node is detached because the
     * node callback is the only callback touching the node data. Here we
     * are only interested in saving the child ids.
     */

    selva_io_save_str(io, child->id, SELVA_NODE_ID_SIZE);

    return 0;
}

static void save_hierarchy(struct selva_io *io, SelvaHierarchy *hierarchy) {
    struct HierarchySaveNode args = {
        .io = io,
    };
    const struct SelvaHierarchyCallback cb = {
        .head_cb = NULL,
        .head_arg = NULL,
        .node_cb = HierarchySaveNode,
        .node_arg = &args,
        .child_cb = HierarchySaveChild,
        .child_arg = io,
        .flags = SELVA_HIERARCHY_CALLBACK_FLAGS_INHIBIT_RESTORE,
    };

    (void)full_dfs(hierarchy, &cb);
    selva_io_save_str(io, HIERARCHY_SERIALIZATION_EOF, sizeof(HIERARCHY_SERIALIZATION_EOF));
}

static void save_aliases(struct selva_io *io, SelvaHierarchy *hierarchy) {
    struct SelvaObject *aliases = GET_STATIC_SELVA_OBJECT(&hierarchy->aliases);

    SelvaObjectTypeSave(io, aliases, NULL);
}

void Hierarchy_Save(struct selva_io *io, SelvaHierarchy *hierarchy) {
    /*
     * Serialization format:
     * ENCVER
     * TYPE_MAP
     * EDGE_CONSTRAINTS
     * NODE_ID1 | FLAGS | METADATA | NR_CHILDREN | CHILD_ID_0,..
     * NODE_ID2 | FLAGS | METADATA | NR_CHILDREN | ...
     * HIERARCHY_SERIALIZATION_EOF
     * ALIASES
     */
    hierarchy->flag_isSaving = 1;
    selva_io_save_signed(io, HIERARCHY_ENCODING_VERSION);
    SelvaObjectTypeSave(io, SELVA_HIERARCHY_GET_TYPES_OBJ(hierarchy), NULL);
    EdgeConstraint_Save(io, &hierarchy->edge_field_constraints);
    save_hierarchy(io, hierarchy);
    save_aliases(io, hierarchy);
    hierarchy->flag_isSaving = 0;
}

static int load_nodeId(struct selva_io *io, Selva_NodeId nodeId) {
    __selva_autofree const char *buf = NULL;
    size_t len;

    buf = selva_io_load_str(io, &len);
    if (!buf || len != SELVA_NODE_ID_SIZE) {
        return SELVA_HIERARCHY_EINVAL;
    }

    memcpy(nodeId, buf, SELVA_NODE_ID_SIZE);
    return 0;
}

/**
 * Load a subtree from the serialization format back into the hierarchy.
 * This function should never be called directly.
 */
static void Hierarchy_SubtreeLoad(SelvaHierarchy *hierarchy, struct selva_string *s) {
    __auto_finalizer struct finalizer fin;
    struct selva_io io;
    Selva_NodeId nodeId;
    int encver, err;

    finalizer_init(&fin);
    selva_io_init_string_read(&io, s, 0);

    /*
     * 1. Load encoding version
     * 2. Read nodeId
     * 3. Load the children normally
     */

    encver = selva_io_load_signed(&io);
    if (encver > HIERARCHY_ENCODING_VERSION) {
        SELVA_LOG(SELVA_LOGL_CRIT, "selva_hierarchy encoding version %d not supported", encver);
        return;
    }

    /*
     * Read nodeId.
     */
    if (load_nodeId(&io, nodeId)) {
        return;
    }

    SelvaHierarchyDetached_RemoveNode(&fin, hierarchy, nodeId);

    err = load_tree(&fin, &io, encver, hierarchy);
    if (err) {
        return;
    }

    selva_io_end(&io);
}

/**
 * Serialize a subtree of a hierarchy.
 */
static struct selva_string *Hierarchy_SubtreeSave(SelvaHierarchy *hierarchy, struct SelvaHierarchyNode *node) {
    struct selva_io io;
    struct selva_string *raw = selva_io_init_string_write(&io, SELVA_IO_FLAGS_COMPRESSED);
    const struct SelvaHierarchyCallback cb = {
        .head_cb = NULL,
        .head_arg = NULL,
        .node_cb = HierarchySaveSubtreeNode,
        .node_arg = &io,
        .child_cb = HierarchySaveChild,
        .child_arg = &io,
    };

    /*
     * Save encoding version.
     * This needs to be stored separately because we need to be able to read
     * compressed subtrees from the disk and those files don't contain the
     * encoding version and Redis gives us version 0 on read.
     */
    selva_io_save_signed(&io, HIERARCHY_ENCODING_VERSION);

    /* Save nodeId. */
    selva_io_save_str(&io, node->id, SELVA_NODE_ID_SIZE);

    /*
     * Save the children.
     */
    (void)dfs(hierarchy, node, RELATIONSHIP_CHILD, &cb);
    selva_io_save_str(&io, HIERARCHY_SERIALIZATION_EOF, sizeof(HIERARCHY_SERIALIZATION_EOF));

    selva_io_end(&io);

    return raw;
}

/*
 * HIERARCHY.DEL FLAGS [NODE_ID1[, NODE_ID2, ...]]
 * If no NODE_IDs are given then nothing will be deleted.
 */
static void SelvaHierarchy_DelNodeCommand(struct selva_server_response_out *resp, const void *buf, size_t len) {
    SelvaHierarchy *hierarchy = main_hierarchy;
    __auto_finalizer struct finalizer fin;
    struct selva_string **argv;
    int argc;

    finalizer_init(&fin);

    const int ARGV_FLAGS     = 0;
    const int ARGV_NODE_IDS  = 1;

    argc = selva_proto_buf2strings(&fin, buf, len, &argv);
    if (argc < 2) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    size_t flags_len;
    const char *flags_str = selva_string_to_str(argv[ARGV_FLAGS], &flags_len);
    enum SelvaModify_DelHierarchyNodeFlag flags = 0;

    for (size_t i = 0; i < flags_len; i++) {
        flags |= flags_str[i] == 'F' ? DEL_HIERARCHY_NODE_FORCE : 0;
        flags |= flags_str[i] == 'I' ? DEL_HIERARCHY_NODE_REPLY_IDS : 0;
    }

    if ((flags & DEL_HIERARCHY_NODE_REPLY_IDS) != 0) {
        selva_send_array(resp, -1);
    }

    long long nr_deleted = 0;
    for (int i = ARGV_NODE_IDS; i < argc; i++) {
        Selva_NodeId nodeId;
        int res;

        selva_string2node_id(nodeId, argv[i]);
        res = SelvaHierarchy_DelNode(resp, hierarchy, nodeId, flags);
        if (res >= 0) {
            nr_deleted += res;
        } else {
            /* TODO How to handle the error correctly? */
            /* DEL_HIERARCHY_NODE_REPLY_IDS would allow us to send errors. */
            if (res != SELVA_HIERARCHY_ENOENT) {
                SELVA_LOG(SELVA_LOGL_ERR, "Failed to delete the node %.*s. err: \"%s\"",
                          (int)SELVA_NODE_ID_SIZE, nodeId,
                          selva_strerror(res));
            }
        }
    }

    if ((flags & DEL_HIERARCHY_NODE_REPLY_IDS) != 0) {
        selva_send_array_end(resp);
    } else {
        selva_send_ll(resp, nr_deleted);
    }

    if (nr_deleted > 0) {
        selva_io_set_dirty();
        selva_replication_replicate(selva_resp_to_ts(resp), selva_resp_to_cmd_id(resp), buf, len);
    }
    SelvaSubscriptions_SendDeferredEvents(hierarchy);
}

/*
 * HIERARCHY.EXPIRE NODE_ID1 TS
 */
static void SelvaHierarchy_ExpireCommand(struct selva_server_response_out *resp, const void *buf, size_t len) {
    SelvaHierarchy *hierarchy = main_hierarchy;
    Selva_NodeId nodeId;
    uint32_t prev, expire = 0;
    int argc;

    argc = selva_proto_scanf(NULL, buf, len, "%" SELVA_SCA_NODE_ID ", %" PRIu32, nodeId, &expire);
    if (argc != 1 && argc != 2) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    /*
     * Find the node.
     */
    SelvaHierarchyNode *node = SelvaHierarchy_FindNode(hierarchy, nodeId);
    if (!node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    prev = node->expire;
    if (argc == 2) {
        hierarchy_set_expire(hierarchy, node, expire);
        selva_replication_replicate(selva_resp_to_ts(resp), selva_resp_to_cmd_id(resp), buf, len);
    }

    selva_send_ll(resp, prev);
}

static void SelvaHierarchy_HeadsCommand(struct selva_server_response_out *resp, const void *buf __unused, size_t len) {
    SelvaHierarchy *hierarchy = main_hierarchy;

    if (len != 0) {
        selva_send_error_arity(resp);
        return;
    }

    struct SVectorIterator it;
    const SelvaHierarchyNode *node;

    selva_send_array(resp, SVector_Size(&hierarchy->heads));

    SVector_ForeachBegin(&it, &hierarchy->heads);
    while ((node = SVector_Foreach(&it))) {
        selva_send_str(resp, node->id, Selva_NodeIdLen(node->id));
    }
}

static void SelvaHierarchy_ParentsCommand(struct selva_server_response_out *resp, const void *buf, size_t len) {
    SelvaHierarchy *hierarchy = main_hierarchy;
    Selva_NodeId nodeId;
    int argc;

    argc = selva_proto_scanf(NULL, buf, len, "%" SELVA_SCA_NODE_ID, nodeId);
    if (argc != 1) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    /*
     * Find the node.
     */
    const SelvaHierarchyNode *node = SelvaHierarchy_FindNode(hierarchy, nodeId);
    if (!node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    struct SVectorIterator it;
    const SelvaHierarchyNode *parent;
    const SVector *parents = &node->parents;

    selva_send_array(resp, SVector_Size(parents));

    SVector_ForeachBegin(&it, parents);
    while ((parent = SVector_Foreach(&it))) {
        selva_send_str(resp, parent->id, Selva_NodeIdLen(parent->id));
    }
}

static void SelvaHierarchy_ChildrenCommand(struct selva_server_response_out *resp, const void *buf, size_t len) {
    SelvaHierarchy *hierarchy = main_hierarchy;
    Selva_NodeId nodeId;
    int argc;

    argc = selva_proto_scanf(NULL, buf, len, "%" SELVA_SCA_NODE_ID, nodeId);
    if (argc != 1) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    /*
     * Find the node.
     */
    const SelvaHierarchyNode *node = SelvaHierarchy_FindNode(hierarchy, nodeId);
    if (!node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    selva_send_array(resp, SVector_Size(&node->children));

    struct SVectorIterator it;
    const SelvaHierarchyNode *child;

    SVector_ForeachBegin(&it, &node->children);
    while((child = SVector_Foreach(&it))) {
        selva_send_str(resp, child->id, Selva_NodeIdLen(child->id));
    }
}

static void SelvaHierarchy_EdgeListCommand(struct selva_server_response_out *resp, const void *buf, size_t len) {
    SelvaHierarchy *hierarchy = main_hierarchy;
    Selva_NodeId nodeId;
    const char *key_name_str = NULL;
    size_t key_name_len = 0;
    int argc;

    argc = selva_proto_scanf(NULL, buf, len, "%" SELVA_SCA_NODE_ID ", %.*s",
                             nodeId,
                             &key_name_len, &key_name_str);
    if (argc < 0) {
        selva_send_errorf(resp, argc, "Failed to parse args");
        return;
    } else if (argc != 1 && argc != 2) {
        selva_send_error_arity(resp);
        return;
    }

    /*
     * Find the node.
     */
    SelvaHierarchyNode *node = SelvaHierarchy_FindNode(hierarchy, nodeId);
    if (!node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    struct SelvaObject *obj = node->metadata.edge_fields.edges;

    if (!obj) {
        /* No custom edges set. */
        selva_send_array(resp, 0);
        return;
    }

    if (key_name_len) {
        int err;

        err = SelvaObject_GetObjectStr(obj, key_name_str, key_name_len, &obj);
        if (err || !obj) {
            if (!err && !obj) {
                err = SELVA_ENOENT;
            }
            selva_send_errorf(resp, err, "Get edge field");
            return;
        }
    }

    SelvaObject_ReplyWithObject(resp, NULL, obj, NULL, 0);
}

/*
 * Get edges of an edge field.
 *
 * Reply format:
 * [
 *   constraint_id,
 *   nodeId1,
 *   nodeId2,
 * ]
 */
static void SelvaHierarchy_EdgeGetCommand(struct selva_server_response_out *resp, const void *buf, size_t len) {
    SelvaHierarchy *hierarchy = main_hierarchy;
    Selva_NodeId nodeId;
    const char *field_name_str = NULL;
    size_t field_name_len = 0;
    int argc;

    argc = selva_proto_scanf(NULL, buf, len, "%" SELVA_SCA_NODE_ID ", %.*s",
                             nodeId,
                             &field_name_len, &field_name_str);
    if (argc != 2) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    const SelvaHierarchyNode *node;

    /*
     * Find the node.
     */
    node = SelvaHierarchy_FindNode(hierarchy, nodeId);
    if (!node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    const struct EdgeField *edge_field;

    edge_field = Edge_GetField(node, field_name_str, field_name_len);
    if (!edge_field) {
        selva_send_null(resp);
        return;
    }

    struct EdgeFieldIterator it;
    const SelvaHierarchyNode *dst;

    selva_send_array(resp, 1 + Edge_GetFieldLength(edge_field));
    selva_send_ll(resp, edge_field->constraint ? edge_field->constraint->constraint_id : EDGE_FIELD_CONSTRAINT_ID_DEFAULT);

    Edge_ForeachBegin(&it, edge_field);
    while ((dst = Edge_Foreach(&it))) {
        selva_send_str(resp, dst->id, Selva_NodeIdLen(dst->id));
    }
}

/*
 * Get metadata of an edge.
 *
 * Reply format:
 * SelvaObject
 */
static void SelvaHierarchy_EdgeGetMetadataCommand(struct selva_server_response_out *resp, const void *buf, size_t len) {
    SelvaHierarchy *hierarchy = main_hierarchy;
    Selva_NodeId src_node_id;
    const char *field_name_str;
    size_t field_name_len;
    Selva_NodeId dst_node_id;
    int argc, err;

    argc = selva_proto_scanf(NULL, buf, len, "%" SELVA_SCA_NODE_ID ", %.*s, %" SELVA_SCA_NODE_ID,
                             src_node_id,
                             &field_name_len, &field_name_str,
                             dst_node_id);
    if (argc != 3) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    /*
     * Find the node.
     */
    const SelvaHierarchyNode *src_node = SelvaHierarchy_FindNode(hierarchy, src_node_id);
    if (!src_node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    struct EdgeField *edge_field;
    edge_field = Edge_GetField(src_node, field_name_str, field_name_len);
    if (!edge_field) {
        selva_send_errorf(resp, SELVA_ENOENT, "Edge field not found");
        return;
    }

    struct SelvaObject *edge_metadata;
    err = Edge_GetFieldEdgeMetadata(edge_field, dst_node_id, 0, &edge_metadata);
    if (err == SELVA_ENOENT) {
        selva_send_null(resp);
        return;
    } else if (err) { /* Also if the edge doesn't exist. */
        selva_send_error(resp, err, NULL, 0);
        return;
    }

    SelvaObject_ReplyWithObject(resp, NULL, edge_metadata, NULL, 0);
}

static void SelvaHierarchy_CompressCommand(struct selva_server_response_out *resp, const void *buf, size_t len) {
    enum SelvaHierarchyDetachedType type = SELVA_HIERARCHY_DETACHED_COMPRESSED_MEM;
    SelvaHierarchy *hierarchy = main_hierarchy;
    __auto_finalizer struct finalizer fin;
    Selva_NodeId nodeId;
    int argc, err;

    finalizer_init(&fin);

    argc = selva_proto_scanf(&fin, buf, len, "%" SELVA_SCA_NODE_ID ", %d",
                             nodeId, &type);
    if (argc != 1 && argc != 2) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    if (type != SELVA_HIERARCHY_DETACHED_COMPRESSED_MEM &&
        type != SELVA_HIERARCHY_DETACHED_COMPRESSED_DISK) {
        selva_send_error(resp, SELVA_EINVAL, "type", 4);
        return;
    }

    /*
     * Find the node.
     */
    SelvaHierarchyNode *node = SelvaHierarchy_FindNode(hierarchy, nodeId);
    if (!node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    err = detach_subtree(hierarchy, node, type);
    if (err) {
        selva_send_error(resp, err, NULL, 0);
        return;
    }

    selva_send_ll(resp, 1);
    selva_replication_replicate(selva_resp_to_ts(resp), selva_resp_to_cmd_id(resp), buf, len);
}

static void SelvaHierarchy_ListCompressedCommand(struct selva_server_response_out *resp, const void *buf __unused, size_t len) {
    SelvaHierarchy *hierarchy = main_hierarchy;
    SelvaObject_Iterator *it;
    const char *id;

    if (len != 0) {
        selva_send_error_arity(resp);
        return;
    }

    if (!hierarchy->detached.obj) {
        selva_send_array(resp, 0);
        return;
    }

    selva_send_array(resp, SelvaObject_Len(hierarchy->detached.obj, NULL));
    it = SelvaObject_ForeachBegin(hierarchy->detached.obj);
    while ((id = SelvaObject_ForeachKey(hierarchy->detached.obj, &it))) {
        selva_send_str(resp, id, strlen(id));
    }
}

static void SelvaHierarchy_VerCommand(struct selva_server_response_out *resp, const void *buf __unused, size_t len) {
    struct SelvaDbVersionInfo nfo;

    if (len != 0) {
        selva_send_error_arity(resp);
        return;
    }

    selva_io_get_ver(&nfo);

    selva_send_array(resp, 6);

    selva_send_str(resp, "running", 7);
    selva_send_str(resp, nfo.running, sizeof(nfo.running));

    selva_send_str(resp, "created", 7);
    if (nfo.created_with[0] != '\0') {
        selva_send_str(resp, nfo.created_with, sizeof(nfo.created_with));
    } else {
        selva_send_null(resp);
    }

    selva_send_str(resp, "updated", 7);
    if (nfo.updated_with[0] != '\0') {
        selva_send_str(resp, nfo.updated_with, sizeof(nfo.updated_with));
    } else {
        selva_send_null(resp);
    }
}

static int Hierarchy_OnLoad(void) {
    selva_mk_command(CMD_ID_HIERARCHY_DEL, SELVA_CMD_MODE_MUTATE, "hierarchy.del", SelvaHierarchy_DelNodeCommand);
    selva_mk_command(CMD_ID_HIERARCHY_EXPIRE, SELVA_CMD_MODE_MUTATE, "hierarchy.expire", SelvaHierarchy_ExpireCommand);
    selva_mk_command(CMD_ID_HIERARCHY_HEADS, SELVA_CMD_MODE_PURE, "hierarchy.heads", SelvaHierarchy_HeadsCommand);
    selva_mk_command(CMD_ID_HIERARCHY_PARENTS, SELVA_CMD_MODE_PURE, "hierarchy.parents", SelvaHierarchy_ParentsCommand);
    selva_mk_command(CMD_ID_HIERARCHY_CHILDREN, SELVA_CMD_MODE_PURE, "hierarchy.children", SelvaHierarchy_ChildrenCommand);
    selva_mk_command(CMD_ID_HIERARCHY_EDGE_LIST, SELVA_CMD_MODE_PURE, "hierarchy.edgeList", SelvaHierarchy_EdgeListCommand);
    selva_mk_command(CMD_ID_HIERARCHY_EDGE_GET, SELVA_CMD_MODE_PURE, "hierarchy.edgeGet", SelvaHierarchy_EdgeGetCommand);
    selva_mk_command(CMD_ID_HIERARCHY_EDGE_GET_METADATA, SELVA_CMD_MODE_PURE, "hierarchy.edgeGetMetadata", SelvaHierarchy_EdgeGetMetadataCommand);
    selva_mk_command(CMD_ID_HIERARCHY_COMPRESS, SELVA_CMD_MODE_PURE, "hierarchy.compress", SelvaHierarchy_CompressCommand); /* Pure or not? */
    selva_mk_command(CMD_ID_HIERARCHY_LIST_COMPRESSED, SELVA_CMD_MODE_PURE, "hierarchy.listCompressed", SelvaHierarchy_ListCompressedCommand);
    selva_mk_command(CMD_ID_HIERARCHY_VER, SELVA_CMD_MODE_PURE, "hierarchy.ver", SelvaHierarchy_VerCommand);

    return 0;
}
SELVA_ONLOAD(Hierarchy_OnLoad);
