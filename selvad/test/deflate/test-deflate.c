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

static struct libdeflate_compressor *c;
static struct libdeflate_decompressor *d;

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

#define             kDictSize    (1 << 15)  /* MATCHFINDER_WINDOW_SIZE */

static size_t dict_size_avail(uint64_t uncompressed_pos)
{
    return (uncompressed_pos < kDictSize) ? (size_t)uncompressed_pos : kDictSize;
}

static size_t limit_max_def_bsize(size_t maxDeflateBlockSize)
{
    const size_t kMaxDeflateBlockSize_min = 1024 * 4;
    const size_t kMaxDeflateBlockSize_max = ((~(size_t)0) - kDictSize) / 4;

    if (maxDeflateBlockSize < kMaxDeflateBlockSize_min) return kMaxDeflateBlockSize_min;
    if (maxDeflateBlockSize > kMaxDeflateBlockSize_max) return kMaxDeflateBlockSize_max;
    return maxDeflateBlockSize;
}

struct deflate_block_def {
    size_t cur_block_size;
    size_t data_buf_size;
};

struct deflate_block_state {
    uint64_t out_cur;
    size_t data_cur;
};

static struct deflate_block_def deflate_block_def_init(size_t max_deflate_block_size)
{
    const size_t cur_block_size = limit_max_def_bsize(max_deflate_block_size);
    const size_t data_buf_size = 2 * cur_block_size + kDictSize;

    return (struct deflate_block_def){
        .cur_block_size = cur_block_size,
        .data_buf_size = data_buf_size,
    };
}

static struct deflate_block_state deflate_block_state_init(void)
{
    return (struct deflate_block_state){
        .out_cur = 0,
        .data_cur = kDictSize,
    };
}

static uint8_t *alloc_buf(struct deflate_block_def def)
{
    /* TODO Is this needed? */
    size_t code_buf_size = 2 * def.cur_block_size;

    return malloc(def.data_buf_size + code_buf_size);
}

static bool is_out_block_ready(struct deflate_block_def def, struct deflate_block_state state)
{
    return state.data_cur > def.cur_block_size + kDictSize;
}

static struct deflate_block_state next_state(uint8_t *data_buf, struct deflate_block_state state)
{
    size_t dict_size;

    state.out_cur += state.data_cur - kDictSize;
    dict_size = dict_size_avail(state.out_cur);
    memmove(data_buf + kDictSize - dict_size, data_buf + state.data_cur - dict_size, dict_size); /* dict data for next block */
    state.data_cur = kDictSize;

    return state;
}

static inline enum libdeflate_result libdeflate_decompress_block_wstate(
        struct libdeflate_decompressor *decompressor,
        struct deflate_block_def def,
        struct deflate_block_state state,
        const void *in_part, size_t in_part_nbytes_bound,
        void *data_buf,
        size_t *actual_in_nbytes_ret, size_t *actual_out_nbytes_ret,
        bool *is_final_block_ret)
{
    size_t dict_size = dict_size_avail(state.out_cur + (state.data_cur - kDictSize));

    return libdeflate_decompress_block(d, in_part, in_part_nbytes_bound,
            data_buf + state.data_cur - dict_size, dict_size, def.data_buf_size - state.data_cur,
            actual_in_nbytes_ret, actual_out_nbytes_ret,
            LIBDEFLATE_STOP_BY_ANY_BLOCK, is_final_block_ret);
}

static char *fn(struct libdeflate_decompressor *d, const char *in_buf, size_t in_len, char *out_buf, size_t out_len)
{
    const size_t kMaxDeflateBlockSize = 8 * 1024 * 1024;
    register struct deflate_block_def def = deflate_block_def_init(kMaxDeflateBlockSize);
    register struct deflate_block_state state = deflate_block_state_init();
	uint8_t *data_buf;
	size_t in_cur = 0;
	size_t actual_in_nbytes_ret;
    bool final_block = false;
	int ret;
    size_t out_i = 0;

    data_buf = alloc_buf(def);

	do {
		bool is_final_block_ret;
		size_t actual_out_nbytes_ret;

        ret = libdeflate_decompress_block_wstate(
                d, def, state,
                in_buf + in_cur, in_len - in_cur,
                data_buf,
                &actual_in_nbytes_ret, &actual_out_nbytes_ret, &final_block);

        pu_assert_equal("SUCCESS", ret, LIBDEFLATE_SUCCESS);

		in_cur += actual_in_nbytes_ret;
		state.data_cur += actual_out_nbytes_ret;

		if (final_block || is_out_block_ready(def, state)) {
            const size_t dlen = state.data_cur - kDictSize;

            pu_assert("no overrun", out_i + dlen <= out_len);

            memmove(out_buf + out_i, data_buf + kDictSize, dlen);
            out_i += dlen;

            state = next_state(data_buf, state);
		}
	} while (!final_block);

    free(data_buf);

    return NULL;
}

PU_TEST(test_deflate_stream)
{
    char input[] = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, "
        "sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. "
        "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris "
        "nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in "
        "reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla "
        "pariatur. Excepteur sint occaecat cupidatat non proident, sunt in "
        "culpa qui officia deserunt mollit anim id est laborum.";
    char compressed[libdeflate_compress_bound(sizeof(input))];
    size_t compressed_len;
    char output[sizeof(input)];

    compressed_len = libdeflate_compress(c, input, sizeof(input), compressed, libdeflate_compress_bound(sizeof(input)));
    fn(d, compressed, compressed_len, output, sizeof(output));

    pu_assert_str_equal("strings equal", input, output);
#if 0
    printf("%s\n", output);
#endif

    return NULL;
}
