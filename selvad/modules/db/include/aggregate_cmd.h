/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

struct SelvaAggregate_QueryOpts {
    enum SelvaHierarchy_AggregateType {
        SELVA_AGGREGATE_TYPE_COUNT_NODE = 0,
        SELVA_AGGREGATE_TYPE_COUNT_UNIQUE_FIELD,
        SELVA_AGGREGATE_TYPE_SUM_FIELD,
        SELVA_AGGREGATE_TYPE_AVG_FIELD,
        SELVA_AGGREGATE_TYPE_MIN_FIELD,
        SELVA_AGGREGATE_TYPE_MAX_FIELD,
    } agg_fn;

    /**
     * Traversal method/direction.
     */
    enum SelvaTraversal dir;
    const char *dir_opt_str; /*!< Ref field name or expression. Optional. */
    size_t dir_opt_len;

    /**
     * Expression to decide whether and edge should be visited.
     */
    const char *edge_filter_str;
    size_t edge_filter_len;

    /**
     * Indexing hint.
     * Optional.
     */
    const char *index_hints_str;
    size_t index_hints_len;

    /**
     * Sort order of the results.
     */
    enum SelvaResultOrder order;
    const char *order_by_field_str;
    size_t order_by_field_len;

    /**
     * Skip the first n - 1 results.
     * 0 for not offset.
     */
    ssize_t offset;

    /**
     * Limit the number of results.
     * -1 for no limit (inf).
     */
    ssize_t limit;
};
