/*
 * Copyright (c) 2024-2025 SAULX
 *
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include "jemalloc_selva.h"
#include "libdeflate.h"
#include "selva/selva_lang.h"

struct mbscmp_ctx {
    wctrans_t trans;
    locale_t loc;
    mbstate_t ps1;
    mbstate_t ps2;
    const char *s2;
    size_t left2;
};

static int cb_mbscmp(void * restrict ctx, const uint8_t * restrict buf, size_t dict_len, size_t data_len)
{
    struct mbscmp_ctx *c = (struct mbscmp_ctx *)ctx;

    const char *s1 = (const char *)(buf + dict_len);
    size_t left1 = data_len;

    while (true) {
        wchar_t wc1 = 0;
        wchar_t wc2 = 0;
        const size_t nbytes1 = selva_mbstowc(&wc1, s1, left1, &c->ps1, c->trans, c->loc);
        const size_t nbytes2 = selva_mbstowc(&wc2, c->s2, c->left2, &c->ps2, c->trans, c->loc);

        if (!wc1 && !wc2) {
            return 0;
        }
        const ssize_t diff = wc1 - wc2;
        if (diff) {
            return diff;
        }

        s1 += nbytes1;
        left1 -= nbytes1;
        c->s2 += nbytes2;
        c->left2 -= nbytes2;
    }
}

int selva_deflate_mbscmp(
        struct libdeflate_decompressor *decompressor,
        struct libdeflate_block_state *state,
        const char *in_buf, size_t in_len,
        const char *mbs2_str, size_t mbs2_len,
        wctrans_t trans, locale_t loc)
{
    int result;
    enum libdeflate_result res;

    struct mbscmp_ctx ctx = {
        .trans = trans,
        .loc = loc,
        .s2 = mbs2_str,
        .left2 = mbs2_len,
    };

    do {
        result = 0;
        res = libdeflate_decompress_stream(decompressor, state, in_buf, in_len, cb_mbscmp, &ctx, &result);
    } while (res == LIBDEFLATE_INSUFFICIENT_SPACE && libdeflate_block_state_growbuf(state));

    return res != LIBDEFLATE_SUCCESS ? -1 : result;
}
