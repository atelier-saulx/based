/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

struct FindParam {
    SelvaTraversalNodeCallback node_cb;
    void *node_arg;

    const uint8_t *adjacent_filter;
    size_t adjacent_filter_len;

    const char *fields;
    const uint8_t *node_filter;
    size_t node_filter_len;
};

int find(struct SelvaDb *db, struct SelvaNode *node, const struct FindParam *param);
