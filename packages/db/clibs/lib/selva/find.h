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

    /**
     * Traverse field selector.
     */
    const struct FindFields {
        uint8_t len;
        struct {
            node_type_t type;
            field_t field;
        } __packed data[];
    } __packed *fields;

    const uint8_t *node_filter;
    size_t node_filter_len;

    /**
     * Skip the first n nodes in the traversal.
     * This happens before filtering.
     */
    ssize_t skip;

    /**
     * Skip the first n - 1 results.
     * This skipping is executed on the final result set.
     * 0 for no offset.
     */
    ssize_t offset;

    /**
     * Limit the number of results.
     * -1 for no limit (inf).
     */
    ssize_t limit;
};

int find(struct SelvaDb *db, struct SelvaNode *node, const struct FindParam *param);
