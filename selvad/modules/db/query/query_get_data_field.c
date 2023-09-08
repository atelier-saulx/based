/*
 * Copyright (c) 2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdint.h>
#include <sys/types.h>
#include "util/selva_string.h"
#include "selva_error.h"
#include "selva_object.h"
#include "edge.h"
#include "hierarchy.h"
#include "query.h"

static int get_next_edge_field(
        struct selva_string *lang,
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        struct SelvaObjectAny *any)
{
    struct SelvaHierarchyMetadata *metadata = SelvaHierarchy_GetNodeMetadataByPtr(node);
    struct SelvaObject *edges = metadata->edge_fields.edges;
    void *p;

    if (!edges) {
        return SELVA_ENOENT;
    }

    const int off = SelvaObject_GetPointerPartialMatchStr(edges, field_str, field_len, &p);
    struct EdgeField *edge_field = p;
    if (off == SELVA_EINTYPE) {
        return SELVA_EINTYPE;
    } else if (off < 0) {
        return off;
    } else if (off == 0) {
        /*
         * The field name leads to an edge field (->node),
         * not to a single data field.
         */
        return SELVA_EINTYPE;
    } else if (!edge_field) {
        return SELVA_ENOENT;
    } else {
        const char *next_field_str = field_str + off;
        const size_t next_field_len = field_len - off;
        struct SelvaHierarchyNode *next_node;
        int err;

        err = Edge_DerefSingleRef(edge_field, &next_node);
        if (err) {
            return err;
        }

        return query_get_data_field(lang, next_node, next_field_str, next_field_len, any);
    }
}

int query_get_data_field(
        struct selva_string *lang,
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        struct SelvaObjectAny *any)
{
    int err;

    err = get_next_edge_field(lang, node, field_str, field_len, any);
    if (err == SELVA_ENOENT) {
        struct SelvaObject *obj;

        obj = SelvaHierarchy_GetNodeObject(node);
        err = SelvaObject_GetAnyLangStr(obj, lang, field_str, field_len, any);
    }

    return err;
}
