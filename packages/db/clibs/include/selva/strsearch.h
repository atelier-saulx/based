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

struct strsearch_needle {
    int good;
    char fch;
    const char *sep;
    const char *buf;
    size_t len;
};

struct strsearch_wneedle {
    int good;
    wchar_t fch;
    const char *sep;
    wchar_t buf[STRSEARCH_NEEDLE_MAX + 1];
    size_t len;
};

SELVA_EXPORT
int strsearch_levenshtein_u8(const char * restrict s, size_t m, const char * restrict t, size_t n);

SELVA_EXPORT
int strsearch_init_u8_ctx(struct strsearch_needle *needle, const char *needle_str, size_t needle_len, int good, bool strict_first_char_match);

/**
 * Make needle for strsearch_has_mbs().
 * wneedle is fully allocated by the called.
 * @returns 0 = ok;
 *          SELVA_ENOBUFS = too long needle;
 *          SELVA_EINVAL = needle_len was 0.
 */
SELVA_EXPORT
int strsearch_init_mbs_ctx(struct strsearch_wneedle *wneedle, locale_t loc, wctrans_t trans, const char *needle, size_t needle_len, int good, bool strict_first_char_match);

/**
 * Fuzzy substring search.
 * @returns 0 == perfect match, no changes needed to the needle;
 *          0..needle_len - 1 == this many changes needed to make a match;
 *          needle_len == no match/change every character to make a match;
 *          INT_MAX == error or too long needle.
 */
SELVA_EXPORT
int strsearch_has_u8(const char *text, size_t text_len, const struct strsearch_needle *needle);

SELVA_EXPORT
int strsearch_has_mbs(locale_t loc, wctrans_t trans, const char *text, size_t text_len, const struct strsearch_wneedle *wneedle);
