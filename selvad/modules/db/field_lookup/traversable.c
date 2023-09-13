/*
 * Copyright (c) 2023 SAULX
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

        return field_lookup_traversable(next_node, next_field_str, next_field_len, out);
    }
}

static enum SelvaTraversal get_pseudo_field(const char *field_str, size_t field_len)
{
#define IS_FIELD(name) \
    (field_len == (sizeof(name) - 1) && !memcmp(name, field_str, sizeof(name) - 1))

    if (IS_FIELD(SELVA_ANCESTORS_FIELD)) {
        return SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS;
    } else if (IS_FIELD(SELVA_DESCENDANTS_FIELD)) {
        return SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS;
    }

    return SELVA_HIERARCHY_TRAVERSAL_NONE;
#undef IS_FIELD
}

int field_lookup_traversable(
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        struct field_lookup_traversable *out)
{
    SVector *vec;
    enum SelvaTraversal field_type;
    int err;

    /*
     * Is it a hierarchy field.
     * - parents
     * - children
     */
    vec = SelvaHierarchy_GetHierarchyField(node, field_str, field_len, &field_type);
    if (vec) {
        out->type = field_type;
        out->vec = vec;
        out->node = node;
        return 0;
    }

    /*
     * Is it a hierarchy pseudo-field.
     * - ancestors
     * - descendants
     */
    field_type = get_pseudo_field(field_str, field_len);
    if (field_type != SELVA_HIERARCHY_TRAVERSAL_NONE) {
        out->type = field_type;
        out->vec = NULL;
        out->node = node;
        return 0;
    }

    /*
     * Try recurse to an edge field.
     */
    err = get_from_edge_field(node, field_str, field_len, out);
    if (!err) {
        return 0;
    } else if (err != SELVA_ENOENT) {
        return err;
    }

    /*
     * Array field.
     */
    struct SelvaObject *obj;
    enum SelvaObjectType obj_subtype;

    obj = SelvaHierarchy_GetNodeObject(node);
    err = SelvaObject_GetArrayStr(obj, field_str, field_len, &obj_subtype, &vec);
    if (err) {
        return err;
    } else if (obj_subtype != SELVA_OBJECT_OBJECT) {
        return SELVA_EINTYPE;
    } else {
        out->type = SELVA_HIERARCHY_TRAVERSAL_ARRAY;
        out->vec = vec;
        out->node = node;
        return 0;
    }
}
