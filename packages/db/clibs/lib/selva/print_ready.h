/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

struct timespec;

void print_ready(
        char *restrict msg,
        struct timespec * restrict ts_start,
        struct timespec * restrict ts_end,
        const char *restrict format,
        ...)
    __attribute__((format(printf, 4, 5)));
