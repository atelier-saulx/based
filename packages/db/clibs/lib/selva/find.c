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

struct find_cb {
    const char *fields;
    const uint8_t *filter_expression;
    struct SelvaTraversalParam *cb;
};

static int find_cb(struct SelvaDb *db, const struct SelvaTraversalMetadata *meta, struct SelvaNode *node, void *arg)
{
    struct find_cb *args = (struct find_cb *)arg;
    node_type_t type = node->type;

    if (type == 0) {
        (void)args->cb->node_cb(db, meta, node, args->cb->node_arg);

        return SELVA_TRAVERSAL_STOP;
    } else if (type == 1) {
        return 1;
    } else {
        return SELVA_TRAVERSAL_STOP;
    }
}

static int find_filter(struct SelvaDb *db, const struct SelvaTraversalMetadata *meta, struct SelvaNode *node, void *arg)
{
    const uint8_t *filter_expression = (const uint8_t *)arg;

    uint8_t input[] = { CONJ_NECESS, OP_EQ_TYPE, 0, 0, 0, 0, OP_EQ_INTEGER, 1, 0, 0, 0, 0, };
    bool res = false;
    int err;

    __builtin_prefetch(node, 0, 1);
    err = filter_eval(node, input, sizeof(input), &res);

    return err ? SELVA_TRAVERSAL_STOP : res ? 0 : SELVA_TRAVERSAL_STOP;
}

int find(struct SelvaDb *db, struct SelvaNode *node, const char *fields, const uint8_t *filter_expression, struct SelvaTraversalParam *cb)
{
    struct SelvaTraversalParam cb_wrap = {
        .node_cb = find_cb,
        .node_arg = &(struct find_cb){
            .fields = fields,
            .filter_expression = filter_expression,
            .cb = cb,
        },
        .child_cb = find_filter,
        .child_arg = filter_expression,
    };

    return traverse_field_bfs(db, node, &cb_wrap);
}
