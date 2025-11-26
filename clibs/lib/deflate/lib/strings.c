/*
 * Copyright (c) 2024 SAULX
 *
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include "lib_common.h"
#include "libdeflate.h"
#include "libdeflate_strings.h"

struct memcmp_ctx {
    const void *ptr2_buf;
    size_t ptr2_len;
    size_t ptr2_i;
};

static int cb_memcmp(void * restrict ctx, const uint8_t * restrict buf, size_t dict_len, size_t data_len)
{
    struct memcmp_ctx *c = (struct memcmp_ctx *)ctx;
    size_t test_len = MIN(data_len, c->ptr2_len - c->ptr2_i);
    int res;

    buf += dict_len;
    res = memcmp(buf, (uint8_t *)c->ptr2_buf + c->ptr2_i, test_len);
    if (res) {
        return res;
    } else if (c->ptr2_i + data_len > c->ptr2_len) {
        return buf[test_len] - '\0';
    } else {
        c->ptr2_i += test_len;
        return 0;
    }
}

LIBDEFLATEEXPORT int
libdeflate_memcmp(struct libdeflate_decompressor *decompressor, struct libdeflate_block_state *state, const char *in_buf, size_t in_len, const void *ptr2_buf, size_t ptr2_len)
{
    int result;
    enum libdeflate_result res;

    do {
        struct memcmp_ctx ctx = {
            .ptr2_buf = ptr2_buf,
            .ptr2_len = ptr2_len,
            .ptr2_i = 0,
        };

        result = 0;
        res = libdeflate_decompress_stream(decompressor, state, in_buf, in_len, cb_memcmp, &ctx, &result);
    } while (res == LIBDEFLATE_INSUFFICIENT_SPACE && libdeflate_block_state_growbuf(state));

    return res != LIBDEFLATE_SUCCESS ? -1 : result;
}
