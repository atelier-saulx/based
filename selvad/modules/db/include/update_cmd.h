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
};
