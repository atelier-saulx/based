/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "_evl_export.h"

struct selva_langs;
#if EVL_MAIN
int load_langs(void);
extern struct selva_langs *selva_langs EVL_EXTERN;
#else
struct selva_langs *selva_langs EVL_COMMON;
#endif

#define evl_import_selva_langs() do { \
    if (!selva_langs) { \
        evl_import(selva_langs, NULL); \
        selva_langs = *(struct selva_langs **)selva_langs; \
    } \
} while (0)
