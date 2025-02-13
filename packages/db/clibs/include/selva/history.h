/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stddef.h>
#include <stdint.h>
#include "selva/types.h"
#include "selva/_export.h"

struct selva_history;

struct selva_history_event {
    int64_t ts;
    node_id_t node_id;
    uint32_t crc;
} __packed __attribute__((aligned(4)));

static_assert(alignof(struct selva_history_event) == alignof(uint32_t));

SELVA_EXPORT
int selva_history_init(const char *pathname, size_t bsize, struct selva_history **hist_out);

SELVA_EXPORT
void selva_history_destroy(struct selva_history *hist);

SELVA_EXPORT
void selva_history_append(struct selva_history *hist, int64_t ts, node_id_t node_id, void *buf);

SELVA_EXPORT
void selva_history_fsync(struct selva_history *hist);

/**
 * Find a range.
 * The returned buffer must be freed with selva_history_free_range().
 */
SELVA_EXPORT
uint32_t *selva_history_find_range(struct selva_history *hist, int64_t from, int64_t to, size_t *size_out);

/**
 * Find a range.
 * The returned buffer must be freed with selva_history_free_range().
 */
SELVA_EXPORT
uint32_t *selva_history_find_range_node(struct selva_history *hist, int64_t from, int64_t to, node_id_t node_id, size_t *size_out);

SELVA_EXPORT
void selva_history_free_range(uint32_t *range);
