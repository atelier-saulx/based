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

#define STRSEARCH_NEEDLE_MAX 39

/**
 * Fuzzy substring search.
 * @returns 0 == perfect match, no changes needed to the needle;
 *          0..needle_len - 1 == this many changes needed to make a match;
 *          needle_len == no match/change every character to make a match;
 *          INT_MAX == error or too long needle.
 */
SELVA_EXPORT
int strsearch_has(locale_t loc, wctrans_t trans, const char *text, const char *needle, size_t needle_len, int good);
