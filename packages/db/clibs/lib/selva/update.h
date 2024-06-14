/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "selva.h"

struct Update {
    uint32_t len;
    field_t field;
    char value[];
} __packed;

static_assert(alignof(struct Update) == 1);

int update(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node, const char *buf, size_t len);
