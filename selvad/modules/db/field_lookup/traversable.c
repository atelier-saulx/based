/*
 * Copyright (c) 2023-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include <sys/types.h>
#include "util/selva_string.h"
#include "util/svector.h"
#include "selva_error.h"
#include "selva_object.h"
#include "edge.h"
#include "hierarchy.h"
#include "field_lookup.h"

static int do_field_lookup_traversable(
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        struct field_lookup_traversable *out);

static int get_from_edge_field(
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        struct field_lookup_traversable *out)
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
        return off; /* Probably SELVA_ENOENT */
    } else if (off == 0) {
        /*
         * This is the edge field requested.
         */
        out->type = SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD;
        out->vec = &edge_field->arcs;
        out->node = node;
        return 0;
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

        out->hops++;
        return do_field_lookup_traversable(next_node, next_field_str, next_field_len, out);
    }
}

static int do_field_lookup_traversable(
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        struct field_lookup_traversable *out)
{
    return get_from_edge_field(node, field_str, field_len, out);
}

int field_lookup_traversable(
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        struct field_lookup_traversable *out)
{
    memset(out, 0, sizeof(*out));
    return do_field_lookup_traversable(node, field_str, field_len, out);
}
