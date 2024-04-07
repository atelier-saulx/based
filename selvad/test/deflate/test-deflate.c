/*
 * Copyright (c) 2024 SAULX
 *
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <punit.h>
#include "libdeflate.h"
#include "libdeflate_block_state.h"
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

static char *full_decompress(struct libdeflate_decompressor *d, const char *in_buf, size_t in_len, char *out_buf, size_t out_len)
{
    const size_t kMaxDeflateBlockSize = 64 * 1024;
    struct libdeflate_block_state state = libdeflate_block_state_init(kMaxDeflateBlockSize);
	size_t in_cur = 0;
	size_t actual_in_nbytes_ret;
    bool final_block = false;
	int ret;
    size_t out_i = 0;

retry:
    libdeflate_decompress_block_reset(d);
	do {
		size_t actual_out_nbytes_ret;

#if 0
        printf("cur_block_size: %zu\n", state.cur_block_size);
#endif

        ret = libdeflate_decompress_block_wstate(
                d, &state,
                in_buf + in_cur, in_len - in_cur,
                &actual_in_nbytes_ret, &actual_out_nbytes_ret, &final_block);
        if (ret == LIBDEFLATE_INSUFFICIENT_SPACE &&
            libdeflate_block_state_growbuf(&state)) {
            in_cur = 0;
            out_i = 0;
            goto retry;
        }

        pu_assert_equal("SUCCESS", ret, LIBDEFLATE_SUCCESS);

		in_cur += actual_in_nbytes_ret;
		state.data_cur += actual_out_nbytes_ret;

#if 0
        printf("final: %d\n", final_block);
#endif
		if (final_block || libdeflate_block_state_is_out_block_ready(&state)) {
            const size_t dlen = state.data_cur - state.k_dict_size;
#if 0
            printf("data_len: %zu\n", state.data_cur - state.k_dict_size);
#endif

            pu_assert("no overrun", out_i + dlen <= out_len);

            memmove(out_buf + out_i, state.data_buf + state.k_dict_size, dlen);
            out_i += dlen;

            libdeflate_block_state_next(&state);
		}
	} while (!final_block);

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
    char compressed[libdeflate_compress_bound(sizeof(book))];
    size_t compressed_len;

    compressed_len = libdeflate_compress(c, book, sizeof(book), compressed, libdeflate_compress_bound(sizeof(book)));
#if 0
    printf("book_len: %zu comp_len: %zu\n", sizeof(book), compressed_len);
#endif
    pu_assert("", compressed_len != 0);
    int res = libdeflate_memcmp(d, compressed, compressed_len, book, sizeof(book));
    pu_assert_equal("Strings equal", res, 0);

    return NULL;
}
