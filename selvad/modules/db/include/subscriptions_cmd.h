/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

struct Subscriptions_QueryOpts {
    /**
     * Traversal method/direction.
     */
    enum SelvaTraversal dir;
    const char *dir_opt_str; /*!< Ref field name or expression. Optional. */
    size_t dir_opt_len;
};
