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

struct strsearch_wneedle {
    wchar_t buf[STRSEARCH_NEEDLE_MAX + 1];
    size_t len;
};

/**
 * Make needle for strsearch_has_mbs().
 * wneedle is fully allocated by the called.
 * @returns 0 = ok;
 *          SELVA_ENOBUFS = too long needle;
 *          SELVA_EINVAL = needle_len was 0.
 */
int make_wneedle(struct strsearch_wneedle *wneedle, locale_t loc, wctrans_t trans, const char *needle, size_t needle_len);

/**
 * Fuzzy substring search.
 * @returns 0 == perfect match, no changes needed to the needle;
 *          0..needle_len - 1 == this many changes needed to make a match;
 *          needle_len == no match/change every character to make a match;
 *          INT_MAX == error or too long needle.
 */
SELVA_EXPORT
int strsearch_has_u8(const char *text, size_t text_len, const char *needle, size_t needle_len, int good, bool strict_first_char_match);

SELVA_EXPORT
int strsearch_has_mbs(locale_t loc, wctrans_t trans, const char *text, size_t text_len, struct strsearch_wneedle *wneedle, int good);
