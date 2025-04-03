/*
 * Copyright (c) 2024-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#define _XOPEN_SOURCE 700
#include <assert.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <wchar.h>
#include <wctype.h>
#include <locale.h>
#if __APPLE__
#include <xlocale.h>
#endif
#include "jemalloc_selva.h"
#include "selva/selva_lang.h"

char *selva_mbstrans(locale_t loc, const char *s, size_t len, wctrans_t trans)
{
    len++;
    size_t dst_len = len * sizeof(wchar_t);
    char *dst_str = selva_malloc(dst_len + 1);
    mbstate_t read_state;
    mbstate_t write_state;
    size_t dst_i = 0;

    memset(&read_state, 0, sizeof(read_state));
    memset(&write_state, 0, sizeof(write_state));

    while (true) {
        wchar_t wc;
        size_t rd_bytes;

#if __APPLE__
        rd_bytes = mbrtowc_l(&wc, s, len, &read_state, loc);
#else
        rd_bytes = mbrtowc(&wc, s, len, &read_state);
#endif
        assert(dst_i < dst_len);
        if (rd_bytes == 0) {
            /* Terminate the result string. */
            dst_str[dst_i] = '\0';
            dst_len = dst_i;
            dst_str = selva_realloc(dst_str, dst_len + 1);
            break;
        } else if (rd_bytes == (size_t)-2) {
            /* Truncated input string. */
            selva_free(dst_str);
            return nullptr;
        } else if (rd_bytes == (size_t)-1) {
            /* Some other error (including EILSEQ). */
            selva_free(dst_str);
            return nullptr;
        } else {
            /* A character was converted. */
            size_t wr_bytes;
#if __APPLE__
            wr_bytes = wcrtomb_l(dst_str + dst_i, towctrans_l(wc, trans, loc), &write_state, loc);
#else
            wr_bytes = wcrtomb(dst_str + dst_i, towctrans_l(wc, trans, loc), &write_state);
#endif
            if (wr_bytes == (size_t)-1) {
                selva_free(dst_str);
                return nullptr;
            }

            dst_i += wr_bytes;
            len -= rd_bytes;
            s += rd_bytes;
        }
    }

    return dst_str;
}
