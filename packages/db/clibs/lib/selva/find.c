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

static int find_next_field(const struct FindFields *fields, node_type_t node_type)
{
    size_t len = fields->len;
    for (size_t i = 0; i < len; i++) {
        typeof(fields->data[0]) *entry = &fields->data[i];

        if (entry->type == node_type) {
            return entry->field;
        }
    }

    return SELVA_TRAVERSAL_STOP;
}

static int find_node_cb(struct SelvaDb *db, const struct SelvaTraversalMetadata *meta, struct SelvaNode *node, void *arg)
{
    struct FindParam *state = (struct FindParam *)arg;
    node_type_t type = node->type;
    bool take = (state->skip > 0) ? !state->skip-- : true;
    int err;

    if (take && state->node_filter_len) {
        err = filter_eval(node, state->node_filter, state->node_filter_len, &take);
        if (err) {
            /* TODO */
            return SELVA_TRAVERSAL_ABORT;
        }
    }

    take = take && ((state->offset > 0) ? !state->offset-- : true);
    if (take) {
        (void)state->node_cb(db, meta, node, state->node_arg);

        if (state->limit != -1 && --state->limit == 0) {
            return SELVA_TRAVERSAL_STOP;
        }
    }

    return find_next_field(state->fields, type);
}

static int adj_filter(struct SelvaDb *db, const struct SelvaTraversalMetadata *meta, struct SelvaNode *node, void *arg)
{
    struct FindParam *state = (struct FindParam *)arg;

    bool res = false;
    int err;

    __builtin_prefetch(node, 0, 1);
    err = filter_eval(node, state->adjacent_filter, state->adjacent_filter_len, &res);

    return err ? SELVA_TRAVERSAL_STOP : res ? 0 : SELVA_TRAVERSAL_STOP;
}

int find(struct SelvaDb *db, struct SelvaNode *node, const struct FindParam *param)
{
    struct FindParam state = *param;
    struct SelvaTraversalParam cb_wrap = {
        .node_cb = find_node_cb,
        .node_arg = &state,
        .child_cb = param->adjacent_filter_len > 0 ? adj_filter : NULL,
        .child_arg = &state,
    };

    return traverse_field_bfs(db, node, &cb_wrap);
}
