/*
 * Copyright (c) 2022-2024 SAULX
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
        const struct selva_string *lang,
        const struct SelvaHierarchyTraversalMetadata *traversal_metadata,
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        struct SelvaObjectAny *any)
    __attribute__((access(read_only, 1), access(read_only, 2), access(read_only, 4, 5), access(write_only, 6)));

/**
 * Get a plain field value in inherit style.
 */
int field_lookup_inherit(
        struct SelvaHierarchy *hierarchy,
        const struct selva_string *lang,
        const struct SelvaHierarchyNode *node,
        struct SelvaObject *obj,
        const char *field_str,
        size_t field_len,
        struct SelvaObjectAny *out)
    __attribute__((access(read_only, 2), access(read_only, 5, 6), access(write_only, 7)));

/**
 * Get a traversable hierarchy-like SVector field value.
 * - edge
 * - object array
 */
int field_lookup_traversable(
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        struct field_lookup_traversable *out)
    __attribute__((access(read_only, 2, 3), access(write_only, 4)));
