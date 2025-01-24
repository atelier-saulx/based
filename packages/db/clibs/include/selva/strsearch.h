/*
 * Copyright (c) 2024-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stdint.h>
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

SELVA_EXPORT
int strsearch_make_wneedle(struct strsearch_wneedle *wneedle, locale_t loc, wctrans_t trans, const char *needle, size_t needle_len);

SELVA_EXPORT
uint8_t strsearch_levenshtein_u8(const char * restrict s, size_t m, const char * restrict t, size_t n);

SELVA_EXPORT
uint8_t strsearch_levenshtein_mbs(locale_t loc, wctrans_t trans, const char *s, size_t m, const struct strsearch_wneedle *wneedle);

/**
 * Calculate the Hamming distance of two strings of the same length.
 */
SELVA_EXPORT
uint32_t strsearch_hamming(const char * restrict s, const char * restrict t, size_t n);

/**
 * Calculate the Hamming distance of two strings of the same length in code points.
 * The input string mbs must be NFKD normalized and the string t must contain
 * only ASCII characters. At most t_len bytes will be compared.
 */
SELVA_EXPORT
uint32_t strsearch_hamming_mbs(const char * restrict mbs, size_t mbs_len, const char * restrict t, size_t t_len);
