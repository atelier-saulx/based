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
void selva_history_append(struct selva_history *hist, int64_t ts, node_id_t node_id, void *buf, size_t size);

SELVA_EXPORT
void selva_history_sync(struct selva_history *hist);
