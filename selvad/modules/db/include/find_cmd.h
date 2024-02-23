/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

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
     * RPN registers for edge_filter_str.
     * Format: [uint32_t len, string, uint32_t len, string]
     * Each string is unterminated.
     */
    __nonstring const char *edge_filter_regs_str;
    size_t edge_filter_regs_len;

    /**
     * Indexing hints.
     * Separated with `\0`.
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
     * Skip the first n nodes in the traversal.
     *  -1 = Always include the starting node.
     *   0 = No action
     * > 0 = Skip nodes.
     */
    ssize_t skip;

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
    enum SelvaFind_ResType {
        /**
         * Return ids of the nodes matching the query.
         */
        SELVA_FIND_QUERY_RES_IDS = 0,
        /**
         * Return selected fields from the matching nodes.
         *
         * **res_opt format**
         *
         * The list is separated with a newline `\n`
         *
         * - `field` = Take a field if it exists on the node
         * - `field1|field2` = Take first field that exists:
         * - `^types:field` = Inherit the field from an ancestor of specific type
         * - `^:field` = Inherit the field from any ancestor
         * - `!field` = Exclude field
         * - `cool@field` = field alias
         * - `cool@fieldA|fieldB` = field alias
         * - `*` - Wildcard
         *
         * Also the field names can contain wildcards as supported by SelvaObject.
         * The `id` field can't be excluded.
         * Care should be taken to not exceed the re-entrancy limit of the trx
         * system when ^ (inherit) is used with this mode.
         */
        SELVA_FIND_QUERY_RES_FIELDS,
        /**
         * Execute an RPN expression for each node to decide the fields.
         * As a result the RPN expression must return a string similar to
         * the format used in SELVA_FIND_QUERY_RES_FIELDS.
         *
         * **Supported prefixes for field names**
         * - `^types:field` = Inherit the field from an ancestor of specific type
         * - `^:field` = Inherit the field from any ancestor
         * - `!` = Exclude the field
         *
         * **Special field names**
         * - `*` = wildcard
         *
         * Also the field names can contain wildcards as supported by SelvaObject.
         * The `id` field can't be excluded.
         * Care should be taken to not exceed the re-entrancy limit of the trx
         * system when ^ (inherit) is used with this mode.
         */
        SELVA_FIND_QUERY_RES_FIELDS_RPN,
        /**
         * Inherit fields using ancestors traversal and expression.
         * This works similarly to SELVA_FIND_QUERY_RES_FIELDS_RPN but the
         * response is sent in postprocess_inherit which requires more buffering
         * but avoids the reentrancy limits of the trx system.
         */
        SELVA_FIND_QUERY_RES_INHERIT_RPN,
    } res_type;

    /**
     * Result opt arg.
     * field names or expression.
     */
    const char *res_opt_str;
    size_t res_opt_len;
};
