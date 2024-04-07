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


static char *full_decompress(struct libdeflate_decompressor *d, const char *in_buf, size_t in_len, char *out_buf, size_t out_len)
{
    const size_t kMaxDeflateBlockSize = 8 * 1024 * 1024;
    register struct libdeflate_block_def def = libdeflate_block_def_init(kMaxDeflateBlockSize);
    register struct libdeflate_block_state state = libdeflate_block_state_init(def);
	uint8_t *data_buf;
	size_t in_cur = 0;
	size_t actual_in_nbytes_ret;
    bool final_block = false;
	int ret;
    size_t out_i = 0;

    data_buf = libdeflate_block_state_alloc_buf(def);

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

		if (final_block || libdeflate_block_state_is_out_block_ready(def, state)) {
            const size_t dlen = state.data_cur - def.k_dict_size;

            pu_assert("no overrun", out_i + dlen <= out_len);

            memmove(out_buf + out_i, data_buf + def.k_dict_size, dlen);
            out_i += dlen;

            state = libdeflate_block_state_next(def, data_buf, state);
		}
	} while (!final_block);

    libdeflate_block_state_free_buf(data_buf);

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
    full_decompress(d, compressed, compressed_len, output, sizeof(output));

    pu_assert_str_equal("strings equal", input, output);

    return NULL;
}
