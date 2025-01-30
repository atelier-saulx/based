/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

[[noreturn]]
void db_panic_fn(const char * restrict where, const char * restrict func, const char * restrict fmt, ...) __attribute__((format(printf, 3, 4)));

#define DB_PANIC_WHERESTR (__FILE__ ":" S__LINE__)

#define db_panic1(where, func, fmt, ...) \
    db_panic_fn(where, func, fmt __VA_OPT__(,) __VA_ARGS__)

#define db_panic(fmt, ...) \
    db_panic1(DB_PANIC_WHERESTR, __func__, fmt __VA_OPT__(,) __VA_ARGS__)
