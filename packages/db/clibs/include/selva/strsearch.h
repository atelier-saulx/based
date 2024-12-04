/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#if defined(__APPLE__) && __MACH__
#include <xlocale.h>
#endif
#include <locale.h>
#include <wctype.h>
#include "selva/_export.h"

#define STRSEARCH_NEEDLE_MAX 40

SELVA_EXPORT
int strsearch_has(locale_t loc, wctrans_t trans, const char *text, const char *needle, size_t needle_len, int good);
