/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "traversal.h"

struct SVector;
struct SelvaHierarchy;
struct SelvaHierarchyNode;
struct selva_string;

/**
 * Result type for query_get_traversable_field.
 */
struct field_lookup_traversable {
    /**
     * Type of `a`.
     * - SELVA_HIERARCHY_TRAVERSAL_CHILDREN
     * - SELVA_HIERARCHY_TRAVERSAL_PARENTS
     * - SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS
     * - SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS
     * - SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD
     * - SELVA_HIERARCHY_TRAVERSAL_ARRAY
     */
    enum SelvaTraversal type;
    int hops; /*!< Number of edge_field hops. */
    struct SVector *vec; /*!< The field value. */
    struct SelvaHierarchyNode *node;
};

/**
 * Get a sortable field value.
 * @param traversal_metadata Optional metadata to find $edgeMeta.
 */
int field_lookup_data_field(
        struct selva_string *lang,
        const struct SelvaHierarchyTraversalMetadata *traversal_metadata,
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        struct SelvaObjectAny *any);

/**
 * Get a plain field value in inherit style.
 */
int field_lookup_inherit(
        struct SelvaHierarchy *hierarchy,
        struct selva_string *lang,
        const struct SelvaHierarchyNode *node,
        struct SelvaObject *obj,
        const char *field_str,
        size_t field_len,
        struct SelvaObjectAny *out);

/**
 * Get a traversable hierarchy-like SVector field value.
 * - parents
 * - children
 * - ancestors
 * - descendants
 * - edge
 * - object array
 */
int field_lookup_traversable(
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        struct field_lookup_traversable *out);
