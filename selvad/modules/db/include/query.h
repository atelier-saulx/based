/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

int query_get_data_field(
        struct selva_string *lang,
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        struct SelvaObjectAny *any);

struct query_traverse {
    enum SelvaTraversal dir;
    const char *dir_opt_str; /*!< Ref field name or expression. Optional. */
    size_t dir_opt_len;

    struct rpn_ctx *traversal_rpn_ctx;
    struct rpn_expression *traversal_expression;

    struct rpn_ctx *edge_filter_ctx;
    struct rpn_expression *edge_filter;

    SelvaHierarchyNodeCallback node_cb;
    SelvaObjectArrayForeachCallback ary_cb;
};

int query_traverse(struct SelvaHierarchy *hierarchy, Selva_NodeId node_id, struct query_traverse *qt, void *args);
