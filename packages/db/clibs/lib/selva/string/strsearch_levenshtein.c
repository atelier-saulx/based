/*
 * Copyright (c) 2024-2025 SAULX
 *
 * Licensed under the MIT License.
 * https://opensource.org/licenses/MIT
 * SPDX-License-Identifier: MIT
 */

#include <ctype.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>
#include "selva/selva_lang.h"
#include "selva_error.h"
#include "selva/strsearch.h"

#define LEV_MAX (STRSEARCH_NEEDLE_MAX + 1)

int strsearch_make_wneedle(struct strsearch_wneedle *wneedle, locale_t loc, wctrans_t trans, const char *needle, size_t needle_len)
{
    mbstate_t ps;
    size_t i = 0, j = 0;

    if (needle_len == 0) {
        return SELVA_EINVAL;
    }
    if (needle_len > LEV_MAX - 1) {
        return SELVA_ENOBUFS;
    }

    memset(&ps, 0, sizeof(ps));
    while (i < needle_len) {
        i += selva_mbstowc(wneedle->buf + j++, needle + i, needle_len - i, &ps, trans, loc);
    }
    wneedle->buf[j] = '\0';
    wneedle->len = j;

    return 0;
}

static int32_t min3(int32_t a, int32_t b, int32_t c)
{
    return min(a, min(b, c));
}

uint8_t strsearch_levenshtein_u8(const char * restrict s, size_t m, const char * restrict t, size_t n)
{
    if (m == 0) return n;
    if (n == 0) return m;
    if (n > LEV_MAX - 1 || m > LEV_MAX - 1) {
        return 255;
    }

    int32_t v[2][LEV_MAX];
    int32_t *v0 = v[0];
    int32_t *v1 = v[1];

    for (size_t i = 0; i <= n; i++) v0[i] = i;
    for (size_t i = 0; i < m; i++) {
        v1[0] = i + 1;

        for (size_t j = 0; j < n; j++) {
            v1[j + 1] = min3(v0[j + 1] + 1, v1[j] + 1, v0[j] + (s[i] != t[j]));
        }

        int32_t *tmp = v0;
        v0 = v1;
        v1 = tmp;
    }

    return (uint8_t)v0[n];
}

uint8_t strsearch_levenshtein_mbs(locale_t loc, wctrans_t trans, const char *s, size_t m, const struct strsearch_wneedle *wneedle)
{
    const wchar_t *t = wneedle->buf;
    size_t n = wneedle->len;

    if (m == 0) return n;
    if (m > LEV_MAX - 1) {
        return 255;
    }

    int32_t v[2][LEV_MAX];
    int32_t *v0 = v[0];
    int32_t *v1 = v[1];
    mbstate_t ps;

    memset(&ps, 0, sizeof(ps));
    for (size_t i = 0; i <= n; i++) v0[i] = i;
    for (size_t i = 0; i < m;) {
        wchar_t wc1;
        const size_t nbytes1 = selva_mbstowc(&wc1, s + i, m - i, &ps, trans, loc);
        if (nbytes1 == 0) {
            return 255;
        }

        v1[0] = i + 1;

        for (size_t j = 0; j < n; j++) {
            v1[j + 1] = min3(v0[j + 1] + 1, v1[j] + 1, v0[j] + (wc1 != t[j]));
        }

        int32_t *tmp = v0;
        v0 = v1;
        v1 = tmp;
        i += nbytes1;
    }

    return (uint8_t)v0[n];
}
