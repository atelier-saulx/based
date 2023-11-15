/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

struct SelvaUpdate_QueryOpts {
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
};
