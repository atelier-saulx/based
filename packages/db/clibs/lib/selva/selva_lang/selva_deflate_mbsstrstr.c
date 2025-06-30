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

#if defined(EN_VALGRIND)
#define selva_sallocx(p, v)     0
#endif

struct mbsstrstr_ctx {
    wctrans_t trans;
    locale_t loc;
    mbstate_t ps;
    char *match_buf;
    size_t match_size;
    size_t match_len;
    const char *needle_buf;
    size_t needle_len;
};

static int cb_mbsstrstr(void * restrict ctx, const uint8_t * restrict buf, size_t dict_len, size_t data_len)
{
    struct mbsstrstr_ctx *c = (struct mbsstrstr_ctx *)ctx;

    buf += dict_len;

    if (selva_sallocx(c->match_buf, 0) < c->match_size + data_len) {
        c->match_buf = selva_realloc(c->match_buf, c->match_size + data_len);
    }
    memcpy(c->match_buf + c->match_len, buf, data_len);

    const char *s = c->match_buf;
    size_t left = c->match_size + data_len;
    size_t nbytes = 0;
    wchar_t wc;
    do {
        s += nbytes;
        left -= nbytes;
        size_t new_match_len = min(left, c->needle_len);

        if (!selva_mbscmp(s, new_match_len, c->needle_buf, new_match_len, c->trans, c->loc)) {
            c->match_len = new_match_len;
            c->match_size = left;
            memmove(c->match_buf, s, left);
            return c->match_len == c->needle_len;
        }

        wc = 0;
        nbytes = selva_mbstowc(&wc, s, left, &c->ps, c->trans, c->loc);
    } while (wc);

    c->match_size = 0;
    c->match_len = 0;

    return 0;
}

bool selva_deflate_mbsstrstr(
        struct libdeflate_decompressor *decompressor,
        struct libdeflate_block_state *state,
        const char *in_buf, size_t in_len,
        const void *needle_buf, size_t needle_len,
        wctrans_t trans, locale_t loc)
{
    int result;
    enum libdeflate_result res;

    if (in_len == 0 || needle_len == 0) {
        return 0;
    }

    struct mbsstrstr_ctx ctx = {
        .trans = trans,
        .loc = loc,
        .match_buf = selva_malloc(needle_len),
        .needle_buf = needle_buf,
        .needle_len = needle_len,
    };

    do {
        result = 0;
        res = libdeflate_decompress_stream(decompressor, state, in_buf, in_len, cb_mbsstrstr, &ctx, &result);
    } while (res == LIBDEFLATE_INSUFFICIENT_SPACE && libdeflate_block_state_growbuf(state));

    selva_free(ctx.match_buf);

    return res == LIBDEFLATE_SUCCESS && result;
}
