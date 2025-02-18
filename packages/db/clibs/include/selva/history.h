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

/**
 * Create a new history object.
 */
SELVA_EXPORT
int selva_history_create(const char *pathname, size_t bsize, struct selva_history **hist_out);

/**
 * Destroy a history object.
 */
SELVA_EXPORT
void selva_history_destroy(struct selva_history *hist);

/**
 * Append a block of size `bsize` to a history object.
 */
SELVA_EXPORT
void selva_history_append(struct selva_history *hist, int64_t ts, node_id_t node_id, void *buf);

/**
 * Ensure that the history file is fully written to the disk.
 */
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

/**
 * Free a range returned by selva_history_find_range_node().
 */
SELVA_EXPORT
void selva_history_free_range(uint32_t *range);
