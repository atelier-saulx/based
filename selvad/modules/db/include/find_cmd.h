/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "selva_db.h"
#include "traversal.h"

struct SelvaFind_QueryOpts {
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

    enum SelvaMergeStrategy merge_strategy;
    /**
     * Merge path.
     * Only used when SELVA_FIND_QUERY_RES_FIELDS.
     */
    const char *merge_str;
    size_t merge_len;

    /**
     * Result type.
     * What is expected to be returned to the client.
     */
    enum {
        SELVA_FIND_QUERY_RES_IDS = 0,
        SELVA_FIND_QUERY_RES_FIELDS,
        SELVA_FIND_QUERY_RES_FIELDS_RPN,
        SELVA_FIND_QUERY_RES_INHERIT_RPN,
    } res_type;

    /**
     * Result opt arg.
     * field names or expression.
     */
    const char *res_opt_str;
    size_t res_opt_len;
};

#define WILDCARD_CHAR '*'
