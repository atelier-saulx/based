/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#define _GNU_SOURCE
#include <assert.h>
#include <errno.h>
#include <math.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>
#include "endian.h"
#include "jemalloc.h"
#include "libdeflate.h"
#include "selva_error.h"
#include "selva_log.h"
#include "selva_proto.h"
#include "selva_server.h"
#include "selva_io.h"
#include "util/array_field.h"
#include "util/bitmap.h"
#include "util/cstrings.h"
#include "util/data-record.h"
#include "util/finalizer.h"
#include "util/selva_proto_builder.h"
#include "util/selva_string.h"
#include "util/svector.h"
#include "comparator.h"
#include "db_config.h"
#include "hierarchy.h"
#include "selva_db.h"
#include "selva_object.h"
#include "selva_onload.h"
#include "selva_set.h"
#include "selva_trace.h"
#include "subscriptions.h"
#include "schema.h"
#include "typestr.h"
#include "modify.h"

#define FISSET_NO_MERGE(m) ({ \
        ASSERT_TYPE(enum modify_flags, m); \
        (((m) & FLAG_NO_MERGE) == FLAG_NO_MERGE); \
    })

#define FISSET_CREATE(m) ({ \
        ASSERT_TYPE(enum modify_flags, m); \
        (((m) & FLAG_CREATE) == FLAG_CREATE); \
    })

#define FISSET_UPDATE(m) ({ \
        ASSERT_TYPE(enum modify_flags, m); \
        (((m) & FLAG_UPDATE) == FLAG_UPDATE); \
    })

#define REPLY_WITH_ARG_TYPE_ERROR(v) \
    selva_send_errorf(resp, SELVA_EINTYPE, "Expected: %s", typeof_str(v))

/**
 * Struct type for replicating the automatic timestamps.
 */
struct replicate_ts {
    int8_t created;
    int8_t updated;
    long long created_at;
    long long updated_at;
};

static enum selva_op_repl_state (*modify_op_fn[256])(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        char type_code,
        struct selva_string *field,
        struct selva_string *value);

SELVA_TRACE_HANDLE(cmd_modify);

static ssize_t string2selva_string(struct finalizer *fin, int8_t type, const char *s, struct selva_string **out) {
    size_t len;

    switch (type) {
    case SELVA_MODIFY_OP_SET_TYPE_CHAR:
        len = strlen(s);
        break;
    case SELVA_MODIFY_OP_SET_TYPE_REFERENCE:
        len = strnlen(s, SELVA_NODE_ID_SIZE);
        if (len == 0) {
            return SELVA_EINVAL;
        }
        break;
    default:
        return SELVA_EINTYPE;
    }

    *out = selva_string_create(s, len, 0);
    if (fin) {
        finalizer_add(fin, *out, selva_string_free);
    }

    return len;
}

/**
 * Find first alias from alias_query that points to an existing node_id.
 * @param[in] alias_query contains a list of alias names that may or may not exist.
 * @param[out] dest_node_id Returns the node_id an alias is pointing to.
 * @return 0 if no match; 1 if match found.
 */
static int find_first_alias(SelvaHierarchy *hierarchy, const SVector *alias_query, Selva_NodeId dest_node_id) __attribute__((access (read_only, 2), access(write_only, 3)));
static int find_first_alias(SelvaHierarchy *hierarchy, const SVector *alias_query, Selva_NodeId dest_node_id) {
    struct SVectorIterator it;
    char *str;

    SVector_ForeachBegin(&it, alias_query);
    while ((str = SVector_Foreach(&it))) {
        if (!get_alias_str(hierarchy, str, strlen(str), dest_node_id)) {
            if (SelvaHierarchy_NodeExists(hierarchy, dest_node_id)) {
                return 1;
            }
        }
    }

    return 0;
}

/**
 * Make an SVector out of the values in value_str.
 * Note that the SVector vec will point to the strings in value_str, and
 * thus it must not be freed unless the SVector is also destroyed.
 * @param value_len must be value_len % SELVA_NODE_ID_SIZE == 0.
 */
static void opSet_refs_to_svector(SVector *vec, const char *value_str, size_t value_len) {
    /* Must be uninitialized. */
#if 0
    assert(vec->vec_mode == SVECTOR_MODE_NONE);
    assert(value_len % SELVA_NODE_ID_SIZE == 0);
#endif

    /* The comparator works for both nodes and nodeIds. */
    SVector_Init(vec, value_len / SELVA_NODE_ID_SIZE, SelvaSVectorComparator_Node);

    for (size_t i = 0; i < value_len; i += SELVA_NODE_ID_SIZE) {
        const char *dst_node_id = value_str + i;

        SVector_Insert(vec, (void *)dst_node_id);
    }
}

static void sort_edge_field(
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        struct EdgeField *edge_field,
        const char *value_str,
        size_t value_len) {
    if (!(Edge_GetFieldConstraintFlags(edge_field) & EDGE_FIELD_CONSTRAINT_FLAG_ARRAY)) {
        return;
    }

    for (size_t i = 0; i < value_len; i += SELVA_NODE_ID_SIZE) {
        const char *dst_node_id = value_str + i;
        size_t new_idx = i / SELVA_NODE_ID_SIZE;
        int err;

        err = Edge_Move(edge_field, dst_node_id, new_idx);
        if (err && err != SELVA_EINVAL) { /* EINVAL is invalid index. */
            Selva_NodeId node_id;

            SelvaHierarchy_GetNodeId(node_id, node);
            SELVA_LOG(SELVA_LOGL_ERR, "Failed to move edge %.*s[%.*s][%zu] = %.*s",
                      (int)SELVA_NODE_ID_SIZE, node_id,
                      (int)field_len, field_str,
                      new_idx,
                      (int)SELVA_NODE_ID_SIZE, dst_node_id);
        }
    }
}

/**
 * Replace edgeField value with nodeIds present in value_str.
 * Existing edges are preserved.
 * @param value_str same as SelvaModify_OpSet->$value_str.
 */
static int replace_edge_field(
        SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        const char *value_str,
        size_t value_len) {
    int res = 0;
    size_t orig_len = 0;
    SVECTOR_AUTOFREE(new_ids);

    if (value_len % SELVA_NODE_ID_SIZE) {
        return SELVA_EINVAL;
    }

    opSet_refs_to_svector(&new_ids, value_str, value_len);

    struct EdgeField *edgeField = Edge_GetField(node, field_str, field_len);
    if (edgeField && (orig_len = Edge_GetFieldLength(edgeField)) > 0) {
        /*
         * First we remove the arcs from the old set that don't exist
         * in the new set.
         * Note that we can cast a hierarchy node to Selva_NodeId or even a
         * char as it's guaranteed that the structure starts with the id
         * that has a known length.
         */

        struct SVectorIterator it;
        SVECTOR_AUTOFREE(old_arcs);
        const struct SelvaHierarchyNode *dst_node;

        if (!Edge_CloneArcs(&old_arcs, edgeField)) {
            return SELVA_EGENERAL;
        }

        SVector_ForeachBegin(&it, &old_arcs);
        while ((dst_node = SVector_Foreach(&it))) {
            Selva_NodeId dst_id;

            SelvaHierarchy_GetNodeId(dst_id, dst_node);
            if (!SVector_Search(&new_ids, dst_id)) {
                Edge_Delete(hierarchy, edgeField, node, dst_id);
                res++; /* Count delete as a change. */
            }
        }
    }

    /*
     * Then we add the new arcs.
     */
    for (size_t i = 0; i < value_len; i += SELVA_NODE_ID_SIZE) {
        const char *dst_node_id = value_str + i;
        struct SelvaHierarchyNode *dst_node;
        int err;

        err = SelvaHierarchy_UpsertNode(hierarchy, dst_node_id, &dst_node);
        if ((err && err != SELVA_HIERARCHY_EEXIST) || !dst_node) {
            SELVA_LOG(SELVA_LOGL_ERR, "Upserting a node failed: %s",
                      selva_strerror(err));
            /*
             * We could also ignore the error and try to insert the rest but
             * perhaps it can be considered a fatal error if one of the
             * nodes cannot be referenced/created.
             */
            return err;
        }

        err = Edge_Add(hierarchy, field_str, field_len, node, dst_node);
        if (!err) {
            res++;
        } else if (err != SELVA_EEXIST) {
            /*
             * This will most likely happen in real production only when
             * the constraints don't match.
             */
#if 0
            SELVA_LOG(SELVA_LOGL_DBG, "Adding an edge from %.*s.%.*s to %.*s failed with an error: %s",
                      (int)SELVA_NODE_ID_SIZE, node_id,
                      (int)field_len, field_str,
                      (int)SELVA_NODE_ID_SIZE, dst_node_id,
                      selva_strerror(err));
#endif
            return err;
        }
    }

    if (orig_len > 0) {
        if (!edgeField) {
            edgeField = Edge_GetField(node, field_str, field_len);
        }
        if (likely(edgeField)) {
            sort_edge_field(node, field_str, field_len, edgeField, value_str, value_len);
        }
    }

    return res;
}

/**
 * Insert nodes in the list value_str to the EdgeField starting from index.
 * @returns Return the number of chages made; Otherwise a selva error is returned.
 */
static int insert_edges(
        SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        const char *value_str,
        size_t value_len,
        ssize_t index) {
    int res = 0;

    if (value_len % SELVA_NODE_ID_SIZE) {
        return SELVA_EINVAL;
    }

    for (size_t i = 0; i < value_len; i += SELVA_NODE_ID_SIZE) {
        const char *dst_node_id = value_str + i;
        struct SelvaHierarchyNode *dst_node;
        int err;

        err = SelvaHierarchy_UpsertNode(hierarchy, dst_node_id, &dst_node);
        if ((err && err != SELVA_HIERARCHY_EEXIST) || !dst_node) {
            SELVA_LOG(SELVA_LOGL_ERR, "Upserting a node failed: %s",
                      selva_strerror(err));
            /*
             * We could also ignore the error and try to insert the rest but
             * perhaps it can be considered a fatal error if one of the
             * nodes cannot be referenced/created.
             */
            return err;
        }

        err = Edge_AddIndex(hierarchy, field_str, field_len, node, dst_node, index);
        if (!err) {
            res++;
        } else if (err != SELVA_EEXIST) {
            /*
             * This will most likely happen in real production only when
             * the constraints don't match.
             */
#if 0
            SELVA_LOG(SELVA_LOGL_DBG, "Adding an edge from %.*s.%.*s to %.*s failed with an error: %s",
                      (int)SELVA_NODE_ID_SIZE, node_id,
                      (int)field_len, field_str,
                      (int)SELVA_NODE_ID_SIZE, dst_node_id,
                      selva_strerror(err));
#endif
            return err;
        }
        if (index >= 0) {
            index++;
            /* Negative index is always correct. */
        }
    }

    return res;
}

/**
 * Assign nodes in the list value_str to the EdgeField starting from index replacing the original edges.
 * @returns Return the number of chages made; Otherwise a selva error is returned.
 */
static int assign_edges(
        SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        const char *value_str,
        size_t value_len,
        ssize_t index) {
    struct EdgeField *edge_field;
    int res = 0;

    if (value_len % SELVA_NODE_ID_SIZE) {
        return SELVA_EINVAL;
    }

    /* Note that edge_field doesn't need to exist. */
    edge_field = Edge_GetField(node, field_str, field_len);

    for (size_t i = 0; i < value_len; i += SELVA_NODE_ID_SIZE) {
        const char *dst_node_id = value_str + i;
        struct SelvaHierarchyNode *dst_node;
        int err;

        if (edge_field) {
            struct SelvaHierarchyNode *old_dst_node;

            old_dst_node = Edge_GetIndex(edge_field, index);
            if (old_dst_node) {
                Selva_NodeId old_dst_node_id;


                SelvaHierarchy_GetNodeId(old_dst_node_id, old_dst_node);
                err = Edge_Delete(hierarchy, edge_field, node, old_dst_node_id);
                if (err) {
                    return err;
                }
            }
        }

        err = SelvaHierarchy_UpsertNode(hierarchy, dst_node_id, &dst_node);
        if ((err && err != SELVA_HIERARCHY_EEXIST) || !dst_node) {
            SELVA_LOG(SELVA_LOGL_ERR, "Upserting a node failed: %s",
                      selva_strerror(err));
            /*
             * We could also ignore the error and try to insert the rest but
             * perhaps it can be considered a fatal error if one of the
             * nodes cannot be referenced/created.
             */
            return err;
        }

        err = Edge_AddIndex(hierarchy, field_str, field_len, node, dst_node, index);
        if (!err) {
            res++;
        } else if (err != SELVA_EEXIST) {
            /*
             * This will most likely happen in real production only when
             * the constraints don't match.
             */
#if 0
            SELVA_LOG(SELVA_LOGL_DBG, "Adding an edge from %.*s.%.*s to %.*s failed with an error: %s",
                      (int)SELVA_NODE_ID_SIZE, node_id,
                      (int)field_len, field_str,
                      (int)SELVA_NODE_ID_SIZE, dst_node_id,
                      selva_strerror(err));
#endif
            return err;
        }
        if (index >= 0) {
            index++;
            /* Negative index is always correct. */
        }
    }

    return res;
}

/**
 * Delete nodes from the EdgeField.
 * The list of nodeIds in value_str acts as a condition variable for the deletion,
 * preventing a race condition between two clients.
 * @param value_str a list of nodes that exist in the EdgeField starting from index.
 * @param index is the deletion index.
 * @returns Return the number of chages made; Otherwise a selva error is returned.
 */
static int delete_edges(
        SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        const char *value_str,
        size_t value_len,
        ssize_t index) {
    struct EdgeField *edge_field;
    int res = 0;

    if (value_len % SELVA_NODE_ID_SIZE) {
        return SELVA_EINVAL;
    }

    edge_field = Edge_GetField(node, field_str, field_len);
    if (!edge_field) {
       return SELVA_ENOENT;
    }

    for (size_t i = 0; i < value_len; i += SELVA_NODE_ID_SIZE) {
        const char *dst_node_id = value_str + i;
        struct SelvaHierarchyNode *dst_node;
        int err;

        dst_node = Edge_GetIndex(edge_field, index);
        if (dst_node) {
            Selva_NodeId old_dst_node_id;

            SelvaHierarchy_GetNodeId(old_dst_node_id, dst_node);
            if (memcmp(dst_node_id, old_dst_node_id, SELVA_NODE_ID_SIZE)) {
                return SELVA_HIERARCHY_ENOENT;
            }

            err = Edge_Delete(hierarchy, edge_field, node, dst_node_id);
            if (err) {
                return err;
            }
        }
    }

    return res;
}

/**
 * Move nodes listed in value_len to index.
 * Every node_id in the value list must refer to an existing node in the
 * EdgeField.
 * @returns Return the number of chages made; Otherwise a selva error is returned.
 */
static int move_edges(
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        const char *value_str,
        size_t value_len,
        ssize_t index) {
    struct EdgeField *edge_field;
    int res = 0;

    if (value_len % SELVA_NODE_ID_SIZE) {
        return SELVA_EINVAL;
    }

    edge_field = Edge_GetField(node, field_str, field_len);
    if (!edge_field) {
        return SELVA_ENOENT;
    }

    for (size_t i = 0; i < value_len; i += SELVA_NODE_ID_SIZE) {
        const char *dst_node_id = value_str + i;
        int err;

        err = Edge_Move(edge_field, dst_node_id, index);
        if (err) {
            return err;
        }

        res++;
    }

    return res;
}

/**
 * Update EdgeField.
 * @returns Return the number of chages made; Otherwise a selva error is returned.
 */
static int update_edge(
        SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        const struct selva_string *field,
        const struct SelvaModify_OpSet *setOpts
) {
    TO_STR(field);

    if (setOpts->$value_len > 0) {
        return replace_edge_field(hierarchy, node,
                                  field_str, field_len,
                                  setOpts->$value_str, setOpts->$value_len);
    } else {
        int res = 0;

        if (setOpts->$add_len % SELVA_NODE_ID_SIZE ||
            setOpts->$delete_len % SELVA_NODE_ID_SIZE) {
            return SELVA_EINVAL;
        }

        if (setOpts->$add_len > 0) {
            for (size_t i = 0; i < setOpts->$add_len; i += SELVA_NODE_ID_SIZE) {
                struct SelvaHierarchyNode *dst_node;
                int err;

                err = SelvaHierarchy_UpsertNode(hierarchy, setOpts->$add_str + i, &dst_node);
                if ((err && err != SELVA_HIERARCHY_EEXIST) || !dst_node) {
                    /* See similar case with $value */
                    SELVA_LOG(SELVA_LOGL_ERR, "Upserting a node failed. err: \"%s\"",
                              selva_strerror(err));
                    return err;
                }

                err = Edge_Add(hierarchy, field_str, field_len, node, dst_node);
                if (!err) {
                    res++;
                } else if (err != SELVA_EEXIST) {
                    /*
                     * This will most likely happen in real production only when
                     * the constraints don't match.
                     */
#if 0
                    SELVA_LOG(SELVA_LOGL_DBG, "Adding an edge from %.*s.%.*s to %.*s failed with an error: %s",
                              (int)SELVA_NODE_ID_SIZE, node_id,
                              (int)field_len, field_str,
                              (int)SELVA_NODE_ID_SIZE, dst_node_id,
                              selva_strerror(err));
#endif
                    return err;
                }
            }
        }
        if (setOpts->$delete_len > 0) {
            struct EdgeField *edgeField = Edge_GetField(node, field_str, field_len);
            if (edgeField) {
                for (size_t i = 0; i < setOpts->$delete_len; i += SELVA_NODE_ID_SIZE) {
                    Selva_NodeId dst_node_id;
                    int err;

                    /*
                     * It may or may not be better for caching to have the node_id in
                     * stack.
                     */
                    memcpy(dst_node_id, setOpts->$delete_str + i, SELVA_NODE_ID_SIZE);
                    err = Edge_Delete(hierarchy, edgeField, node, dst_node_id);
                    if (!err) {
                        res++;
                    }
                }
            }
        }

        return res;
    }
}

static int add_set_values_char(
    SelvaHierarchy *hierarchy,
    struct SelvaObject *obj,
    const Selva_NodeId node_id,
    const struct selva_string *field,
    const char *value_ptr,
    size_t value_len,
    int8_t type,
    int remove_diff) {
    TO_STR(field);
    const bool is_aliases = SELVA_IS_ALIASES_FIELD(field_str, field_len);
    const char *ptr = value_ptr;
    SVector new_set;
    __auto_finalizer struct finalizer fin;
    int res = 0;

    finalizer_init(&fin);

    /* Check that the value divides into elements properly. */
    if ((type == SELVA_MODIFY_OP_SET_TYPE_REFERENCE && (value_len % SELVA_NODE_ID_SIZE)) ||
        (type == SELVA_MODIFY_OP_SET_TYPE_DOUBLE && (value_len % sizeof(double))) ||
        (type == SELVA_MODIFY_OP_SET_TYPE_LONG_LONG && (value_len % sizeof(long long)))) {
        return SELVA_EINVAL;
    }

    if (remove_diff) {
        size_t inital_size = (type == SELVA_MODIFY_OP_SET_TYPE_REFERENCE) ? value_len / SELVA_NODE_ID_SIZE : 1;

        SVector_Init(&new_set, inital_size, SelvaSVectorComparator_String);
    } else {
        /* If it's empty the destroy function will just skip over. */
        memset(&new_set, 0, sizeof(new_set));
    }

    /*
     * Add missing elements to the set.
     */
    for (size_t i = 0; i < value_len; ) {
        int err;
        struct selva_string *ref;
        const ssize_t part_len = string2selva_string(&fin, type, ptr, &ref);

        if (part_len < 0) {
            res = SELVA_EINVAL;
            goto string_err;
        }

        /* Add to the node object. */
        err = SelvaObject_AddStringSet(obj, field, ref);
        if (remove_diff && (err == 0 || err == SELVA_EEXIST)) {
            SVector_Insert(&new_set, ref);
        }
        if (err == 0) {
            finalizer_forget(&fin, ref);

            /* Add to the global aliases hash. */
            if (is_aliases) {
                update_alias(hierarchy, node_id, ref);
            }

            res++;
        } else if (err != SELVA_EEXIST) {
            if (is_aliases) {
                SELVA_LOG(SELVA_LOGL_ERR, "Alias update failed");
            } else {
                SELVA_LOG(SELVA_LOGL_ERR, "String set field update failed");
            }
            res = err;
            goto string_err;
        }

        /* +1 to skip the NUL if cstring */
        const size_t skip_off = type == SELVA_MODIFY_OP_SET_TYPE_REFERENCE ? SELVA_NODE_ID_SIZE : (size_t)part_len + (type == SELVA_MODIFY_OP_SET_TYPE_CHAR);
        if (skip_off == 0) {
            res = SELVA_EINVAL;
            goto string_err;
        }

        ptr += skip_off;
        i += skip_off;
    }

    /*
     * Remove elements that are not in new_set.
     * This makes the set in obj.field equal to the set defined by value_str.
     */
    if (remove_diff) {
        struct SelvaSet *objSet = SelvaObject_GetSet(obj, field);
        if (objSet) {
            struct SelvaSetElement *set_el;
            struct SelvaSetElement *tmp;

            SELVA_SET_STRING_FOREACH_SAFE(set_el, objSet, tmp) {
                struct selva_string *el = set_el->value_string;

                if (!SVector_Search(&new_set, (void *)el)) {
                    /* el doesn't exist in new_set, therefore it should be removed. */
                    SelvaSet_DestroyElement(SelvaSet_Remove(objSet, el));

                    if (is_aliases) {
                        delete_alias(hierarchy, el);
                    }

                    selva_string_free(el);
                    res++; /* This too is a change to the set! */
                }
            }
        }
    }
string_err:
    SVector_Destroy(&new_set);

    return res;
}

static int add_set_values_numeric(
    struct SelvaObject *obj,
    const struct selva_string *field,
    const char *value_ptr,
    size_t value_len,
    int8_t type,
    int remove_diff) {
    const char *ptr = value_ptr;
    int res = 0;

    /*
     * Add missing elements to the set.
     */
    for (size_t i = 0; i < value_len; ) {
        int err;
        size_t part_len;

        /*
         * We want to be absolutely sure that we don't hit alignment aborts
         * on any architecture even if the received data is unaligned, hence
         * we use memcpy here.
         */
        if (type == SELVA_MODIFY_OP_SET_TYPE_DOUBLE) {
            double v;

            part_len = sizeof(double);
            memcpy(&v, ptr, part_len);
            err = SelvaObject_AddDoubleSet(obj, field, v);
        } else { /* SELVA_MODIFY_OP_SET_TYPE_LONG_LONG */
            long long v;

            part_len = sizeof(long long);
            memcpy(&v, ptr, part_len);
            err = SelvaObject_AddLongLongSet(obj, field, v);
        }
        if (err == 0) {
            res++;
        } else if (err != SELVA_EEXIST) {
            SELVA_LOG(SELVA_LOGL_ERR, "Set (%s) field update failed. err: \"%s\"",
                      (type == SELVA_MODIFY_OP_SET_TYPE_DOUBLE) ? "double" : "long long",
                      selva_strerror(err));
            return err;
        }

        const size_t skip_off = part_len;
        if (skip_off == 0) {
            return SELVA_EINVAL;
        }

        ptr += skip_off;
        i += skip_off;
    }

    /*
     * Remove elements that are not in new_set.
     * This makes the set in obj.field equal to the set defined by value_str.
     */
    if (remove_diff) {
        struct SelvaSetElement *set_el;
        struct SelvaSetElement *tmp;
        struct SelvaSet *objSet = SelvaObject_GetSet(obj, field);

        assert(objSet);
        if (type == SELVA_MODIFY_OP_SET_TYPE_DOUBLE && objSet->type == SELVA_SET_TYPE_DOUBLE) {
            SELVA_SET_DOUBLE_FOREACH_SAFE(set_el, objSet, tmp) {
                int found = 0;
                const double a = set_el->value_d;

                /* This is probably faster than any data structure we could use. */
                for (size_t i = 0; i < value_len; i += sizeof(double)) {
                    double b;

                    /*
                     * We use memcpy here because it's not guranteed that the
                     * array is aligned properly.
                     */
                    memcpy(&b, value_ptr + i, sizeof(double));

                    if (a == b) {
                        found = 1;
                        break;
                    }
                }

                if (!found) {
                    SelvaSet_DestroyElement(SelvaSet_RemoveDouble(objSet, a));
                    res++;
                }
            }
        } else if (type == SELVA_MODIFY_OP_SET_TYPE_LONG_LONG && objSet->type == SELVA_SET_TYPE_LONGLONG) {
            SELVA_SET_LONGLONG_FOREACH_SAFE(set_el, objSet, tmp) {
                int found = 0;
                const long long a = set_el->value_ll;

                /* This is probably faster than any data structure we could use. */
                for (size_t i = 0; i < value_len; i++) {
                    long long b;

                    /*
                     * We use memcpy here because it's not guranteed that the
                     * array is aligned properly.
                     */
                    memcpy(&b, value_ptr + i, sizeof(long long));

                    if (a == b) {
                        found = 1;
                        break;
                    }
                }

                if (!found) {
                    SelvaSet_DestroyElement(SelvaSet_RemoveLongLong(objSet, a));
                    res++;
                }
            }
        } else {
            SELVA_LOG(SELVA_LOGL_CRIT, "Type mismatch! type: %d objSet->type: %d",
                      (int)type, (int)objSet->type);
            abort(); /* Never reached. */
        }
    }

    return res;
}

/**
 * Add all values from value_ptr to the set in obj.field.
 * @returns The number of items added; Otherwise a negative Selva error code is returned.
 */
static int add_set_values(
    SelvaHierarchy *hierarchy,
    struct SelvaObject *obj,
    const Selva_NodeId node_id,
    const struct selva_string *field,
    const char *value_ptr,
    size_t value_len,
    int8_t type,
    int remove_diff
) {
    if (type == SELVA_MODIFY_OP_SET_TYPE_CHAR ||
        type == SELVA_MODIFY_OP_SET_TYPE_REFERENCE) {
        return add_set_values_char(hierarchy, obj, node_id, field, value_ptr, value_len, type, remove_diff);
    } else if (type == SELVA_MODIFY_OP_SET_TYPE_DOUBLE ||
               type == SELVA_MODIFY_OP_SET_TYPE_LONG_LONG) {
        return add_set_values_numeric(obj, field, value_ptr, value_len, type, remove_diff);
    } else {
        return SELVA_EINTYPE;
    }
}

static int del_set_values_char(
        struct SelvaHierarchy *hierarchy,
        struct SelvaObject *obj,
        const struct selva_string *field,
        const char *value_ptr,
        size_t value_len,
        int8_t type) {
    TO_STR(field);
    const int is_aliases = SELVA_IS_ALIASES_FIELD(field_str, field_len);
    const char *ptr = value_ptr;
    int res = 0;

    if (type == SELVA_MODIFY_OP_SET_TYPE_REFERENCE && (value_len % SELVA_NODE_ID_SIZE)) {
        return SELVA_EINVAL;
    }

    for (size_t i = 0; i < value_len; ) {
        struct selva_string *ref;
        const ssize_t part_len = string2selva_string(NULL, type, ptr, &ref);
        int err;

        if (part_len < 0) {
            return SELVA_EINVAL;
        }

        /*
         * Remove from the node object.
         */
        err = SelvaObject_RemStringSet(obj, field, ref);
        if (!err) {
            /*
             * Remove from the global aliases hash.
             */
            if (is_aliases) {
                delete_alias(hierarchy, ref);
            }

            res++;
        }

        /* +1 to skip the NUL if cstring */
        const size_t skip_off = type == SELVA_MODIFY_OP_SET_TYPE_REFERENCE ? SELVA_NODE_ID_SIZE : (size_t)part_len + (type == SELVA_MODIFY_OP_SET_TYPE_CHAR);
        if (skip_off == 0) {
            return SELVA_EINVAL;
        }

        selva_string_free(ref);
        ptr += skip_off;
        i += skip_off;
    }

    return res;
}

static int del_set_values_numeric(
        struct SelvaObject *obj,
        const struct selva_string *field,
        const char *value_ptr,
        size_t value_len,
        int8_t type) {
    const char *ptr = value_ptr;
    int res = 0;

    for (size_t i = 0; i < value_len; ) {
        int err;
        size_t part_len;

        /*
         * We want to be absolutely sure that we don't hit alignment aborts
         * on any architecture even if the received data is unaligned, hence
         * we use memcpy here.
         */
        if (type == SELVA_MODIFY_OP_SET_TYPE_DOUBLE) {
            double v;

            part_len = sizeof(double);
            memcpy(&v, ptr, part_len);
            err = SelvaObject_RemDoubleSet(obj, field, v);
        } else {
            long long v;

            part_len = sizeof(long long);
            memcpy(&v, ptr, part_len);
            err = SelvaObject_RemLongLongSet(obj, field, v);
        }
        if (err &&
            err != SELVA_ENOENT &&
            err != SELVA_EEXIST &&
            err != SELVA_EINVAL) {
            SELVA_LOG(SELVA_LOGL_ERR, "Double set field update failed");
            return err;
        }
        if (err == 0) {
            res++;
        }

        const size_t skip_off = part_len;
        ptr += skip_off;
        i += skip_off;
    }

    return res;
}

static int del_set_values(
        struct SelvaHierarchy *hierarchy,
        struct SelvaObject *obj,
        const struct selva_string *field,
        const char *value_ptr,
        size_t value_len,
        int8_t type
) {
    if (type == SELVA_MODIFY_OP_SET_TYPE_CHAR ||
        type == SELVA_MODIFY_OP_SET_TYPE_REFERENCE) {
        return del_set_values_char(hierarchy, obj, field, value_ptr, value_len, type);
    } else if (type == SELVA_MODIFY_OP_SET_TYPE_DOUBLE ||
               type == SELVA_MODIFY_OP_SET_TYPE_LONG_LONG) {
        return del_set_values_numeric(obj, field, value_ptr, value_len, type);
    } else {
        return SELVA_EINTYPE;
    }
}

/*
 * @returns The "rough" absolute number of changes made; Otherise a negative Selva error code is returned.
 */
static int update_set(
    SelvaHierarchy *hierarchy,
    struct SelvaObject *obj,
    const Selva_NodeId node_id,
    const struct selva_string *field,
    const struct SelvaModify_OpSet *setOpts
) {
    int res = 0;

    if (setOpts->$value_len > 0) {
        int err;

        /*
         * Set new values.
         */
        err = add_set_values(hierarchy, obj, node_id, field, setOpts->$value_str, setOpts->$value_len, setOpts->op_set_type, 1);
        if (err < 0) {
            return err;
        } else {
            res += err;
        }
    } else {
        if (setOpts->$add_len > 0) {
            int err;

            err = add_set_values(hierarchy, obj, node_id, field, setOpts->$add_str, setOpts->$add_len, setOpts->op_set_type, 0);
            if (err < 0) {
                return err;
            } else {
                res += err;
            }
        }

        if (setOpts->$delete_len > 0) {
            int err;

            err = del_set_values(hierarchy, obj, field, setOpts->$delete_str, setOpts->$delete_len, setOpts->op_set_type);
            if (err < 0) {
                return err;
            }
            res += err;
        }
    }

    return res;
}

int SelvaModify_ModifySet(
    SelvaHierarchy *hierarchy,
    const Selva_NodeId node_id,
    struct SelvaHierarchyNode *node,
    struct SelvaObject *obj,
    const struct selva_string *field,
    struct SelvaModify_OpSet *setOpts
) {
    TO_STR(field);

    if (setOpts->op_set_type == SELVA_MODIFY_OP_SET_TYPE_REFERENCE) {
        if (setOpts->delete_all) {
            int err;

            err = Edge_ClearField(hierarchy, node, field_str, field_len);

            if (err < 0 && err != SELVA_ENOENT && err != SELVA_HIERARCHY_ENOENT) {
                return err;
            } else if (setOpts->$value_len == 0 && setOpts->$add_len == 0) {
                return err > 0 ? err : 0;
            }
        }

        return update_edge(hierarchy, node, field, setOpts);
    } else {
        if (setOpts->delete_all) {
            int err;

            /*
             * First we need to delete the aliases of this node from the
             * global mapping.
             */
            if (SELVA_IS_ALIASES_FIELD(field_str, field_len)) {
                delete_all_node_aliases(hierarchy, obj);
                err = 1;
            } else {
                err = SelvaObject_DelKey(obj, field);
                if (err == 0) {
                    /* TODO It would be nice to return the actual number of deletions. */
                    err = 1;
                }
            }

            if (err && err != SELVA_ENOENT) {
                return err;
            } else if (setOpts->$value_len == 0 && setOpts->$add_len == 0) {
                return err > 0 ? err : 0;
            }
        }

        /*
         * Other set ops use C-strings and operate on the node SelvaObject.
         */
        return update_set(hierarchy, obj, node_id, field, setOpts);
    }
}

int SelvaModify_ModifyDel(
    SelvaHierarchy *hierarchy,
    struct SelvaHierarchyNode *node,
    struct SelvaObject *obj,
    const struct selva_string *field
) {
    TO_STR(field);
    int err;

    if (!strcmp(field_str, "aliases")) {
        delete_all_node_aliases(hierarchy, obj);
        err = 0;
    } else { /* It's an edge field or an object field. */
        int err1, err2;

        /*
         * We call both so that also records get cleared.
         * Example:
         * rec[]: {
         *   status: { type: 'boolean' },
         *   refs: { type: 'references' },
         * } = rec['nice'] = { status: true, refs: ... }
         * then
         * delete rec['nice']
         */
        err1 = Edge_DeleteAll(hierarchy, node, field_str, field_len);
        err2 = SelvaObject_DelKeyStr(obj, field_str, field_len);
        err = (err1 != SELVA_ENOENT && err1 != SELVA_EINTYPE) ? err1 : err2;
    }

    return err > 0 ? 0 : err;
}

static enum modify_flags parse_flags(const struct selva_string *arg) {
    TO_STR(arg);
    unsigned flags = 0;

    for (size_t i = 0; i < arg_len; i++) {
        flags |= arg_str[i] == 'M' ? FLAG_NO_MERGE : 0;
        flags |= arg_str[i] == 'C' ? FLAG_CREATE : 0;
        flags |= arg_str[i] == 'U' ? FLAG_UPDATE : 0;
    }

    return flags;
}

/**
 * Pre-parse op args.
 * Parse $alias query from the command args if one exists.
 * @param alias_query_out a vector for the query.
 *                        The SVector must be initialized before calling this function.
 */
static void pre_parse_ops(struct selva_string **argv, int argc, SVector *alias_query_out) {
    /* FIXME Support alias using OpOrdSet */
    (void)argv;
    (void)argc;
    (void)alias_query_out;
#if 0
    for (int i = 0; i < argc; i += 3) {
        const struct selva_string *type = argv[i];
        const struct selva_string *field = argv[i + 1];
        const struct selva_string *value = argv[i + 2];

        TO_STR(type, field, value);
        char type_code = type_str[0];

        if (type_code == SELVA_MODIFY_ARG_STRING_ARRAY &&
            !strcmp(field_str, "$alias")) {
            const char *s;
            size_t j = 0;
            while ((s = sztok(value_str, value_len, &j))) {
                SVector_Insert(alias_query_out, (void *)s);
            }
        }
    }
#endif
}

static int opset_fixup(struct SelvaModify_OpSet *op, size_t size) {
    DATA_RECORD_FIXUP_CSTRING_P(op, op, size, $add, $delete, $value);
    return 0;
}

static int opordset_fixup(struct SelvaModify_OpOrdSet *op, size_t size) {
    op->index = letoh(op->index);

    DATA_RECORD_FIXUP_CSTRING_P(op, op, size, $value);
    return 0;
}

struct SelvaModify_OpSet *SelvaModify_OpSet_fixup(struct finalizer *fin, const struct selva_string *data) {
    TO_STR(data);
    struct SelvaModify_OpSet *op;

    static_assert(__BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__, "Only little endian host is supported");

    if (!data || data_len == 0 || data_len < sizeof(struct SelvaModify_OpSet)) {
        return NULL;
    }

    op = selva_malloc(data_len);
    finalizer_add(fin, op, selva_free);
    memcpy(op, data_str, data_len);

    if (opset_fixup(op, data_len)) {
        return NULL;
    }

    return op;
}

struct SelvaModify_OpOrdSet *SelvaModify_OpOrdSet_fixup(struct finalizer *fin, const struct selva_string *data) {
    TO_STR(data);
    struct SelvaModify_OpOrdSet *op;

    static_assert(__BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__, "Only little endian host is supported");

    if (!data || data_len == 0 || data_len < sizeof(struct SelvaModify_OpOrdSet)) {
        return NULL;
    }

    op = selva_malloc(data_len);
    finalizer_add(fin, op, selva_free);
    memcpy(op, data_str, data_len);

    if (opordset_fixup(op, data_len)) {
        return NULL;
    }

    return op;
}

static int opedgemeta_fixup(struct SelvaModify_OpEdgeMeta *op, size_t size) {
    DATA_RECORD_FIXUP_CSTRING_P(op, op, size, meta_field_name, meta_field_value);
    return 0;
}

static struct SelvaModify_OpEdgeMeta *SelvaModify_OpEdgeMeta_align(struct finalizer *fin, const struct selva_string *data) {
    TO_STR(data);
    struct SelvaModify_OpEdgeMeta *op;

    static_assert(__BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__, "Only little endian host is supported");

    if (!data || data_len == 0 || data_len < sizeof(struct SelvaModify_OpEdgeMeta)) {
        return NULL;
    }

    op = selva_malloc(data_len);
    finalizer_add(fin, op, selva_free);
    memcpy(op, data_str, data_len);
    if (!op->meta_field_name_str || !op->meta_field_value_str) {
        return NULL;
    }

    if (opedgemeta_fixup(op, data_len)) {
        return NULL;
    }

    return op;
}

static int in_mem_range(const void *p, const void *start, size_t size) {
    return (ptrdiff_t)p >= (ptrdiff_t)start && (ptrdiff_t)p < (ptrdiff_t)start + (ptrdiff_t)size;
}

static const char *SelvaModify_OpHll_align(const struct selva_string *data, size_t *size_out) {
    TO_STR(data);
    typeof_field(struct SelvaModify_OpHll, $add_len) size;
    const char *p;

    static_assert(__BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__, "Only little endian host is supported");

    if (!data || data_len == 0 || data_len < sizeof(struct SelvaModify_OpHll)) {
        return NULL;
    }

    memcpy(&size, data_str + offsetof(struct SelvaModify_OpHll, $add_len), sizeof(size));
    memcpy(&p, data_str + offsetof(struct SelvaModify_OpHll, $add_str), sizeof(char *));
    p = data_str + (uintptr_t)p;

    if (size == 0 ||
        !in_mem_range(p,            data_str,   data_len) ||
        !in_mem_range(p + size - 1, data_str,   data_len)) {
        return NULL;
    }

    *size_out = size;
    return p;
}

/**
 * Get the replicate_ts struct.
 */
static void get_replicate_ts(struct replicate_ts *rs, struct SelvaHierarchyNode *node, bool created, bool updated) {
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(node);
    rs->created = created ? 1 : 0;
    rs->updated = updated ? 1 : 0;

    if (created) {
        (void)SelvaObject_GetLongLongStr(obj, SELVA_CREATED_AT_FIELD, sizeof(SELVA_CREATED_AT_FIELD) - 1, &rs->created_at);
    }
    if (updated) {
        (void)SelvaObject_GetLongLongStr(obj, SELVA_UPDATED_AT_FIELD, sizeof(SELVA_UPDATED_AT_FIELD) - 1, &rs->updated_at);
    }
}

static enum selva_op_repl_state SelvaModify_ModifyMetadata(
        struct selva_server_response_out *resp,
        struct SelvaObject *obj,
        const struct selva_string *field,
        const struct selva_string *value) {
    TO_STR(value);
    SelvaObjectMeta_t new_user_meta;
    SelvaObjectMeta_t old_user_meta;
    int err;

    if (value_len < sizeof(SelvaObjectMeta_t)) {
        REPLY_WITH_ARG_TYPE_ERROR(new_user_meta);
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    memcpy(&new_user_meta, value_str, sizeof(SelvaObjectMeta_t));
    err = SelvaObject_SetUserMeta(obj, field, new_user_meta, &old_user_meta);
    if (err) {
        selva_send_errorf(resp, err, "Failed to set key metadata (%s)",
                          selva_string_to_str(field, NULL));
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    if (new_user_meta != old_user_meta) {
        return SELVA_OP_REPL_STATE_UPDATED;
    }

    return SELVA_OP_REPL_STATE_REPLICATE;
}

static enum selva_op_repl_state op_increment_longlong(
        struct finalizer *,
        struct selva_server_response_out *resp,
        SelvaHierarchy *,
        struct SelvaHierarchyNode *node,
        char type_code __unused,
        struct selva_string *field,
        struct selva_string *value) {
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(node);
    TO_STR(value);
    struct SelvaModify_OpIncrement incrementOpts;
    int err;

    if (value_len < sizeof(incrementOpts)) {
        selva_send_error(resp, SELVA_EINVAL, NULL, 0);
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    memcpy(&incrementOpts, value_str, sizeof(incrementOpts));
    incrementOpts.$default = letoh(incrementOpts.$default);
    incrementOpts.$increment = letoh(incrementOpts.$increment);

    err = SelvaObject_IncrementLongLong(obj, field, incrementOpts.$default, incrementOpts.$increment, NULL);
    if (err) {
        selva_send_error(resp, err, NULL, 0);
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    return SELVA_OP_REPL_STATE_UPDATED;
}

static enum selva_op_repl_state op_increment_double(
        struct finalizer *,
        struct selva_server_response_out *resp,
        SelvaHierarchy *,
        struct SelvaHierarchyNode *node,
        char type_code __unused,
        struct selva_string *field,
        struct selva_string *value) {
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(node);
    TO_STR(value);
    struct SelvaModify_OpIncrementDouble incrementOpts;
    int err;

    if (value_len < sizeof(incrementOpts)) {
        selva_send_error(resp, SELVA_EINVAL, NULL, 0);
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    memcpy(&incrementOpts, value_str, sizeof(incrementOpts));
    incrementOpts.$default = ledoubletoh((char *)&incrementOpts.$default);
    incrementOpts.$increment = ledoubletoh((char *)&incrementOpts.$increment);

    err = SelvaObject_IncrementDouble(obj, field, incrementOpts.$default, incrementOpts.$increment, NULL);
    if (err) {
        selva_send_error(resp, err, NULL, 0);
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    return SELVA_OP_REPL_STATE_UPDATED;
}

static enum selva_op_repl_state op_set(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        char type_code __unused,
        struct selva_string *field,
        struct selva_string *value) {
    Selva_NodeId node_id;
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(node);
    struct SelvaModify_OpSet *setOpts;
    int err;

    SelvaHierarchy_GetNodeId(node_id, node);
    setOpts = SelvaModify_OpSet_fixup(fin, value);
    if (!setOpts) {
        selva_send_errorf(resp, SELVA_EINVAL, "Invalid OpSet");
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    err = SelvaModify_ModifySet(hierarchy, node_id, node, obj, field, setOpts);
    if (err == 0) {
        selva_send_str(resp, "OK", 2);
        return SELVA_OP_REPL_STATE_UNCHANGED;
    } else if (err < 0) {
        selva_send_error(resp, err, NULL, 0);
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    return SELVA_OP_REPL_STATE_UPDATED;
}

static enum selva_op_repl_state op_ord_set(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        char type_code __unused,
        struct selva_string *field,
        struct selva_string *value) {
    Selva_NodeId node_id;
    struct SelvaModify_OpOrdSet *setOpts;
    int err;

    SelvaHierarchy_GetNodeId(node_id, node);
    setOpts = SelvaModify_OpOrdSet_fixup(fin, value);
    if (!setOpts) {
        selva_send_errorf(resp, SELVA_EINVAL, "Invalid OpOrdSet");
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    TO_STR(field);

    switch (setOpts->mode) {
    case SelvaModify_OpOrdSet_Insert:
        err = insert_edges(hierarchy, node,
                           field_str, field_len,
                           setOpts->$value_str, setOpts->$value_len, setOpts->index);
        break;
    case SelvaModify_OpOrdSet_Assign:
        err = assign_edges(hierarchy, node,
                           field_str, field_len,
                           setOpts->$value_str, setOpts->$value_len, setOpts->index);
        break;
    case SelvaModify_OpOrdSet_Delete:
        err = delete_edges(hierarchy, node,
                           field_str, field_len,
                           setOpts->$value_str, setOpts->$value_len, setOpts->index);
        break;
    case SelvaModify_OpOrdSet_Move:
        err = move_edges(node, field_str, field_len,
                         setOpts->$value_str, setOpts->$value_len, setOpts->index);
        break;
        default:
        err = SELVA_EINVAL;
    }
    if (err == 0) {
        selva_send_str(resp, "OK", 2);
        return SELVA_OP_REPL_STATE_UNCHANGED;
    } else if (err < 0) {
        selva_send_error(resp, err, NULL, 0);
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    return SELVA_OP_REPL_STATE_UPDATED;
}

static enum selva_op_repl_state op_del(
        struct finalizer *,
        struct selva_server_response_out *resp,
        SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        char type_code __unused,
        struct selva_string *field,
        struct selva_string *value __unused) {
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(node);
    TO_STR(field);
    int err;

    err = SelvaModify_ModifyDel(hierarchy, node, obj, field);
    if (err == SELVA_ENOENT) {
        /* No need to replicate. */
        selva_send_str(resp, "OK", 2);
        return SELVA_OP_REPL_STATE_UNCHANGED;
    } else if (err) {
        selva_send_errorf(resp, err, "Failed to delete the field: \"%.*s\"",
                          (int)field_len, field_str);
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    return SELVA_OP_REPL_STATE_UPDATED;
}

static enum selva_op_repl_state op_string(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        SelvaHierarchy *,
        struct SelvaHierarchyNode *node,
        char type_code,
        struct selva_string *field,
        struct selva_string *value) {
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(node);
    TO_STR(field, value);
    const enum SelvaObjectType old_type = SelvaObject_GetTypeStr(obj, field_str, field_len);
    struct selva_string *old_value;
    int err;

    if (type_code == SELVA_MODIFY_ARG_DEFAULT_STRING && old_type != SELVA_OBJECT_NULL) {
        selva_send_str(resp, "OK", 2);
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    if (old_type == SELVA_OBJECT_STRING && !SelvaObject_GetString(obj, field, &old_value)) {
        TO_STR(old_value);

        if (old_value && old_value_len == value_len && !memcmp(old_value_str, value_str, value_len)) {
            if (!strcmp(field_str, "type")) {
                /*
                 * Always send "UPDATED" for the "type" field because the
                 * client will/should only send a it for a new node but
                 * typically the field is already set by using the type map.
                 */
                selva_send_str(resp, "UPDATED", 7);
            } else {
                selva_send_str(resp, "OK", 2);
            }
            return SELVA_OP_REPL_STATE_UNCHANGED;
        }
    }

    err = SelvaObject_SetString(obj, field, value);
    if (err) {
        selva_send_errorf(resp, err, "Failed to set a string value");
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }
    finalizer_forget(fin, value);

    return SELVA_OP_REPL_STATE_UPDATED;
}

static enum selva_op_repl_state op_longlong(
        struct finalizer *,
        struct selva_server_response_out *resp,
        SelvaHierarchy *,
        struct SelvaHierarchyNode *node,
        char type_code,
        struct selva_string *field,
        struct selva_string *value) {
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(node);
    TO_STR(value);
    long long ll;
    int err;

    if (value_len != sizeof(ll)) {
        REPLY_WITH_ARG_TYPE_ERROR(ll);
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    memcpy(&ll, value_str, sizeof(ll));

    if (type_code == SELVA_MODIFY_ARG_DEFAULT_LONGLONG) {
        err = SelvaObject_SetLongLongDefault(obj, field, ll);
    } else {
        err = SelvaObject_UpdateLongLong(obj, field, ll);
    }
    if (err == SELVA_EEXIST) { /* Default handling. */
        selva_send_str(resp, "OK", 2);
        return SELVA_OP_REPL_STATE_UNCHANGED;
    } else if (err) {
        selva_send_error(resp, err, NULL, 0);
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    return SELVA_OP_REPL_STATE_UPDATED;
}

static enum selva_op_repl_state op_double(
        struct finalizer *,
        struct selva_server_response_out *resp,
        SelvaHierarchy *,
        struct SelvaHierarchyNode *node,
        char type_code,
        struct selva_string *field,
        struct selva_string *value) {
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(node);
    TO_STR(value);
    double d;
    int err;

    if (value_len != sizeof(d)) {
        REPLY_WITH_ARG_TYPE_ERROR(d);
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    memcpy(&d, value_str, sizeof(d));

    if (type_code == SELVA_MODIFY_ARG_DEFAULT_DOUBLE) {
        err = SelvaObject_SetDoubleDefault(obj, field, d);
    } else {
        err = SelvaObject_UpdateDouble(obj, field, d);
    }
    if (err == SELVA_EEXIST) { /* Default handling. */
        selva_send_str(resp, "OK", 2);
        return SELVA_OP_REPL_STATE_UNCHANGED;
    } else if (err) {
        selva_send_error(resp, err, NULL, 0);
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    return SELVA_OP_REPL_STATE_UPDATED;
}

static enum selva_op_repl_state op_meta(
        struct finalizer *,
        struct selva_server_response_out *resp,
        SelvaHierarchy *,
        struct SelvaHierarchyNode *node,
        char type_code __unused,
        struct selva_string *field,
        struct selva_string *value) {
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(node);

    return SelvaModify_ModifyMetadata(resp, obj, field, value);
}

static enum selva_op_repl_state op_notsup(
        struct finalizer *,
        struct selva_server_response_out *resp,
        SelvaHierarchy *,
        struct SelvaHierarchyNode *,
        char type_code,
        struct selva_string *field __unused,
        struct selva_string *value __unused) {
    selva_send_errorf(resp, SELVA_EINTYPE, "Invalid type: \"%c\"", type_code);
    return SELVA_OP_REPL_STATE_UNCHANGED;
}

static enum selva_op_repl_state modify_edge_meta_op(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct SelvaHierarchyNode *node,
        struct selva_string *field,
        struct selva_string *raw_value) {
    TO_STR(field);
    struct SelvaObject *edge_metadata;
    const struct SelvaModify_OpEdgeMeta *op;
    enum SelvaModify_OpEdgeMetaCode op_code;
    int err;

    op = SelvaModify_OpEdgeMeta_align(fin, raw_value);
    if (!op) {
        selva_send_error(resp, SELVA_EINVAL, NULL, 0);
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    err = SelvaHierarchy_GetEdgeMetadata(node, field_str, field_len, op->dst_node_id, op->delete_all, true, &edge_metadata);
    if (err == SELVA_ENOENT || !edge_metadata) {
        selva_send_errorf(resp, SELVA_ENOENT, "Edge field not found, field: \"%.*s\"",
                          (int)field_len, field_str);
        return SELVA_OP_REPL_STATE_UNCHANGED;
    } else if (err) {
        selva_send_errorf(resp, err, "Failed to get edge metadata");
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    op_code = op->op_code;
    if (op_code == SELVA_MODIFY_OP_EDGE_META_DEFAULT_STRING ||
        op_code == SELVA_MODIFY_OP_EDGE_META_STRING) {
        const enum SelvaObjectType old_type = SelvaObject_GetTypeStr(edge_metadata, op->meta_field_name_str, op->meta_field_name_len);
        struct selva_string *old_value;
        struct selva_string *meta_field_value;

        if (op_code == SELVA_MODIFY_OP_EDGE_META_DEFAULT_STRING && old_type != SELVA_OBJECT_NULL) {
            selva_send_str(resp, "OK", 2);
            return SELVA_OP_REPL_STATE_UNCHANGED;
        }

        if (old_type == SELVA_OBJECT_STRING && !SelvaObject_GetStringStr(edge_metadata, op->meta_field_name_str, op->meta_field_name_len, &old_value)) {
            TO_STR(old_value);

            if (old_value && old_value_len == op->meta_field_value_len && !memcmp(old_value_str, op->meta_field_value_str, op->meta_field_value_len)) {
                selva_send_str(resp, "OK", 2);
                return SELVA_OP_REPL_STATE_UNCHANGED;
            }
        }

        meta_field_value = selva_string_create(op->meta_field_value_str, op->meta_field_value_len, 0);
        err = SelvaObject_SetStringStr(edge_metadata, op->meta_field_name_str, op->meta_field_name_len, meta_field_value);
        if (err) {
            selva_string_free(meta_field_value);
            selva_send_errorf(resp, err, "Failed to set a string value");
            return SELVA_OP_REPL_STATE_UNCHANGED;
        }
    } else if (op_code == SELVA_MODIFY_OP_EDGE_META_DEFAULT_LONGLONG ||
               op_code == SELVA_MODIFY_OP_EDGE_META_LONGLONG) {
        long long ll;

        if (op->meta_field_value_len != sizeof(ll)) {
            REPLY_WITH_ARG_TYPE_ERROR(ll);
            return SELVA_OP_REPL_STATE_UNCHANGED;
        }

        memcpy(&ll, op->meta_field_value_str, sizeof(ll));

        if (op_code == SELVA_MODIFY_OP_EDGE_META_DEFAULT_LONGLONG) {
            err = SelvaObject_SetLongLongDefaultStr(edge_metadata, op->meta_field_name_str, op->meta_field_name_len, ll);
        } else {
            err = SelvaObject_UpdateLongLongStr(edge_metadata, op->meta_field_name_str, op->meta_field_name_len, ll);
        }
        if (err == SELVA_EEXIST) { /* Default handling */
            selva_send_str(resp, "OK", 2);
            return SELVA_OP_REPL_STATE_UNCHANGED;
        } else if (err) {
            selva_send_error(resp, err, NULL, 0);
            return SELVA_OP_REPL_STATE_UNCHANGED;
        }
    } else if (op_code == SELVA_MODIFY_OP_EDGE_META_DEFAULT_DOUBLE ||
               op_code == SELVA_MODIFY_OP_EDGE_META_DOUBLE) {
        double d;

        if (op->meta_field_value_len != sizeof(d)) {
            REPLY_WITH_ARG_TYPE_ERROR(d);
            return SELVA_OP_REPL_STATE_UNCHANGED;
        }

        memcpy(&d, op->meta_field_value_str, sizeof(d));

        if (op_code == SELVA_MODIFY_OP_EDGE_META_DEFAULT_DOUBLE) {
            err = SelvaObject_SetDoubleDefaultStr(edge_metadata, op->meta_field_name_str, op->meta_field_name_len, d);
        } else {
            err = SelvaObject_UpdateDoubleStr(edge_metadata, op->meta_field_name_str, op->meta_field_name_len, d);
        }
        if (err == SELVA_EEXIST) { /* Default handling. */
            selva_send_str(resp, "OK", 2);
            return SELVA_OP_REPL_STATE_UNCHANGED;
        } else if (err) {
            selva_send_error(resp, err, NULL, 0);
            return SELVA_OP_REPL_STATE_UNCHANGED;
        }
    } else if (op_code == SELVA_MODIFY_OP_EDGE_META_DEL) {
        err = SelvaObject_DelKeyStr(edge_metadata, op->meta_field_name_str, op->meta_field_name_len);
        if (err == SELVA_ENOENT) {
            /* No need to replicate. */
            selva_send_str(resp, "OK", 2);
            return SELVA_OP_REPL_STATE_UNCHANGED;
        } else if (err) {
            selva_send_error(resp, err, NULL, 0);
            return SELVA_OP_REPL_STATE_UNCHANGED;
        }
    } else {
        selva_send_error(resp, SELVA_EINTYPE, NULL, 0);
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    return SELVA_OP_REPL_STATE_UPDATED;
}

static enum selva_op_repl_state modify_hll(
        struct selva_server_response_out *resp,
        struct SelvaHierarchyNode *node,
        struct selva_string *field,
        struct selva_string *raw_value) {
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(node);
    TO_STR(field);
    size_t size;
    const char *values = SelvaModify_OpHll_align(raw_value, &size);
    int updated = 0;

    if (!values) {
        selva_send_errorf(resp, SELVA_EINVAL, "Invalid SelvaModify_OpHll");
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    const char *s;
    const char *end = (values + size);
    size_t it = 0;
    while ((s = sztok(values, size, &it))) {
        const size_t slen = strnlen(s, end - s);

        /* TODO Shouldn't ignore errors here. */
        updated |= SelvaObject_AddHllStr(obj, field_str, field_len, s, slen) > 0;
    }

    if (updated) {
        return SELVA_OP_REPL_STATE_UPDATED;
    } else {
        selva_send_str(resp, "OK", 2);
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }
}

static void replicate_modify(struct selva_server_response_out *resp, const struct bitmap *replset, struct selva_string **orig_argv, const struct replicate_ts *rs)
{
    const int leading_args = 2; /* [key, flags] */
    const long long count = bitmap_popcount(replset);
    struct selva_proto_builder_msg msg;

    if (count == 0 && !rs->created && !rs->updated) {
        return; /* Skip. */
    }

    selva_proto_builder_init(&msg, true);

    /*
     * Insert the leading args.
     */
    for (int i = 0; i < leading_args; i++) {
        size_t len;
        const char *str = selva_string_to_str(orig_argv[i], &len);

        selva_proto_builder_insert_string(&msg, str, len);
    }

    /*
     * Insert changes.
     */
    int i_arg_type = leading_args;
    for (int i = 0; i < (int)replset->nbits; i++) {
        if (bitmap_get(replset, i)) {
            for (int j = 0; j < 3; j++) {
                size_t len;
                const char *str = selva_string_to_str(orig_argv[i_arg_type + j], &len);

                selva_proto_builder_insert_string(&msg, str, len);
            }
        }
        i_arg_type += 3;
    }

    /*
     * Make sure created_at field is always in sync on all nodes.
     */
    if (rs->created) {
        const char op[2] = { SELVA_MODIFY_ARG_LONGLONG, '\0' };
        size_t size = sizeof(rs->created_at);
        char value[size];

        memcpy(value, &rs->created_at, size);
        selva_proto_builder_insert_string(&msg, op, sizeof(op) - 1);
        selva_proto_builder_insert_string(&msg, SELVA_CREATED_AT_FIELD, sizeof(SELVA_CREATED_AT_FIELD) - 1);
        selva_proto_builder_insert_string(&msg, value, size);
    }

    /*
     * Make sure updated_at field is always in sync on all nodes.
     */
    if (rs->updated) {
        const char op[2] = { SELVA_MODIFY_ARG_LONGLONG, '\0' };
        size_t size = sizeof(rs->updated_at);
        char value[size];

        memcpy(value, &rs->updated_at, size);
        selva_proto_builder_insert_string(&msg, op, sizeof(op) - 1);
        selva_proto_builder_insert_string(&msg, SELVA_UPDATED_AT_FIELD, sizeof(SELVA_UPDATED_AT_FIELD) - 1);
        selva_proto_builder_insert_string(&msg, value, size);
    }

    /*
     * It's kinda not optimal needing to check this global on every replication
     * but it helps us with testing and it's still very negligible overhead.
     */
    if (selva_glob_config.debug_modify_replication_delay_ns > 0) {
        const struct timespec tim = {
            .tv_sec = 0,
            .tv_nsec = selva_glob_config.debug_modify_replication_delay_ns,
        };

        nanosleep(&tim, NULL);
    }

    selva_proto_builder_end(&msg);
    /*
     * The size here is a bit arbitrary. 512 is probably compressible already
     * but 1412 would be closer to the minimum frame that will be sent anyway.
     */
    if (msg.bsize > 512) {
        /*
         * This will add some malloc overhead but hopefully we'll be able to
         * compress the message a little bit.
         */
        selva_replication_replicate(selva_resp_to_ts(resp), selva_resp_to_cmd_id(resp), msg.buf, msg.bsize);
        selva_proto_builder_deinit(&msg);
    } else {
        /*
         * Just pass the ownership of the buffer.
         */
        selva_replication_replicate_pass(selva_resp_to_ts(resp), selva_resp_to_cmd_id(resp), msg.buf, msg.bsize);
        /*
         * Deinit can be omitted because selva_replication_replicate_pass() will
         * free the buffer.
         */
    }
}

int SelvaModify_field_prot_check(const char *field_str, size_t field_len, char type_code) {
    enum selva_field_prot_mode mode = (type_code == SELVA_MODIFY_ARG_OP_DEL) ? SELVA_FIELD_PROT_DEL : SELVA_FIELD_PROT_WRITE;
    enum SelvaObjectType type;

    switch (type_code) {
    case SELVA_MODIFY_ARG_DEFAULT_STRING:
    case SELVA_MODIFY_ARG_STRING:
        type = SELVA_OBJECT_STRING;
        break;
    case SELVA_MODIFY_ARG_DEFAULT_LONGLONG:
    case SELVA_MODIFY_ARG_LONGLONG:
    case SELVA_MODIFY_ARG_OP_INCREMENT:
        type = SELVA_OBJECT_LONGLONG;
        break;
    case SELVA_MODIFY_ARG_DEFAULT_DOUBLE:
    case SELVA_MODIFY_ARG_DOUBLE:
    case SELVA_MODIFY_ARG_OP_INCREMENT_DOUBLE:
        type = SELVA_OBJECT_DOUBLE;
        break;
    case SELVA_MODIFY_ARG_OP_SET:
    case SELVA_MODIFY_ARG_OP_ORD_SET:
        type = SELVA_OBJECT_SET;
        break;
    case SELVA_MODIFY_ARG_OP_HLL:
        type = SELVA_OBJECT_HLL;
        break;
    case SELVA_MODIFY_ARG_OP_OBJ_META:
        type = SELVA_OBJECT_OBJECT;
        break;
    case SELVA_MODIFY_ARG_OP_EDGE_META:
        /* Non-edge fields will be caught later, incl. protected ones. */
        return 1;
    case SELVA_MODIFY_ARG_INVALID:
    case SELVA_MODIFY_ARG_OP_DEL:
    default:
        type = SELVA_OBJECT_NULL;
        break;
    }

    return selva_field_prot_check_str(field_str, field_len, type, mode);
}

/*
 * Request:
 * {node_id, FLAGS, type, field, value [, ... type, field, value]]}
 * N = No root
 * M = Merge
 *
 * The behavior and meaning of `value` depends on `type` (enum SelvaModify_ArgType).
 *
 * Response:
 * [
 * id,
 * [err | 0 | 1]
 * ...
 * ]
 *
 * err = error in parsing or executing the triplet
 * OK = the triplet made no changes
 * UPDATED = changes made and replicated
 */
static void SelvaCommand_Modify(struct selva_server_response_out *resp, const void *buf, size_t len) {
    SELVA_TRACE_BEGIN_AUTO(cmd_modify);
    __auto_finalizer struct finalizer fin;
    SelvaHierarchy *hierarchy = main_hierarchy;
    struct selva_string **argv;
    int argc;
    SVECTOR_AUTOFREE(alias_query);
    bool created = false; /* Will be set if the node was created during this command. */
    bool updated = false;
    /* FIXME Fix $alias handling */
#if 0
    bool new_alias = false; /* Set if $alias will be creating new alias(es). */
#endif
    int err = 0;

    finalizer_init(&fin);

    /*
     * The comparator must be NULL to ensure that the vector is always stored
     * as an array as that is required later on for the modify op.
     */
    SVector_Init(&alias_query, 5, NULL);

    argc = selva_proto_buf2strings(&fin, buf, len, &argv);
    if (argc < 0) {
        selva_send_errorf(resp, argc, "Failed to parse args");
        return;
    } else if (argc < 5 || (argc - 2) % 3) {
        /*
         * We expect two fixed arguments and a number of [type, field, value] triplets.
         */
        selva_send_error_arity(resp);
        return;
    }

    /*
     * We use the ID generated by the client as the nodeId by default but later
     * on if an $alias entry is found then the following value will be discarded.
     */
    Selva_NodeId nodeId;
    err = selva_string2node_id(nodeId, argv[0]);
    if (err) {
        selva_send_errorf(resp, err, "Invalid nodeId");
        return;
    }

    /*
     * Look for $alias that would replace id.
     * FIXME
     */
    pre_parse_ops(argv + 2, argc - 2, &alias_query);
    if (SVector_Size(&alias_query) > 0) {
        Selva_NodeId tmp_id;

#if 0
        new_alias = true;
#endif
        if (find_first_alias(hierarchy, &alias_query, tmp_id)) {
            /*
             * Replace id with the first match from alias_query.
             */
            memcpy(nodeId, tmp_id, SELVA_NODE_ID_SIZE);

            /*
             * If no match was found all the aliases should be assigned.
             * If a match was found the query vector should be cleared now to
             * prevent any new aliases from being created.
             */
            SVector_Clear(&alias_query);
#if 0
            new_alias = false;
#endif
        }
    }

    struct SelvaHierarchyNode *node;
    const enum modify_flags flags = parse_flags(argv[1]);

    node = SelvaHierarchy_FindNode(hierarchy, nodeId);
    if (!node) {
        if (FISSET_UPDATE(flags)) {
            /* if the specified id doesn't exist but $operation: 'update' specified */
            selva_send_errorf(resp, SELVA_HIERARCHY_ENOENT, "Node not found");
            return;
        }

        err = SelvaHierarchy_UpsertNode(hierarchy, nodeId, &node);
        if (err < 0) {
            selva_send_errorf(resp, err, "Failed to initialize the node hierarchy for id: \"%.*s\"", (int)SELVA_NODE_ID_SIZE, nodeId);
            return;
        }
    } else if (FISSET_CREATE(flags)) {
        /* if the specified id exists but $operation: 'insert' specified. */
        selva_send_errorf(resp, SELVA_HIERARCHY_EEXIST, "Node already exists");
        return;
    }

    created = updated = SelvaHierarchy_ClearNodeFlagImplicit(node);
    SelvaSubscriptions_FieldChangePrecheck(hierarchy, node);

    if (!created && FISSET_NO_MERGE(flags)) {
        SelvaHierarchy_ClearNodeFields(SelvaHierarchy_GetNodeObject(node));
    }

    /*
     * Replication bitmap.
     *
     * bit  desc
     * 0    replicate the first triplet
     * 1    replicate the second triplet
     * ...  ...
     */
    const int nr_triplets = (argc - 2) / 3;
    struct bitmap *replset = selva_calloc(1, BITMAP_ALLOC_SIZE(nr_triplets));

    finalizer_add(&fin, replset, selva_free);
    replset->nbits = nr_triplets;
    bitmap_erase(replset);

    /*
     * Parse the rest of the arguments and run the modify operations.
     * Each part of the command will send a separate response back to the client.
     * Each part is also replicated separately.
     */
    selva_send_array(resp, 1 + nr_triplets);
    selva_send_str(resp, nodeId, Selva_NodeIdLen(nodeId));

    for (int i = 2; i < argc; i += 3) {
        struct selva_string *type = argv[i];
        struct selva_string *field = argv[i + 1];
        struct selva_string *value = argv[i + 2];
        TO_STR(type, field);
        const char type_code = type_str[0]; /* [0] always points to a valid char. */
        enum selva_op_repl_state repl_state = SELVA_OP_REPL_STATE_UNCHANGED;

#if 0
        SELVA_LOG(SELVA_LOGL_DBG, "modify %.*s field: %.*s", (int)SELVA_NODE_ID_SIZE, nodeId, (int)field_len, field_str);
#endif

        if (!SelvaModify_field_prot_check(field_str, field_len, type_code)) {
            selva_send_errorf(resp, SELVA_ENOTSUP, "Protected field. type_code: %c field: \"%.*s\"",
                              type_code, (int)field_len, field_str);
            continue;
        }

        /* TODO Use modify_op_fn for all */
        if (type_code == SELVA_MODIFY_ARG_OP_EDGE_META) {
            repl_state = modify_edge_meta_op(&fin, resp, node, field, value);
        } else if (type_code == SELVA_MODIFY_ARG_OP_HLL) {
            repl_state = modify_hll(resp, node, field, value);
        } else {
            repl_state = modify_op_fn[(uint8_t)type_code](&fin, resp, hierarchy, node, type_code, field, value);
        }

        if (repl_state == SELVA_OP_REPL_STATE_REPLICATE) {
            /* This triplet needs to be replicated. */
            bitmap_set(replset, (i - 2) / 3);

            selva_send_str(resp, "OK", 2);
        } else if (repl_state == SELVA_OP_REPL_STATE_UPDATED) {
            /* This triplet needs to be replicated. */
            bitmap_set(replset, (i - 2) / 3);

            SelvaSubscriptions_DeferFieldChangeEvents(hierarchy, node, field_str, field_len);

            selva_send_str(resp, "UPDATED", 7);
            updated = true;
        }
    }

    /*
     * If the size of alias_query is greater than zero it means that no match
     * was found for $alias and we need to create all the aliases listed in the
     * query.
     */
    if (SVector_Size(&alias_query) > 0) {
        struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(node);
        struct selva_string *aliases_field = selva_string_create(SELVA_ALIASES_FIELD, sizeof(SELVA_ALIASES_FIELD) - 1, 0);
        struct SVectorIterator it;
        char *alias;

        SVector_ForeachBegin(&it, &alias_query);
        while ((alias = SVector_Foreach(&it))) {
            struct SelvaModify_OpSet opSet = {
                .op_set_type = SELVA_MODIFY_OP_SET_TYPE_CHAR,
                .$add_str = alias,
                .$add_len = strlen(alias) + 1, /* This is safe because the ultimate source is a selva_string. */
                .$delete_str = NULL,
                .$delete_len = 0,
                .$value_str = NULL,
                .$value_len = 0,
            };

            err = SelvaModify_ModifySet(hierarchy, nodeId, node, obj, aliases_field, &opSet);
            if (err < 0) {
                /*
                 * Since we are already at the end of the command, it's next to
                 * impossible to rollback the command, so we'll just log any
                 * errors received here.
                 */
                SELVA_LOG(SELVA_LOGL_ERR, "An error occurred while setting an alias \"%s\" -> %.*s. err: \"%s\"",
                          alias,
                          (int)SELVA_NODE_ID_SIZE, nodeId,
                          selva_strerror(err));
            }
        }

        selva_string_free(aliases_field);
    }

    if (created) {
        SelvaSubscriptions_DeferTriggerEvents(hierarchy, node, SELVA_SUBSCRIPTION_TRIGGER_TYPE_CREATED);
    }
    if (updated && !created) {
        /*
         * If nodeId wasn't created by this command call but it was updated
         * then we need to defer the updated trigger.
         */
        SelvaSubscriptions_DeferTriggerEvents(hierarchy, node, SELVA_SUBSCRIPTION_TRIGGER_TYPE_UPDATED);

        if (selva_replication_get_mode() == SELVA_REPLICATION_MODE_REPLICA) {
            struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(node);
            const int64_t now = selva_resp_to_ts(resp);

            /*
             * If the node was created then the field was already updated by hierarchy.
             * If the command was replicated then the master should send us the correct
             * timestamp.
             */
            SelvaObject_SetLongLongStr(obj, SELVA_UPDATED_AT_FIELD, sizeof(SELVA_UPDATED_AT_FIELD) - 1, now);
            SelvaSubscriptions_DeferFieldChangeEvents(hierarchy, node, SELVA_UPDATED_AT_FIELD, sizeof(SELVA_UPDATED_AT_FIELD) - 1);
        }
    }

    if (created || updated) {
        selva_io_set_dirty();
    }

    if (selva_replication_get_mode() == SELVA_REPLICATION_MODE_ORIGIN) {
        struct replicate_ts replicate_ts;

        get_replicate_ts(&replicate_ts, node, created, updated);
        replicate_modify(resp, replset, argv, &replicate_ts);
    }

    SelvaSubscriptions_SendDeferredEvents(hierarchy);

    return;
}

#if 0
static int Modify_OnLoad(void) {
    for (size_t i = 0; i < num_elem(modify_op_fn); i++) {
        modify_op_fn[i] = op_notsup;
    }

    modify_op_fn[SELVA_MODIFY_ARG_OP_INCREMENT] = op_increment_longlong;
    modify_op_fn[SELVA_MODIFY_ARG_OP_INCREMENT_DOUBLE] = op_increment_double;
    modify_op_fn[SELVA_MODIFY_ARG_OP_SET] = op_set;
    modify_op_fn[SELVA_MODIFY_ARG_OP_ORD_SET] = op_ord_set;
    modify_op_fn[SELVA_MODIFY_ARG_OP_DEL] = op_del;
    modify_op_fn[SELVA_MODIFY_ARG_DEFAULT_STRING] = op_string;
    modify_op_fn[SELVA_MODIFY_ARG_STRING] = op_string;
    modify_op_fn[SELVA_MODIFY_ARG_DEFAULT_LONGLONG] = op_longlong;
    modify_op_fn[SELVA_MODIFY_ARG_LONGLONG] = op_longlong;
    modify_op_fn[SELVA_MODIFY_ARG_DEFAULT_DOUBLE] = op_double;
    modify_op_fn[SELVA_MODIFY_ARG_DOUBLE] = op_double;
    modify_op_fn[SELVA_MODIFY_ARG_OP_OBJ_META] = op_meta;

    selva_mk_command(CMD_ID_MODIFY, SELVA_CMD_MODE_MUTATE, "modify", SelvaCommand_Modify);

    return 0;
}
SELVA_ONLOAD(Modify_OnLoad);
#endif
