/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "selva.h"

struct Update {
    uint32_t len; /*!< Length of this struct. */
    field_t field;
    char value[];
} __packed;

struct UpdateBatch {
    uint32_t len; /*!< Length off this struct. */
    node_id_t node_id;
    struct Update ud[];
} __packed;

static_assert(alignof(struct Update) == 1);

int update(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node, const char *buf, size_t len);
int update_batch(struct SelvaDb *db, struct SelvaTypeEntry *type, const char *buf, size_t len);
