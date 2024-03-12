/*
 * Copyright (c) 2022, 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include <sys/types.h>
#include "selva_error.h"
#include "selva_db.h"
#include "selva_object.h"
#include "hierarchy.h"

struct field_name {
    const char * const name;
    size_t len;
};

#define UNSUP(fname) \
    { .name = fname, .len = sizeof(fname) - 1 }

static const struct field_name unsupported_fields[] = {
    UNSUP(SELVA_ID_FIELD),
    UNSUP(SELVA_TYPE_FIELD),
    UNSUP(SELVA_CREATED_AT_FIELD),
    UNSUP(SELVA_UPDATED_AT_FIELD),
};

static int is_unsupported_field(const char *field_str, size_t field_len) {
    for (size_t i = 0; i < num_elem(unsupported_fields); i++) {
        if (field_len == unsupported_fields[i].len && !memcmp(field_str, unsupported_fields[i].name, field_len)) {
            return 1;
        }
    }

    return 0;
}

static int is_edge_field(const struct SelvaHierarchyNode *node, const char *field_str, size_t field_len) {
    return !!Edge_GetField(node, field_str, field_len);
}

static int hierarchy_foreach_cb(
        struct SelvaHierarchy *,
        const struct SelvaHierarchyTraversalMetadata *,
        struct SelvaHierarchyNode *node,
        void *arg) {
    const struct SelvaObjectSetForeachCallback *cb = (struct SelvaObjectSetForeachCallback *)arg;
    union SelvaObjectSetForeachValue svalue;

    SelvaHierarchy_GetNodeId(svalue.node_id, node);
    return cb->cb(svalue, SELVA_SET_TYPE_NODEID, cb->cb_arg);
}

static int array_foreach_cb_wrapper(union SelvaObjectArrayForeachValue value, enum SelvaObjectType subtype, void *arg) {
    const struct SelvaObjectSetForeachCallback *cb = (struct SelvaObjectSetForeachCallback *)arg;
    union SelvaObjectSetForeachValue svalue;

    switch (subtype) {
    case SELVA_OBJECT_DOUBLE:
        svalue.d = value.d;
        cb->cb(svalue, SELVA_SET_TYPE_DOUBLE, cb->cb_arg);
        break;
    case SELVA_OBJECT_LONGLONG:
    case SELVA_OBJECT_HLL:
        svalue.ll = value.ll;
        cb->cb(svalue, SELVA_SET_TYPE_LONGLONG, cb->cb_arg);
        break;
    case SELVA_OBJECT_STRING:
        svalue.s = value.s;
        cb->cb(svalue, SELVA_SET_TYPE_STRING, cb->cb_arg);
        break;
    case SELVA_OBJECT_NULL:
    case SELVA_OBJECT_OBJECT:
    case SELVA_OBJECT_SET:
    case SELVA_OBJECT_ARRAY:
    case SELVA_OBJECT_POINTER:
        return 1; /* Unsupported. */
    }

    return 0;
}

/**
 * Foreach item in an array field.
 */
static int array_foreach(
        struct SelvaObject *obj,
        const char *field_str,
        size_t field_len,
        const struct SelvaObjectSetForeachCallback *cb) {
    struct SelvaObjectArrayForeachCallback arr_cb = {
        .cb = array_foreach_cb_wrapper,
        .cb_arg = (void *)cb,
    };

    return SelvaObject_ArrayForeach(obj, field_str, field_len, &arr_cb);
}

int SelvaHierarchy_ForeachInField(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        const struct SelvaObjectSetForeachCallback *cb) {
#define IS_FIELD(name) \
    (field_len == (sizeof(name) - 1) && !memcmp(field_str, name, sizeof(name) - 1))

    if (is_unsupported_field(field_str, field_len)) {
        /* NOP */
    } else if (is_edge_field(node, field_str, field_len)) {
        Selva_NodeId id;
        const struct SelvaHierarchyCallback hcb = {
            .node_cb = hierarchy_foreach_cb,
            .node_arg = (void *)cb,
        };

        SelvaHierarchy_GetNodeId(id, node);

        return SelvaHierarchy_TraverseEdgeField(
                hierarchy,
                id,
                field_str, field_len,
                &hcb);
    } else {
        /*
         * Test if it's an array or set field. Note that SELVA_ALIASES_FIELD is
         * just a regular SelvaSet.
         */
        struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(node);
        enum SelvaObjectType field_type;

        field_type = SelvaObject_GetTypeStr(obj, field_str, field_len);
        if (field_type == SELVA_OBJECT_SET) {
            return SelvaObject_SetForeach(obj, field_str, field_len, cb);
        } else if (field_type == SELVA_OBJECT_ARRAY) {
            return array_foreach(obj, field_str, field_len, cb);
        }
    }

    return SELVA_HIERARCHY_ENOTSUP;
}
