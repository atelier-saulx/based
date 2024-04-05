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

#define             kDictSize    (1 << 15)  //MATCHFINDER_WINDOW_SIZE
static const size_t kMaxDeflateBlockSize_min = 1024 * 4;
static const size_t kMaxDeflateBlockSize_max = ((~(size_t)0) - kDictSize) / 4;
static const size_t kMaxDeflateBlockSize = (size_t)1024 * 1024 * 8;

static size_t _dictSize_avail(uint64_t uncompressed_pos)
{
    return (uncompressed_pos < kDictSize) ? (size_t)uncompressed_pos : kDictSize;
}

static size_t _limitMaxDefBSize(size_t maxDeflateBlockSize)
{
    if (maxDeflateBlockSize < kMaxDeflateBlockSize_min) return kMaxDeflateBlockSize_min;
    if (maxDeflateBlockSize > kMaxDeflateBlockSize_max) return kMaxDeflateBlockSize_max;
    return maxDeflateBlockSize;
}

static char *fn(struct libdeflate_decompressor *d, const char *in_buf, size_t in_len, char *out_buf, size_t out_len)
{
	int err_code = 0;
	uint8_t *pmem = 0;
	uint8_t *data_buf;
	uint64_t out_cur = 0;
	const size_t curBlockSize = _limitMaxDefBSize(kMaxDeflateBlockSize);
	const size_t data_buf_size = 2 * curBlockSize + kDictSize;
	size_t data_cur = kDictSize;
    size_t code_buf_size = 2 * curBlockSize;
	size_t in_cur = 0;
	size_t actual_in_nbytes_ret;
    bool final_block = false;
	int ret;
    size_t out_i = 0;

    data_buf = malloc(data_buf_size + code_buf_size);

	do {
		bool is_final_block_ret;
		size_t actual_out_nbytes_ret;
		size_t dict_size = _dictSize_avail(out_cur + (data_cur - kDictSize));

		ret = libdeflate_decompress_block(d, in_buf + in_cur, in_len - in_cur,
				data_buf + data_cur - dict_size, dict_size, data_buf_size - data_cur,
				&actual_in_nbytes_ret, &actual_out_nbytes_ret,
				LIBDEFLATE_STOP_BY_ANY_BLOCK, &final_block);

        pu_assert_equal("SUCCESS", ret, LIBDEFLATE_SUCCESS);

		in_cur += actual_in_nbytes_ret;
		data_cur += actual_out_nbytes_ret;

		if (final_block || (data_cur > curBlockSize + kDictSize)) {
            const size_t dlen = data_cur - kDictSize;

            pu_assert("no overrun", out_i + dlen <= out_len);

            memmove(out_buf + out_i, data_buf + kDictSize, dlen);
            out_i += dlen;

			out_cur += data_cur - kDictSize;
			dict_size = _dictSize_avail(out_cur);
			memmove(data_buf + kDictSize - dict_size, data_buf + data_cur - dict_size, dict_size); /* dict data for next block */
			data_cur = kDictSize;
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

    return NULL;
}
