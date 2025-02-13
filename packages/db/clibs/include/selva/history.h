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

SELVA_EXPORT
int selva_history_init(const char *pathname, size_t bsize, struct selva_history **hist_out);

SELVA_EXPORT
void selva_history_destroy(struct selva_history *hist);

SELVA_EXPORT
void selva_history_append(struct selva_history *hist, int64_t ts, node_id_t node_id, void *buf);

SELVA_EXPORT
void selva_history_fsync(struct selva_history *hist);

SELVA_EXPORT
uint32_t *selva_history_find_range(struct selva_history *hist, int64_t from, int64_t to, size_t *len_out);

SELVA_EXPORT
void selva_history_free_range(uint32_t *range);
