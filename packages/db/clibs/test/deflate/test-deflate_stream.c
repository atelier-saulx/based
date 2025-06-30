/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "libdeflate.h"
#include "libdeflate_strings.h"

static struct libdeflate_compressor *c;
static struct libdeflate_decompressor *d;

#include "book.h"

void setup(void)
{
    c = libdeflate_alloc_compressor(9);
    d = libdeflate_alloc_decompressor();
}

void teardown(void)
{
    libdeflate_free_compressor(c);
    libdeflate_free_decompressor(d);
}

struct full_decompress_ctx {
    char *out_buf;
    size_t out_i;
    size_t out_len;
};

static int full_decompress_cb(void * restrict ctx, const uint8_t * restrict buf, size_t dict_len, size_t data_len)
{
    struct full_decompress_ctx *c = (struct full_decompress_ctx *)ctx;

    if (c->out_i + data_len > c->out_len) {
        return -1;
    }

    memmove(c->out_buf + c->out_i, buf + dict_len, data_len);
    c->out_i += data_len;

    return 0;
}

static char *full_decompress(struct libdeflate_decompressor *d, const char *in_buf, size_t in_len, char *out_buf, size_t out_len)
{
    const size_t kMaxDeflateBlockSize = 64 * 1024;
    struct libdeflate_block_state state = libdeflate_block_state_init(kMaxDeflateBlockSize);
    enum libdeflate_result res;
    int result = 0;

    do {
        struct full_decompress_ctx ctx = {
            .out_buf = out_buf,
            .out_i = 0,
            .out_len = out_len,
        };

        res = libdeflate_decompress_stream(d, &state, in_buf, in_len, full_decompress_cb, &ctx, &result);
    } while (res == LIBDEFLATE_INSUFFICIENT_SPACE && libdeflate_block_state_growbuf(&state));

    pu_assert_equal("", res, 0);
    pu_assert_equal("", result, 0);

    libdeflate_block_state_deinit(&state);

    return NULL;
}

PU_TEST(test_deflate_stream)
{
    char compressed[libdeflate_compress_bound(sizeof(book))];
    size_t compressed_len;
    char output[sizeof(book)];

    compressed_len = libdeflate_compress(c, book, sizeof(book), compressed, libdeflate_compress_bound(sizeof(book)));
    full_decompress(d, compressed, compressed_len, output, sizeof(output));

    //pu_assert_str_equal("strings equal", book, output);
    int res = memcmp(output, book, sizeof(book));
    pu_assert_equal("", res, 0);

    return NULL;
}

PU_TEST(test_deflate_memcmp)
{
    struct libdeflate_block_state state = libdeflate_block_state_init(1024);
    char compressed[libdeflate_compress_bound(sizeof(book))];
    size_t compressed_len;

    compressed_len = libdeflate_compress(c, book, sizeof(book), compressed, libdeflate_compress_bound(sizeof(book)));
#if 0
    printf("book_len: %zu comp_len: %zu\n", sizeof(book), compressed_len);
#endif
    pu_assert("", compressed_len != 0);

    int res = libdeflate_memcmp(d, &state, compressed, compressed_len, book, sizeof(book));
    pu_assert_equal("Strings equal", res, 0);

    libdeflate_block_state_deinit(&state);

    return NULL;
}
