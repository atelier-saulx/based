/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stdio.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include "selva.h"
#include "selva_error.h"
#include "fields.h"
#include "filter.h"
#include "traverse.h"
#include "find.h"

static int find_node_cb(struct SelvaDb *db, const struct SelvaTraversalMetadata *meta, struct SelvaNode *node, void *arg)
{
    const struct FindParam *param = (const struct FindParam *)arg;
    node_type_t type = node->type;

    if (type == 0) {
        (void)param->node_cb(db, meta, node, param->node_arg);

        return SELVA_TRAVERSAL_STOP;
    } else if (type == 1) {
        return 1;
    } else {
        return SELVA_TRAVERSAL_STOP;
    }
}

static int adj_filter(struct SelvaDb *db, const struct SelvaTraversalMetadata *meta, struct SelvaNode *node, void *arg)
{
    const struct FindParam *param = (const struct FindParam *)arg;

    bool res = false;
    int err;

    __builtin_prefetch(node, 0, 1);
    err = filter_eval(node, param->adjacent_filter, param->adjacent_filter_len, &res);

    return err ? SELVA_TRAVERSAL_STOP : res ? 0 : SELVA_TRAVERSAL_STOP;
}

int find(struct SelvaDb *db, struct SelvaNode *node, const struct FindParam *param)
{
    struct SelvaTraversalParam cb_wrap = {
        .node_cb = find_node_cb,
        .node_arg = (void *)param,
        .child_cb = param->adjacent_filter_len > 0 ? adj_filter : NULL,
        .child_arg = (void *)param,
    };

    return traverse_field_bfs(db, node, &cb_wrap);
}
