/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "_evl_export.h"

struct selva_langs;
#if EVL_MAIN
int load_langs(void);
extern struct selva_langs selva_langs EVL_EXTERN;
#else
struct selva_langs *selva_langs EVL_COMMON;
#endif
