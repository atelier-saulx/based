/*
 * Copyright (c) 2022-2023, 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "selva/_export.h"

struct timespec;

/**
 * Get current UNIX time in ms.
 */
long long ts_now(void);

SELVA_EXPORT
void ts_monotime(struct timespec *spec)
    __attribute__((access(write_only, 1)));

SELVA_EXPORT
void ts_monorealtime(struct timespec *spec)
    __attribute__((access(write_only, 1)));

SELVA_EXPORT
long long ts_monorealtime_now(void);
