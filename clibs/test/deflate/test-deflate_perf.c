/*
 * Copyright (c) 2024-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <inttypes.h>
#include <stdarg.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include "libdeflate.h"
#include "selva/ctime.h"
#include "selva/timestamp.h"
#include "print_ready.h"
#if 0
#include "zstd.h"
#endif
#include "util.h"

static char *book;
static struct libdeflate_compressor *c;
static struct libdeflate_decompressor *d;

void setup(void)
{
    c = libdeflate_alloc_compressor(1);
    d = libdeflate_alloc_decompressor();
}

void teardown(void)
{
    libdeflate_free_compressor(c);
    libdeflate_free_decompressor(d);
}

__constructor static void init(void)
{
    FILE *fp;
    long fsize;

    fp = fopen("../../../test/shared/bible.txt", "r");
    if (!fp) {
        abort();
    }
    fseek(fp, 0, SEEK_END);
    fsize = ftell(fp);
    fseek(fp, 0, SEEK_SET);

    book = malloc(fsize + 1);
    fread(book, fsize, 1, fp);
    fclose(fp);

    book[fsize] = 0;
}

#define NUM_ITERATIONS	200

static uint64_t
do_test_libdeflate(const uint8_t *in, size_t in_nbytes, uint8_t *out, size_t out_nbytes_avail)
{
	uint64_t t;

	t = timer_ticks();
	for (unsigned i = 0; i < NUM_ITERATIONS; i++) {
	    enum libdeflate_result res;
        size_t out_len;

		res = libdeflate_decompress(d, in, in_nbytes, out, out_nbytes_avail, NULL);
		assert(res == LIBDEFLATE_SUCCESS);
	}
	t = timer_ticks() - t;

	printf("[libdeflate_decompress]: %"PRIu64" MB/s\n",
	       timer_MB_per_s((uint64_t)out_nbytes_avail * NUM_ITERATIONS, t));

	return t;
}

PU_TEST(test_deflate_perf)
{
    size_t len = strlen(book);
    size_t compressed_len = libdeflate_compress_bound(len);
    char *compressed_buf = malloc(libdeflate_compress_bound(len));
    char *output_buf = malloc(len);
    size_t output_len;
    struct timespec start;
    struct timespec end;

    ts_monotime(&start);
    compressed_len = libdeflate_compress(c, book, len, compressed_buf, compressed_len);
    ts_monotime(&end);
    print_ready("libdeflate_compress", &start, &end, "cratio: (%zu / %zu) = %f", len, compressed_len, (double)len / (double)compressed_len);

    do_test_libdeflate(compressed_buf, compressed_len, output_buf, len);
    pu_assert("in == out", !memcmp(book, output_buf, len));

    free(output_buf);
    free(compressed_buf);
    return NULL;
}

/**
 * Read dictionary.
 * The dictionary was made with the following Python3 program:
 * ```
 * import zstandard
 * import sys
 *
 * ENCODING="UTF-8"
 *
 * training_data = sys.stdin.read()
 * dictionary = zstandard.ZstdCompressionDict(training_data.encode(ENCODING), dict_type=zstandard.DICT_TYPE_RAWCONTENT)
 * f = open("dict.bin", "wb")
 * f.write(dictionary.as_bytes())
 * f.close()
 * ```
 */
static void read_dict(char *dict, const char *path)
{
    FILE *fp = fopen(path, "rb");
    if (!fp) {
        abort();
    }
    fread(dict, 1, 1 << 15, fp);
    fclose(fp);
}

PU_TEST(test_deflate_perf_shared_dict)
{
    static char dict[32768];
    read_dict(dict, "dict.txt");
    struct libdeflate_compressor *c1 = libdeflate_alloc_compressor(1);
    struct libdeflate_compressor *c2 = libdeflate_alloc_compressor2(1, dict);
    size_t len = strlen(book);
    size_t compressed_len = libdeflate_compress_bound(len);
    char *compressed_buf = malloc(libdeflate_compress_bound(len));
    size_t zres;
    struct timespec start, end, c1_time, c2_time;

    ts_monotime(&start);
    zres = libdeflate_compress(c1, book, len, compressed_buf, compressed_len);
    ts_monotime(&end);
    timespec_sub(&c1_time, &end, &start);
    print_ready("compress", &start, &end, "cratio: (%zu / %zu) = %f", len, zres, (double)len / (double)zres);

    char *output_buf = malloc(len);
    size_t output_len;
    ts_monotime(&start);
    enum libdeflate_result res = libdeflate_decompress(d, compressed_buf, compressed_len, output_buf, len, &output_len);
    ts_monotime(&end);
    pu_assert_equal("", res, LIBDEFLATE_SUCCESS);
    pu_assert_equal("", output_len, len);
    print_ready("libdeflate_decompress", &start, &end, "");
    free(output_buf);

    /* TODO There is something weird because the zres is not always the same. */
    ts_monotime(&start);
    zres = libdeflate_compress(c2, book, len, compressed_buf, compressed_len);
    ts_monotime(&end);
    timespec_sub(&c2_time, &end, &start);
    print_ready("compress shared dict", &start, &end, "cratio: (%zu / %zu) = %f", len, zres, (double)len / (double)zres);
    pu_assert_equal("shared dict is faster", timespec_cmp(&c1_time, &c2_time, >), true);

    /* TODO Support decompressing this */
#if 0
    char *output_buf = malloc(len);
    size_t output_len;
    ts_monotime(&start);
    enum libdeflate_result res = libdeflate_decompress(d, compressed_buf, compressed_len, output_buf, len, &output_len);
    ts_monotime(&end);
    pu_assert_equal("", res, LIBDEFLATE_SUCCESS);
    pu_assert_equal("", output_len, len);
    print_ready("libdeflate_decompress", &start, &end, "");
    free(output_buf);
#endif

    return NULL;
}

static const char *do_test_libdeflate2(const uint8_t *in, size_t in_nbytes, int level)
{
    struct libdeflate_compressor *c = libdeflate_alloc_compressor(level);
    const size_t compressed_size = libdeflate_compress_bound(in_nbytes);
    size_t compressed_len;
    char *compressed_buf = malloc(compressed_size);
    char *output_buf = malloc(in_nbytes);
	uint64_t t;

	t = timer_ticks();
	for (unsigned i = 0; i < NUM_ITERATIONS; i++) {
        compressed_len = libdeflate_compress(c, in, in_nbytes, compressed_buf, compressed_size);
	}
	t = timer_ticks() - t;

	printf("[libdeflate_compress  ]: level: %d\t%"PRIu64" MB/s cratio: (%zu / %zu) = %f\n",
           level,
	       timer_MB_per_s((uint64_t)in_nbytes * NUM_ITERATIONS, t),
           in_nbytes, compressed_len,
           (double)in_nbytes / (double)compressed_len);

	t = timer_ticks();
	for (unsigned i = 0; i < NUM_ITERATIONS; i++) {
        size_t out_len;
	    enum libdeflate_result res;

		res = libdeflate_decompress(d, compressed_buf, compressed_len, output_buf, in_nbytes, &out_len);
		assert(res == LIBDEFLATE_SUCCESS);
        assert(out_len == in_nbytes);
	}
	t = timer_ticks() - t;

	printf("[libdeflate_decompress]: %"PRIu64" MB/s\n",
	       timer_MB_per_s((uint64_t)in_nbytes * NUM_ITERATIONS, t));
    pu_assert("in == out", !memcmp(in, output_buf, in_nbytes));

    free(output_buf);
    free(compressed_buf);
    libdeflate_free_compressor(c);
	return NULL;
}

#if 0
static const char *do_test_zstd(const uint8_t *in, size_t in_nbytes, int level)
{
    ZSTD_CCtx *cctx = ZSTD_createCCtx();
    ZSTD_DCtx *dctx = ZSTD_createDCtx();
    const size_t compressed_size = libdeflate_compress_bound(in_nbytes);
    size_t compressed_len;
    char *compressed_buf = malloc(compressed_size);
    char *output_buf = malloc(in_nbytes);
	uint64_t t;

	t = timer_ticks();
	for (unsigned i = 0; i < NUM_ITERATIONS; i++) {
        compressed_len = ZSTD_compressCCtx(cctx, compressed_buf, compressed_size, in, in_nbytes, level);
	}
	t = timer_ticks() - t;

	printf("[zstd_compress  ]: %d\t%"PRIu64" MB/s cratio: (%zu / %zu) = %f\n",
           level,
	       timer_MB_per_s((uint64_t)in_nbytes * NUM_ITERATIONS, t),
           in_nbytes, compressed_len,
           (double)in_nbytes / (double)compressed_len);

	t = timer_ticks();
	for (unsigned i = 0; i < NUM_ITERATIONS; i++) {
        size_t out_len;

        out_len = ZSTD_decompressDCtx(dctx, output_buf, in_nbytes, compressed_buf, compressed_len);
        assert(out_len == in_nbytes);
	}
	t = timer_ticks() - t;

	printf("[zstd_decompress]: %"PRIu64" MB/s\n",
	       timer_MB_per_s((uint64_t)in_nbytes * NUM_ITERATIONS, t));
    pu_assert("in == out", !memcmp(in, output_buf, in_nbytes));

    free(output_buf);
    free(compressed_buf);
    ZSTD_freeCCtx(cctx);
    ZSTD_freeDCtx(dctx);
	return NULL;
}

PU_TEST(test_deflate_vs_zstd)
{
    size_t len = strlen(book);
    const char *res;
#if 0
    int deflate_levels[] = { 1,  2, 3,  5, 7, 9, 10, 11, 12 };
    int zstd_levels[] = {   -7, -3, -1, 0, 1, 3, 10, 15, 22 };
#endif
    int deflate_levels[] = { 1, 3, 6, };
    int zstd_levels[] = {   -1, 0, 1, };

    for (unsigned i = 0; i < num_elem(deflate_levels); i++) {
        res = do_test_libdeflate2(book, len, deflate_levels[i]);
        if (res) {
            return res;
        }
    }

    for (unsigned i = 0; i < num_elem(zstd_levels); i++) {
        res = do_test_zstd(book, len, zstd_levels[i]);
        if (res) {
            return res;
        }
    }

    return NULL;
}
#endif
