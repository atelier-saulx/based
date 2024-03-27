/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 * TODO More strict schema checking.
 */
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "endian.h"
#include "jemalloc.h"
#include "util/bitmap.h"
#include "util/cstrings.h"
#include "util/data-record.h"
#include "util/finalizer.h"
#include "util/selva_string.h"
#include "selva_error.h"
#include "selva_log.h"
#include "selva_proto.h"
#include "selva_server.h"
#include "selva_io.h"
#include "selva_trace.h"
#include "comparator.h"
#include "edge.h"
#include "hierarchy.h"
#include "schema.h"
#include "selva_db_types.h"
#include "selva_object.h"
#include "selva_set.h"
#include "selva_onload.h"
#include "subscriptions.h"
#include "typestr.h"

struct SelvaModifyFieldOp {
    enum SelvaModifyOpCode {
        SELVA_MODIFY_OP_DEL = 0, /*!< Delete field. */
        SELVA_MODIFY_OP_STRING = 1,
        SELVA_MODIFY_OP_STRING_DEFAULT = 2,
        SELVA_MODIFY_OP_LONGLONG = 3,
        SELVA_MODIFY_OP_LONGLONG_DEFAULT = 4,
        SELVA_MODIFY_OP_LONGLONG_INCREMENT = 5,
        SELVA_MODIFY_OP_DOUBLE = 6,
        SELVA_MODIFY_OP_DOUBLE_DEFAULT = 7,
        SELVA_MODIFY_OP_DOUBLE_INCREMENT = 8,
        SELVA_MODIFY_OP_SET_VALUE = 9,
        SELVA_MODIFY_OP_SET_INSERT = 10,
        SELVA_MODIFY_OP_SET_REMOVE = 11,
        SELVA_MODIFY_OP_SET_ASSIGN = 12,
        SELVA_MODIFY_OP_SET_MOVE = 13,
        SELVA_MODIFY_OP_EDGE_META = 14, /*!< Value is `struct SelvaModifyEdgeMeta`. */
    } __packed op;
    enum {
        SELVA_MODIFY_OP_FLAGS_VALUE_IS_DEFLATED = 0x01,
    } __packed flags;
    char lang[2];
    uint32_t index;
    char field_name[SELVA_SHORT_FIELD_NAME_LEN];
    /**
     * Field value.
     * Expected format depends on the op code.
     */
    const char *value_str;
    size_t value_len;
};

/**
 * SELVA_MODIFY_OP_LONGLONG_INCREMENT.
 */
struct SelvaModifyLongLongIncrement {
    long long default_value;
    long long increment;
};

/**
 * SELVA_MODIFY_OP_DOUBLE_INCREMENT.
 */
struct SelvaModifyDoubleIncrement {
    double default_value;
    long long increment;
};

/**
 * Set operations.
 */
struct SelvaModifySet {
    enum SelvaModifySetType {
        SELVA_MODIFY_SET_TYPE_CHAR = 0,
        SELVA_MODIFY_SET_TYPE_REFERENCE = 1, /*!< Items are of size SELVA_NODE_ID_SIZE. */
        SELVA_MODIFY_SET_TYPE_DOUBLE = 2,
        SELVA_MODIFY_SET_TYPE_LONG_LONG = 3,
    } __packed type;

    /**
     * Index for ordered set.
     * Must be less than or equal to the size of the current set.
     * Can be negative for counting from the last item.
     */
    ssize_t index;

    /**
     * Insert these elements to the ordered set starting from index.
     *
     * **Insert**
     * List of nodes to be inserted starting from `index`. If the EdgeField
     * doesn't exist, it will be created.
     *
     * **Assign**
     *
     * List of nodes to be replaced starting from `index`.
     * If the edgeField doesn't exist yet then `index` must be set 0.
     *
     * **Delete**
     * List of nodes to be deleted starting from `index`. The nodes must exist
     * on the edgeField in the exact order starting from `index`.
     *
     * **Move**
     * Move listed nodes to `index`. The nodes must exist but they don't need to
     * be consecutive. The move will happen in reverse order.
     * E.g. `[1, 2, 3]` will be inserted as `[3, 2, 1]`.
     */
    const char *value_str;
    size_t value_len;
};

/**
 * SELVA_MODIFY_OP_EDGE_META.
 */
struct SelvaModifyEdgeMeta {
    enum SelvaModifyOpCode op;
    int8_t delete_all; /*!< Delete all metadata from this edge field. */

    char dst_node_id[SELVA_NODE_ID_SIZE];

    const char *meta_field_name_str;
    size_t meta_field_name_len;

    const char *meta_field_value_str;
    size_t meta_field_value_len;
};

struct modify_header {
    Selva_NodeId node_id;
    enum {
        FLAG_NO_MERGE = 0x01, /*!< Clear any existing fields. */
        FLAG_CREATE =   0x02, /*!< Only create a new node or fail. */
        FLAG_UPDATE =   0x04, /*!< Only update an existing node. */
        FLAG_ALIAS =    0x08, /*!< An alias query follows this header. */
    } flags;
    uint32_t nr_changes;
};

struct modify_ctx {
    struct selva_server_response_out *resp;
    struct finalizer *fin;
    struct modify_header head;
    struct SelvaHierarchy *hierarchy;
#if 0
    struct bitmap *replset;
#endif
    struct SelvaHierarchyNode *node;
    bool created; /* Will be set if the node was created during this command. */
    bool updated;
    struct SelvaNodeSchema *ns;
    struct modify_current_field {
        struct SelvaFieldSchema *fs;
        size_t name_len;
        char name_str[SELVA_SHORT_FIELD_NAME_LEN + 12];
    } cur_field;
};

#define SELVA_OP_REPL_STATE_UNCHANGED 0
#define SELVA_OP_REPL_STATE_UPDATED 1

#define REPLY_WITH_ARG_TYPE_ERROR(v) do { \
    selva_send_errorf(ctx->resp, SELVA_EINTYPE, "Expected: %s", typeof_str(v)); \
    return SELVA_EINTYPE; \
} while (0)

static ssize_t string2selva_string(struct finalizer *fin, enum SelvaModifySetType type, const char *s, struct selva_string **out)
{
    size_t len;

    switch (type) {
    case SELVA_MODIFY_SET_TYPE_CHAR:
        len = strlen(s);
        break;
    case SELVA_MODIFY_SET_TYPE_REFERENCE:
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
 * Make an SVector out of the values in value_str.
 * Note that the SVector vec will point to the strings in value_str, and
 * thus it must not be freed unless the SVector is also destroyed.
 * @param value_len must be value_len % SELVA_NODE_ID_SIZE == 0.
 */
static void opSet_refs_to_svector(SVector *vec, const char *value_str, size_t value_len)
{
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

static int SelvaModify_ModifyDel(
    struct SelvaHierarchy *hierarchy,
    struct SelvaHierarchyNode *node,
    struct SelvaObject *obj,
    const char *field_str,
    size_t field_len
) {
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

static int add_set_values_char(
    struct SelvaHierarchy *hierarchy,
    struct SelvaObject *obj,
    const Selva_NodeId node_id,
    const char *field_str,
    size_t field_len,
    const char *value_ptr,
    size_t value_len,
    enum SelvaModifySetType type,
    int remove_diff)
{
    const bool is_aliases = SELVA_IS_ALIASES_FIELD(field_str, field_len);
    const char *ptr = value_ptr;
    SVector new_set;
    __auto_finalizer struct finalizer fin;
    int res = 0;

    finalizer_init(&fin);

    /* Check that the value divides into elements properly. */
    if ((type == SELVA_MODIFY_SET_TYPE_REFERENCE && (value_len % SELVA_NODE_ID_SIZE)) ||
        (type == SELVA_MODIFY_SET_TYPE_DOUBLE && (value_len % sizeof(double))) ||
        (type == SELVA_MODIFY_SET_TYPE_LONG_LONG && (value_len % sizeof(long long)))) {
        return SELVA_EINVAL;
    }

    if (remove_diff) {
        size_t inital_size = (type == SELVA_MODIFY_SET_TYPE_REFERENCE) ? value_len / SELVA_NODE_ID_SIZE : 1;

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
        err = SelvaObject_AddStringSetStr(obj, field_str, field_len, ref);
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
        const size_t skip_off = type == SELVA_MODIFY_SET_TYPE_REFERENCE ? SELVA_NODE_ID_SIZE : (size_t)part_len + (type == SELVA_MODIFY_SET_TYPE_CHAR);
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
        struct SelvaSet *objSet = SelvaObject_GetSetStr(obj, field_str, field_len);
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
    const char *field_str,
    size_t field_len,
    const char *value_ptr,
    size_t value_len,
    enum SelvaModifySetType type,
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
        if (type == SELVA_MODIFY_SET_TYPE_DOUBLE) {
            double v;

            part_len = sizeof(double);
            memcpy(&v, ptr, part_len);
            err = SelvaObject_AddDoubleSetStr(obj, field_str, field_len, v);
        } else { /* SELVA_MODIFY_SET_TYPE_LONG_LONG */
            long long v;

            part_len = sizeof(long long);
            memcpy(&v, ptr, part_len);
            err = SelvaObject_AddLongLongSetStr(obj, field_str, field_len, v);
        }
        if (err == 0) {
            res++;
        } else if (err != SELVA_EEXIST) {
            SELVA_LOG(SELVA_LOGL_ERR, "Set (%s) field update failed. err: \"%s\"",
                      (type == SELVA_MODIFY_SET_TYPE_DOUBLE) ? "double" : "long long",
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
        struct SelvaSet *objSet = SelvaObject_GetSetStr(obj, field_str, field_len);

        assert(objSet);
        if (type == SELVA_MODIFY_SET_TYPE_DOUBLE && objSet->type == SELVA_SET_TYPE_DOUBLE) {
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
        } else if (type == SELVA_MODIFY_SET_TYPE_LONG_LONG && objSet->type == SELVA_SET_TYPE_LONGLONG) {
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
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        struct modify_current_field *field,
        const char *value_ptr,
        size_t value_len,
        enum SelvaModifySetType type,
        bool remove_diff
) {
    Selva_NodeId node_id;
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(node);

    SelvaHierarchy_GetNodeId(node_id, node);

    /* TODO HLL support */
    if (type == SELVA_MODIFY_SET_TYPE_CHAR ||
        type == SELVA_MODIFY_SET_TYPE_REFERENCE) {
        return add_set_values_char(hierarchy, obj, node_id, field->name_str, field->name_len, value_ptr, value_len, type, remove_diff);
    } else if (type == SELVA_MODIFY_SET_TYPE_DOUBLE ||
               type == SELVA_MODIFY_SET_TYPE_LONG_LONG) {
        return add_set_values_numeric(obj, field->name_str, field->name_len, value_ptr, value_len, type, remove_diff);
    } else {
        return SELVA_EINTYPE;
    }
}

static int del_set_values_char(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        struct modify_current_field *field,
        const char *value_ptr,
        size_t value_len,
        int8_t type) {
    const char *field_str = field->name_str;
    size_t field_len = field->name_len;
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(node);
    const int is_aliases = SELVA_IS_ALIASES_FIELD(field_str, field_len);
    const char *ptr = value_ptr;
    int res = 0;

    if (type == SELVA_MODIFY_SET_TYPE_REFERENCE && (value_len % SELVA_NODE_ID_SIZE)) {
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
        err = SelvaObject_RemStringSetStr(obj, field_str, field_len, ref);
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
        const size_t skip_off = type == SELVA_MODIFY_SET_TYPE_REFERENCE ? SELVA_NODE_ID_SIZE : (size_t)part_len + (type == SELVA_MODIFY_SET_TYPE_CHAR);
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
        struct SelvaHierarchyNode *node,
        struct modify_current_field *field,
        const char *value_ptr,
        size_t value_len,
        enum SelvaModifySetType type) {
    const char *field_str = field->name_str;
    size_t field_len = field->name_len;
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(node);
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
        if (type == SELVA_MODIFY_SET_TYPE_DOUBLE) {
            double v;

            part_len = sizeof(double);
            memcpy(&v, ptr, part_len);
            err = SelvaObject_RemDoubleSetStr(obj, field_str, field_len, v);
        } else {
            long long v;

            part_len = sizeof(long long);
            memcpy(&v, ptr, part_len);
            err = SelvaObject_RemLongLongSetStr(obj, field_str, field_len, v);
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
        struct SelvaHierarchyNode *node,
        struct modify_current_field *field,
        const char *value_ptr,
        size_t value_len,
        enum SelvaModifySetType type
) {
    if (type == SELVA_MODIFY_SET_TYPE_CHAR ||
        type == SELVA_MODIFY_SET_TYPE_REFERENCE) {
        return del_set_values_char(hierarchy, node, field, value_ptr, value_len, type);
    } else if (type == SELVA_MODIFY_SET_TYPE_DOUBLE ||
               type == SELVA_MODIFY_SET_TYPE_LONG_LONG) {
        return del_set_values_numeric(node, field, value_ptr, value_len, type);
    } else {
        return SELVA_EINTYPE;
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
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        const char *value_str,
        size_t value_len) {
    int res = 0;
    size_t orig_len = 0;
    SVECTOR_AUTOFREE(new_ids);

    assert(value_len % SELVA_NODE_ID_SIZE == 0);

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

static int insert_edges(
        struct SelvaHierarchy *hierarchy,
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
 * Delete nodes from the EdgeField.
 * The list of nodeIds in value_str acts as a condition variable for the deletion,
 * preventing a race condition between two clients.
 * @param value_str a list of nodes that exist in the EdgeField starting from index.
 * @param index is the deletion index.
 * @returns Return the number of chages made; Otherwise a selva error is returned.
 */
static int remove_edges(
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
 * Assign nodes in the list value_str to the EdgeField starting from index replacing the original edges.
 * @returns Return the number of chages made; Otherwise a selva error is returned.
 */
static int assign_edges(
        struct SelvaHierarchy *hierarchy,
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

static int selva_modify_op_del(struct modify_ctx *ctx, struct SelvaModifyFieldOp *)
{
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(ctx->node);
    int err;

    err = SelvaModify_ModifyDel(ctx->hierarchy, ctx->node, obj, ctx->cur_field.name_str, ctx->cur_field.name_len);
    if (err == SELVA_ENOENT) {
        /* No need to replicate. */
        return SELVA_OP_REPL_STATE_UNCHANGED;
    } else if (err) {
        selva_send_errorf(ctx->resp, err, "Failed to delete the field: \"%.*s\"",
                          (int)ctx->cur_field.name_len, ctx->cur_field.name_str);
        return err;
    }

    return SELVA_OP_REPL_STATE_UPDATED;
}

static int selva_modify_op_string(struct modify_ctx *ctx, struct SelvaModifyFieldOp *op)
{
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(ctx->node);
    const char *field_str = ctx->cur_field.name_str;
    size_t field_len = ctx->cur_field.name_len;
    const enum SelvaObjectType old_type = SelvaObject_GetTypeStr(obj, field_str, field_len);
    struct selva_string *new_value;
    int err;

    if (op->op == SELVA_MODIFY_OP_STRING_DEFAULT && old_type != SELVA_OBJECT_NULL) {
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    new_value = selva_string_create(op->value_str, op->value_len, 0);

    if (old_type == SELVA_OBJECT_STRING) {
        struct selva_string *old_value;

        if (!SelvaObject_GetStringStr(obj, field_str, field_len, &old_value)) {
            if (old_value && !selva_string_cmp(old_value, new_value)) {
                selva_string_free(new_value);
                return SELVA_OP_REPL_STATE_UNCHANGED;
            }
        }
    }

    err = SelvaObject_SetStringStr(obj, field_str, field_len, new_value);
    if (err) {
        selva_string_free(new_value);
        selva_send_errorf(ctx->resp, err, "Failed to set a string value");
        return err;
    }

    return SELVA_OP_REPL_STATE_UPDATED;
}

static int selva_modify_op_longlong(struct modify_ctx *ctx, struct SelvaModifyFieldOp *op)
{
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(ctx->node);
    long long ll;
    int err;

    if (op->value_len != sizeof(ll)) {
        REPLY_WITH_ARG_TYPE_ERROR(ll);
    }

    memcpy(&ll, op->value_str, sizeof(ll));

    err = (op->op == SELVA_MODIFY_OP_LONGLONG_DEFAULT)
        ? SelvaObject_SetLongLongDefaultStr(obj, ctx->cur_field.name_str, ctx->cur_field.name_len, ll)
        : SelvaObject_UpdateLongLongStr(obj, ctx->cur_field.name_str, ctx->cur_field.name_len, ll);
    if (err == SELVA_EEXIST) { /* Default handling. */
        return SELVA_OP_REPL_STATE_UNCHANGED;
    } else if (err) {
        selva_send_error(ctx->resp, err, NULL, 0);
        return err;
    }

    return SELVA_OP_REPL_STATE_UPDATED;
}

static int selva_modify_op_longlong_increment(struct modify_ctx *ctx, struct SelvaModifyFieldOp *op)
{
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(ctx->node);
    struct SelvaModifyLongLongIncrement v;
    int err;

    if (op->value_len < sizeof(v)) {
        err = SELVA_EINVAL;
        selva_send_error(ctx->resp, err, NULL, 0);
        return err;
    }

    memcpy(&v, op->value_str, sizeof(v));
    v.default_value = letoh(v.default_value);
    v.increment = letoh(v.increment);

    err = SelvaObject_IncrementLongLongStr(obj, ctx->cur_field.name_str, ctx->cur_field.name_len, v.default_value, v.increment, NULL);
    if (err) {
        selva_send_error(ctx->resp, err, NULL, 0);
        return err;
    }

    return SELVA_OP_REPL_STATE_UPDATED;
}

static int selva_modify_op_double(struct modify_ctx *ctx, struct SelvaModifyFieldOp *op)
{
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(ctx->node);
    double d;
    int err;

    if (op->value_len != sizeof(d)) {
        REPLY_WITH_ARG_TYPE_ERROR(d);
    }

    memcpy(&d, op->value_str, sizeof(d));

    err = (op->op == SELVA_MODIFY_OP_LONGLONG_DEFAULT)
        ? SelvaObject_SetDoubleDefaultStr(obj, ctx->cur_field.name_str, ctx->cur_field.name_len, d)
        : SelvaObject_UpdateDoubleStr(obj, ctx->cur_field.name_str, ctx->cur_field.name_len, d);
    if (err == SELVA_EEXIST) { /* Default handling. */
        return SELVA_OP_REPL_STATE_UNCHANGED;
    } else if (err) {
        selva_send_error(ctx->resp, err, NULL, 0);
        return err;
    }

    return SELVA_OP_REPL_STATE_UPDATED;
}

static int selva_modify_op_double_increment(struct modify_ctx *ctx, struct SelvaModifyFieldOp *op)
{
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(ctx->node);
    struct SelvaModifyDoubleIncrement v;
    int err;

    if (op->value_len < sizeof(v)) {
        err = SELVA_EINVAL;
        selva_send_error(ctx->resp, err, NULL, 0);
        return err;
    }

    v.default_value = ledoubletoh(op->value_str);
    v.increment = ledoubletoh(op->value_str + sizeof(double));

    err = SelvaObject_IncrementDoubleStr(obj, ctx->cur_field.name_str, ctx->cur_field.name_len, v.default_value, v.increment, NULL);
    if (err) {
        selva_send_error(ctx->resp, err, NULL, 0);
        return err;
    }

    return SELVA_OP_REPL_STATE_UPDATED;
}

static int selva_modify_op_set_data(struct modify_ctx *ctx, enum SelvaModifyOpCode op, struct SelvaModifySet *set)
{
    switch (op) {
    case SELVA_MODIFY_OP_SET_VALUE:
        return add_set_values(ctx->hierarchy, ctx->node, &ctx->cur_field, set->value_str, set->value_len, set->type, true);
    case SELVA_MODIFY_OP_SET_INSERT:
        return add_set_values(ctx->hierarchy, ctx->node, &ctx->cur_field, set->value_str, set->value_len, set->type, false);
    case SELVA_MODIFY_OP_SET_REMOVE:
        return del_set_values(ctx->hierarchy, ctx->node, &ctx->cur_field, set->value_str, set->value_len, set->type);
    case SELVA_MODIFY_OP_SET_ASSIGN:
        return SELVA_ENOTSUP;
    case SELVA_MODIFY_OP_SET_MOVE:
        return SELVA_ENOTSUP;
    default:
        return SELVA_EINVAL;
    }
}

static int selva_modify_op_set_edge(struct modify_ctx *ctx, enum SelvaModifyOpCode op, struct SelvaModifySet *set)
{
    int res = 0;
    const char *field_str = ctx->cur_field.name_str;
    size_t field_len = ctx->cur_field.name_len;

    assert(set->value_len % SELVA_NODE_ID_SIZE == 0);

    switch (op) {
    case SELVA_MODIFY_OP_SET_VALUE:
        return replace_edge_field(ctx->hierarchy, ctx->node,
                                  field_str, field_len,
                                  set->value_str, set->value_len);
        break;
    case SELVA_MODIFY_OP_SET_INSERT:
        for (size_t i = 0; i < set->value_len; i += SELVA_NODE_ID_SIZE) {
            struct SelvaHierarchyNode *dst_node;
            int err;

            err = SelvaHierarchy_UpsertNode(ctx->hierarchy, set->value_str + i, &dst_node);
            if ((err && err != SELVA_HIERARCHY_EEXIST) || !dst_node) {
                /* See similar case with $value */
                SELVA_LOG(SELVA_LOGL_ERR, "Upserting a node failed. err: \"%s\"",
                          selva_strerror(err));
                return err;
            }

            err = Edge_Add(ctx->hierarchy, field_str, field_len, ctx->node, dst_node);
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

        return res;
    case SELVA_MODIFY_OP_SET_REMOVE:
        if (set->value_len > 0) {
            struct EdgeField *edgeField = Edge_GetField(ctx->node, field_str, field_len);
            if (edgeField) {
                for (size_t i = 0; i < set->value_len; i += SELVA_NODE_ID_SIZE) {
                    Selva_NodeId dst_node_id;
                    int err;

                    /*
                     * It may or may not be better for caching to have the node_id in
                     * stack.
                     */
                    memcpy(dst_node_id, set->value_str + i, SELVA_NODE_ID_SIZE);
                    err = Edge_Delete(ctx->hierarchy, edgeField, ctx->node, dst_node_id);
                    if (!err) {
                        res++;
                    }
                }
            }
        }

        return res;
    case SELVA_MODIFY_OP_SET_ASSIGN:
        return SELVA_ENOTSUP;
    case SELVA_MODIFY_OP_SET_MOVE:
        return SELVA_ENOTSUP;
    default:
        return SELVA_EINVAL;
    }
}

static int selva_modify_op_set_ord_edge(struct modify_ctx *ctx, enum SelvaModifyOpCode op, struct SelvaModifySet *set)
{
    switch (op) {
    case SELVA_MODIFY_OP_SET_VALUE:
        return selva_modify_op_set_edge(ctx, op, set);
    case SELVA_MODIFY_OP_SET_INSERT:
        return insert_edges(ctx->hierarchy, ctx->node,
                           ctx->cur_field.name_str, ctx->cur_field.name_len,
                           set->value_str, set->value_len, set->index);
    case SELVA_MODIFY_OP_SET_REMOVE:
        return remove_edges(ctx->hierarchy, ctx->node,
                           ctx->cur_field.name_str, ctx->cur_field.name_len,
                           set->value_str, set->value_len, set->index);
    case SELVA_MODIFY_OP_SET_ASSIGN:
        return assign_edges(ctx->hierarchy, ctx->node,
                           ctx->cur_field.name_str, ctx->cur_field.name_len,
                           set->value_str, set->value_len, set->index);
    case SELVA_MODIFY_OP_SET_MOVE:
        return move_edges(ctx->node, ctx->cur_field.name_str, ctx->cur_field.name_len,
                         set->value_str, set->value_len, set->index);
    default:
        return SELVA_EINVAL;
    }
}

static int set_fixup(struct SelvaModifySet *set, const char *buf, size_t len)
{
    if (len < sizeof(*set)) {
        return SELVA_EINVAL;
    }

    memcpy(set, buf, sizeof(*set));
    set->index = htole(set->index);
    DATA_RECORD_FIXUP_CSTRING_P(set, buf, len, value);
    return 0;
}

static int selva_modify_op_set(struct modify_ctx *ctx, struct SelvaModifyFieldOp *op)
{
    struct SelvaModifySet set;
    int err, res;

    err = set_fixup(&set, op->value_str, op->value_len);
    if (err) {
        selva_send_errorf(ctx->resp, err, "Invalid SelvaModifySet structure");
        return err;
    }

    /* Check that the value divides into elements properly. */
    if ((set.type == SELVA_MODIFY_SET_TYPE_REFERENCE && (set.value_len % SELVA_NODE_ID_SIZE)) ||
        (set.type == SELVA_MODIFY_SET_TYPE_DOUBLE && (set.value_len % sizeof(double))) ||
        (set.type == SELVA_MODIFY_SET_TYPE_LONG_LONG && (set.value_len % sizeof(long long)))) {
        selva_send_errorf(ctx->resp, SELVA_EINVAL, "Set type and value doesn't match");
        return SELVA_EINVAL;
    }

    if (ctx->cur_field.fs->type1 == SELVA_FIELD_SCHEMA_TYPE_DATA) {
        res = selva_modify_op_set_data(ctx, op->op, &set);
    } else if (ctx->cur_field.fs->type1 == SELVA_FIELD_SCHEMA_TYPE_EDGE) {
        const struct EdgeFieldConstraint *constraint;

        if (set.type != SELVA_MODIFY_SET_TYPE_REFERENCE) {
            selva_send_errorf(ctx->resp, SELVA_ENOTSUP, "Only references supported by this field schema");
            return SELVA_ENOTSUP;
        }

        constraint = Edge_GetConstraint(&ctx->ns->efc, ctx->cur_field.name_str, ctx->cur_field.name_len);
        if (constraint->flags & EDGE_FIELD_CONSTRAINT_FLAG_ARRAY) {
            res = selva_modify_op_set_ord_edge(ctx, op->op, &set);
        } else {
            res = selva_modify_op_set_edge(ctx, op->op, &set);
        }
    } else {
        selva_send_errorf(ctx->resp, SELVA_EINTYPE, "Invalid field schema");
        return SELVA_EINTYPE;
    }

    if (res < 0) {
        selva_send_error(ctx->resp, res, NULL, 0);
        return res;
    } else if (res == 0) {
        return SELVA_OP_REPL_STATE_UNCHANGED;
    } else {
        return SELVA_OP_REPL_STATE_UPDATED;
    }
}

static int edge_meta_fixup(struct SelvaModifyEdgeMeta *op, const char *buf, size_t len)
{
    if (len < sizeof(*op)) {
        return SELVA_EINVAL;
    }

    memcpy(op, buf, sizeof(*op));
    DATA_RECORD_FIXUP_CSTRING_P(op, buf, len, meta_field_name, meta_field_value);
    return 0;
}

static int selva_modify_op_edge_meta(struct modify_ctx *ctx, struct SelvaModifyFieldOp *op)
{
    const char *field_str = ctx->cur_field.name_str;
    size_t field_len = ctx->cur_field.name_len;
    struct SelvaObject *edge_metadata;
    struct SelvaModifyEdgeMeta meta_op;
    int err;

    err = edge_meta_fixup(&meta_op, op->value_str, op->value_len);
    if (err) {
        selva_send_errorf(ctx->resp, err, "Invalid SelvaModifyEdgeMeta structure");
        return err;
    }

    err = SelvaHierarchy_GetEdgeMetadata(ctx->node, field_str, field_len, meta_op.dst_node_id, meta_op.delete_all, true, &edge_metadata);
    if (err == SELVA_ENOENT || !edge_metadata) {
        err = SELVA_ENOENT;
        selva_send_errorf(ctx->resp, err, "Edge field (\"%.*s\") not found",
                          (int)field_len, field_str);
        return err;
    } else if (err) {
        selva_send_errorf(ctx->resp, err, "Failed to get edge metadata");
        return err;
    }

    if (meta_op.op == SELVA_MODIFY_OP_STRING_DEFAULT ||
        meta_op.op == SELVA_MODIFY_OP_STRING) {
        const enum SelvaObjectType old_type = SelvaObject_GetTypeStr(edge_metadata, meta_op.meta_field_name_str, meta_op.meta_field_name_len);
        struct selva_string *old_value;
        struct selva_string *meta_field_value;

        if (meta_op.op == SELVA_MODIFY_OP_STRING_DEFAULT && old_type != SELVA_OBJECT_NULL) {
            return SELVA_OP_REPL_STATE_UNCHANGED;
        }

        if (old_type == SELVA_OBJECT_STRING &&
            !SelvaObject_GetStringStr(edge_metadata, meta_op.meta_field_name_str, meta_op.meta_field_name_len, &old_value)) {
            TO_STR(old_value);

            if (old_value && old_value_len == meta_op.meta_field_value_len &&
                !memcmp(old_value_str, meta_op.meta_field_value_str, meta_op.meta_field_value_len)) {
                return SELVA_OP_REPL_STATE_UNCHANGED;
            }
        }

        meta_field_value = selva_string_create(meta_op.meta_field_value_str, meta_op.meta_field_value_len, 0);
        err = SelvaObject_SetStringStr(edge_metadata, meta_op.meta_field_name_str, meta_op.meta_field_name_len, meta_field_value);
        if (err) {
            selva_string_free(meta_field_value);
            selva_send_errorf(ctx->resp, err, "Failed to set a string value");
            return err;
        }
    } else if (meta_op.op == SELVA_MODIFY_OP_LONGLONG_DEFAULT ||
               meta_op.op == SELVA_MODIFY_OP_LONGLONG) {
        long long ll;

        if (meta_op.meta_field_value_len != sizeof(ll)) {
            REPLY_WITH_ARG_TYPE_ERROR(ll);
            return err;
        }

        memcpy(&ll, meta_op.meta_field_value_str, sizeof(ll));

        if (meta_op.op == SELVA_MODIFY_OP_LONGLONG_DEFAULT) {
            err = SelvaObject_SetLongLongDefaultStr(edge_metadata, meta_op.meta_field_name_str, meta_op.meta_field_name_len, ll);
        } else {
            err = SelvaObject_UpdateLongLongStr(edge_metadata, meta_op.meta_field_name_str, meta_op.meta_field_name_len, ll);
        }
        if (err == SELVA_EEXIST) { /* Default handling */
            return SELVA_OP_REPL_STATE_UNCHANGED;
        } else if (err) {
            selva_send_error(ctx->resp, err, NULL, 0);
            return err;
        }
    } else if (meta_op.op == SELVA_MODIFY_OP_DOUBLE_DEFAULT ||
               meta_op.op == SELVA_MODIFY_OP_DOUBLE) {
        double d;

        if (meta_op.meta_field_value_len != sizeof(d)) {
            REPLY_WITH_ARG_TYPE_ERROR(d);
            return err;
        }

        memcpy(&d, meta_op.meta_field_value_str, sizeof(d));

        if (meta_op.op == SELVA_MODIFY_OP_DOUBLE_DEFAULT) {
            err = SelvaObject_SetDoubleDefaultStr(edge_metadata, meta_op.meta_field_name_str, meta_op.meta_field_name_len, d);
        } else {
            err = SelvaObject_UpdateDoubleStr(edge_metadata, meta_op.meta_field_name_str, meta_op.meta_field_name_len, d);
        }
        if (err == SELVA_EEXIST) { /* Default handling. */
            return SELVA_OP_REPL_STATE_UNCHANGED;
        } else if (err) {
            selva_send_error(ctx->resp, err, NULL, 0);
            return err;
        }
    } else if (meta_op.op == SELVA_MODIFY_OP_DEL) {
        err = SelvaObject_DelKeyStr(edge_metadata, meta_op.meta_field_name_str, meta_op.meta_field_name_len);
        if (err == SELVA_ENOENT) {
            /* No need to replicate. */
            return SELVA_OP_REPL_STATE_UNCHANGED;
        } else if (err) {
            selva_send_error(ctx->resp, err, NULL, 0);
            return err;
        }
    } else {
        err = SELVA_EINTYPE;
        selva_send_error(ctx->resp, err, NULL, 0);
        return err;
    }

    return SELVA_OP_REPL_STATE_UPDATED;
}

static int (*modify_op_fn[])(struct modify_ctx *ctx, struct SelvaModifyFieldOp *op) = {
    [SELVA_MODIFY_OP_DEL] = selva_modify_op_del,
    [SELVA_MODIFY_OP_STRING] = selva_modify_op_string,
    [SELVA_MODIFY_OP_STRING_DEFAULT] = selva_modify_op_string,
    [SELVA_MODIFY_OP_LONGLONG] = selva_modify_op_longlong,
    [SELVA_MODIFY_OP_LONGLONG_DEFAULT] = selva_modify_op_longlong,
    [SELVA_MODIFY_OP_LONGLONG_INCREMENT] = selva_modify_op_longlong_increment,
    [SELVA_MODIFY_OP_DOUBLE] = selva_modify_op_double,
    [SELVA_MODIFY_OP_DOUBLE_DEFAULT] = selva_modify_op_double,
    [SELVA_MODIFY_OP_DOUBLE_INCREMENT] = selva_modify_op_double_increment,
    [SELVA_MODIFY_OP_SET_VALUE] = selva_modify_op_set,
    [SELVA_MODIFY_OP_SET_INSERT] = selva_modify_op_set,
    [SELVA_MODIFY_OP_SET_REMOVE] = selva_modify_op_set,
    [SELVA_MODIFY_OP_SET_ASSIGN] = selva_modify_op_set,
    [SELVA_MODIFY_OP_SET_MOVE] = selva_modify_op_set,
    [SELVA_MODIFY_OP_EDGE_META] = selva_modify_op_edge_meta,
};

static int parse_head_get_node(struct modify_ctx *ctx)
{
    struct SelvaHierarchyNode *node = NULL;

    if (!(ctx->head.flags & FLAG_CREATE) && !(ctx->head.flags & FLAG_UPDATE)) {
        int err;
upsert:
        err = SelvaHierarchy_UpsertNode(ctx->hierarchy, ctx->head.node_id, &node);
        if (err < 0 && err != SELVA_HIERARCHY_EEXIST) {
            selva_send_errorf(ctx->resp, err, "Failed to initialize the node");
            return err;
        }
    } else if (ctx->head.flags & (FLAG_CREATE | FLAG_UPDATE)) {
        node = SelvaHierarchy_FindNode(ctx->hierarchy, ctx->head.node_id);
        if (node) {
            if (ctx->head.flags & FLAG_CREATE) {
                selva_send_errorf(ctx->resp, SELVA_HIERARCHY_EEXIST, "Node already exists");
                return SELVA_HIERARCHY_EEXIST;
            }
        } else {
            if (ctx->head.flags & FLAG_UPDATE) {
                selva_send_errorf(ctx->resp, SELVA_HIERARCHY_ENOENT, "Node not found");
                return SELVA_HIERARCHY_ENOENT;
            }

            goto upsert;
        }
    }
    assert(node);

    ctx->created = ctx->updated = SelvaHierarchy_ClearNodeFlagImplicit(node);
    SelvaSubscriptions_FieldChangePrecheck(ctx->hierarchy, node);

    if (!ctx->created && (ctx->head.flags & FLAG_NO_MERGE)) {
        SelvaHierarchy_ClearNodeFields(SelvaHierarchy_GetNodeObject(node));
    }

    ctx->node = node;
    return 0;
}

static int parse_head(struct modify_ctx *ctx, const void *data, size_t data_len)
{
    int err;

    assert(ctx->head.nr_changes == 0);

    if (data_len != sizeof(ctx->head)) {
        selva_send_errorf(ctx->resp, SELVA_EINVAL, "Invalid head");
        return SELVA_EINVAL;
    }
    memcpy(&ctx->head, (char *)data, data_len);
    ctx->head.flags = htole(ctx->head.flags);
    ctx->head.nr_changes = htole(ctx->head.nr_changes);

#if 0
    ctx->replset = selva_calloc(1, BITMAP_ALLOC_SIZE(ctx->head.nr_changes + 1));
    finalizer_add(ctx->fin, ctx->replset, selva_free);
    ctx->replset->nbits = ctx->head.nr_changes + 1;
    bitmap_erase(ctx->replset);
#endif

    if (!(ctx->head.flags & FLAG_ALIAS)) {
        err = parse_head_get_node(ctx);
        if (err) {
            return err;
        }

        ctx->ns = SelvaSchema_FindNodeSchema(ctx->hierarchy, ctx->head.node_id);
        if (!ctx->ns) {
            selva_send_errorf(ctx->resp, SELVA_ENOENT, "Node schema not found");
            return SELVA_ENOENT;
        }
    }

    return 0;
}

/**
 * Alias query comes just after the modify header if FLAG_ALIAS is set in the header.
 * The contents is a nul-separated list of alias names.
 */
static int parse_alias_query(struct modify_ctx *ctx, const void *data, size_t data_len)
{
    const char *s;
    size_t j = 0;
    struct SelvaHierarchyNode *node = NULL;

    while ((s = sztok(data, data_len, &j))) {
        Selva_NodeId node_id = {};

        strcpy(node_id, s);
        node = SelvaHierarchy_FindNode(ctx->hierarchy, node_id);
        if (node) {
            break;
        }
    }

    if (!node) {
        selva_send_errorf(ctx->resp, SELVA_ENOENT, "Alias not found");
        return SELVA_ENOENT;
    }

    ctx->node = node;
    ctx->ns = SelvaSchema_FindNodeSchema(ctx->hierarchy, ctx->head.node_id);
    if (!ctx->ns) {
        selva_send_errorf(ctx->resp, SELVA_ENOENT, "Node schema not found");
        return SELVA_ENOENT;
    }

    return 0;
}

static int op_fixup(struct SelvaModifyFieldOp *op, const char *buf, size_t len)
{
    if (len < sizeof(*op)) {
        return SELVA_EINVAL;
    }

    memcpy(op, buf, sizeof(*op));
    op->index = htole(op->index);
    DATA_RECORD_FIXUP_CSTRING_P(op, buf, len, value);
    return 0;
}

static int parse_field_change(struct modify_ctx *ctx, const void *data, size_t data_len)
{
    struct SelvaModifyFieldOp op;
    int err;

    err = op_fixup(&op, data, data_len);
    if (err) {
        selva_send_errorf(ctx->resp, err, "Invalid SelvaModifyFieldOp structure");
        return err;
    }

    if ((size_t)op.op >= num_elem(modify_op_fn)) {
        selva_send_errorf(ctx->resp, SELVA_EINVAL, "Invalid opcode");
        return SELVA_EINVAL;
    }

    /* FIXME field prot, if needed??? */
#if 0
    if (!SelvaModify_field_prot_check(field_str, field_len, type_code)) {
        selva_send_errorf(ctx->resp, SELVA_ENOTSUP, "Protected field. type_code: %c field: \"%.*s\"",
                          type_code, (int)field_len, field_str);
        return SELVA_ENOTSUP;
    }
#endif

#if 0
    ctx->cur_field.fs = SelvaSchema_FindFieldSchema(ctx->ns, op.field_name);
    if (!ctx->cur_field.fs) {
        selva_send_errorf(ctx->resp, SELVA_ENOENT, "Field schema not found");
        return SELVA_ENOENT;
    }
#endif

#if 0
    /*
     * TODO This is not enough to know if index is needed, unless we use 1 based index??
     * However, we may not even need index this way, not at least for now.
     */
    if (op.index) {
        int res;

        res = snprintf(ctx->cur_field.name_str, sizeof(ctx->cur_field.name_str),
                       "%.*s[%u]",
                       SELVA_SHORT_FIELD_NAME_LEN, op.field_name,
                       (unsigned)op.index);
        if (res < 0 && res > (int)sizeof(ctx->cur_field.name_str)) {
            selva_send_errorf(ctx->resp, SELVA_ENOBUFS, "field_name buffer too small");
            return SELVA_ENOBUFS;
        }
        ctx->cur_field.name_len = res;
    } else
#endif
    if (op.lang[0] && op.lang[1]) {
        int res;

        res = snprintf(ctx->cur_field.name_str, sizeof(ctx->cur_field.name_str),
                       "%.*s.%c%c",
                       SELVA_SHORT_FIELD_NAME_LEN, op.field_name,
                       op.lang[0], op.lang[1]);
        if (res < 0 && res > (int)sizeof(ctx->cur_field.name_str)) {
            selva_send_errorf(ctx->resp, SELVA_ENOBUFS, "field_name buffer too small");
            return SELVA_ENOBUFS;
        }
        ctx->cur_field.name_len = res;
    } else {
        memcpy(ctx->cur_field.name_str, op.field_name, sizeof(ctx->cur_field.name_str));
        ctx->cur_field.name_len = strnlen(op.field_name, SELVA_SHORT_FIELD_NAME_LEN);
    }

    return modify_op_fn[op.op](ctx, &op);
}

static void modify(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    /* FIXME */
#if 0
    SELVA_TRACE_BEGIN_AUTO(cmd_modify);
#endif
    __auto_finalizer struct finalizer fin;
    struct modify_ctx ctx = {
        .resp = resp,
        .hierarchy = main_hierarchy,
        .fin = &fin,
    };
    int (*parse_arg)(struct modify_ctx *ctx, const void *data, size_t data_len) = parse_head;
    size_t i = 0; /*!< Index into buf. */
    size_t arg_idx = 0;

    finalizer_init(&fin);

    while (i < len) {
        enum selva_proto_data_type sp_type;
        size_t data_len;
        int off;

        off = selva_proto_parse_vtype(buf, len, i, &sp_type, &data_len);
        if (off <= 0) {
            if (off < 0) {
                selva_send_errorf(resp, SELVA_EINVAL, "Failed to parse a value header: %s", selva_strerror(off));
            }
            break;
        }

        i += off;

        if (sp_type != SELVA_PROTO_STRING) {
            selva_send_errorf(resp, SELVA_EINTYPE, "Unexpected message type");
            break;
        }

        const char *data = (char *)buf + i - data_len;
        int res; /*!< err < 0; ok = 0; updated = 1 */

        res = parse_arg(&ctx, data, data_len);
        if (res < 0) {
            /* An error should have been already sent by the parse function. */

            if (parse_arg == parse_head ||
                parse_arg == parse_alias_query) {
                /* Can't proceed. */
                break;
            }

            /* Otherwise we keep processing the changes. */
        } else if (res == SELVA_OP_REPL_STATE_UNCHANGED) {
#if 0
            bitmap_set(ctx.replset, arg_idx);
#endif
            selva_send_ll(resp, 0);
        } else {
            SelvaSubscriptions_DeferFieldChangeEvents(ctx.hierarchy, ctx.node,
                                                      ctx.cur_field.name_str, ctx.cur_field.name_len);

#if 0
            bitmap_set(ctx.replset, arg_idx);
#endif
            selva_send_ll(resp, 1);
            ctx.updated = true;
        }

        if (++arg_idx > ctx.head.nr_changes) {
            break;
        }

        /*
         * Select next parser.
         */
        if (parse_arg == parse_head && (ctx.head.flags & FLAG_ALIAS)) {
            parse_arg = parse_alias_query;
        } else {
            parse_arg = parse_field_change;
        }
    }

    if (ctx.created) {
        SelvaSubscriptions_DeferTriggerEvents(ctx.hierarchy, ctx.node, SELVA_SUBSCRIPTION_TRIGGER_TYPE_CREATED);
    } else if (ctx.updated) {
        /*
         * If nodeId wasn't created by this command call but it was updated
         * then we need to defer the updated trigger.
         */
        SelvaSubscriptions_DeferTriggerEvents(ctx.hierarchy, ctx.node, SELVA_SUBSCRIPTION_TRIGGER_TYPE_UPDATED);

        /* FIXME updated_en */
        if (selva_replication_get_mode() == SELVA_REPLICATION_MODE_REPLICA && ctx.ns && ctx.ns->updated_en) {
            struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(ctx.node);
            const int64_t now = selva_resp_to_ts(resp);

            /*
             * If the node was created then the field was already updated by hierarchy.
             * If the command was replicated then the master should send us the correct
             * timestamp.
             */
            SelvaObject_SetLongLongStr(obj, SELVA_UPDATED_AT_FIELD, sizeof(SELVA_UPDATED_AT_FIELD) - 1, now);
            SelvaSubscriptions_DeferFieldChangeEvents(ctx.hierarchy, ctx.node, SELVA_UPDATED_AT_FIELD, sizeof(SELVA_UPDATED_AT_FIELD) - 1);
        }
    }

    if (ctx.created || ctx.updated) {
        selva_io_set_dirty();

        if (selva_replication_get_mode() == SELVA_REPLICATION_MODE_ORIGIN) {
            /* TODO Fix replication optimization */
#if 0
            struct replicate_ts replicate_ts;

            get_replicate_ts(&replicate_ts, node, created, updated);
            replicate_modify(resp, replset, argv, &replicate_ts);
#endif
            if ((ctx.updated || ctx.created)) { /* && (bitmap_popcount(ctx.replset) > 0)) { */
                selva_replication_replicate(selva_resp_to_ts(resp), selva_resp_to_cmd_id(resp), buf, len);
            }
        }
    }

    SelvaSubscriptions_SendDeferredEvents(ctx.hierarchy);
}

static int Modify_OnLoad(void)
{
    SELVA_MK_COMMAND(CMD_ID_MODIFY, SELVA_CMD_MODE_MUTATE, modify);

    return 0;
}
SELVA_ONLOAD(Modify_OnLoad);
