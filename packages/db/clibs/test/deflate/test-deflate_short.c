/*
 * Copyright (c) 2025 SAULX
 *
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <punit.h>
#include "selva/ctime.h"
#include "selva/timestamp.h"
#include "print_ready.h"
#include "libdeflate.h"
#include "book.h"

#define N 10'000

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

PU_TEST(test_deflate_short)
{
    char compressed[libdeflate_compress_bound(sizeof(book))];
    size_t compressed_len;
    size_t output_sizes[] = { 16, 64 * 1024, sizeof(book) };

    compressed_len = libdeflate_compress(c, book, sizeof(book), compressed, libdeflate_compress_bound(sizeof(book)));

    for (size_t i = 0; i < num_elem(output_sizes); i++) {
        size_t output_size = output_sizes[i];
        char *output = malloc(output_size);
        size_t actual_out_nbytes_ret = 0;
        enum libdeflate_result res;
        struct timespec start, end;

        ts_monotime(&start);
        res = libdeflate_decompress_short(d,
                compressed, compressed_len,
                output, output_size,
                &actual_out_nbytes_ret);
        ts_monotime(&end);
#if 0
        printf("deflate: %d %zu %zu\n", res, actual_in_nbytes_ret, actual_out_nbytes_ret);
        printf("output: %.*s\n", (int)actual_out_nbytes_ret, output);
#endif

        pu_assert("no error", res == LIBDEFLATE_SUCCESS || res == LIBDEFLATE_MORE);
        pu_assert_equal("", actual_out_nbytes_ret, output_size);
        pu_assert_buf_equal("decompressed correctly", book, output, output_size);
        free(output);
        print_ready("libdeflate_decompress_short", &start, &end, "%zu bytes", output_size);
    }

    return NULL;
}

PU_TEST(test_deflate_short_perf)
{
    char compressed[libdeflate_compress_bound(sizeof(book))];
    size_t compressed_len;

    compressed_len = libdeflate_compress(c, book, sizeof(book), compressed, libdeflate_compress_bound(sizeof(book)));

    char output[16 * 1024];

    struct timespec start, end, t_block, t_short;

    ts_monotime(&start);
    for (size_t i = 0; i < N; i++) {
        size_t actual_in_nbytes_ret = 0;
        size_t actual_out_nbytes_ret = 0;
        enum libdeflate_result res;

        libdeflate_decompress_block_reset(d);
        res = libdeflate_decompress_block(d, compressed, compressed_len,
                output, 0, sizeof(output),
                &actual_in_nbytes_ret, &actual_out_nbytes_ret,
                LIBDEFLATE_STOP_BY_ANY_BLOCK);
#if 0
        printf("deflate: %d %zu %zu\n", res, actual_in_nbytes_ret, actual_out_nbytes_ret);
#endif
        pu_assert("", res == LIBDEFLATE_SUCCESS || res == LIBDEFLATE_MORE);
    }
    ts_monotime(&end);
    timespec_sub(&t_block, &end, &start);
    print_ready("libdeflate_decompress_block", &start, &end, "%zu bytes", sizeof(output));

    ts_monotime(&start);
    for (size_t i = 0; i < N; i++) {
        size_t actual_out_nbytes_ret = 0;
        enum libdeflate_result res;

        res = libdeflate_decompress_short(d,
                compressed, compressed_len,
                output, 16, /* sizeof(output) to test for a larger chunk => slower than libdeflate_decompress_block() */
                &actual_out_nbytes_ret);
        pu_assert("", res == LIBDEFLATE_SUCCESS || res == LIBDEFLATE_MORE);
#if 0
        printf("deflate: %d %zu %zu\n", res, actual_in_nbytes_ret, actual_out_nbytes_ret);
        printf("output: %.*s\n", (int)actual_out_nbytes_ret, output);
#endif
    }
    ts_monotime(&end);
    timespec_sub(&t_short, &end, &start);
    print_ready("libdeflate_decompress_short", &start, &end, "");

    pu_assert("short is faster for small buf", timespec_cmp(&t_short, &t_block, <));

    return NULL;
}

#undef N
#define N 100
PU_TEST(test_deflate_short_perf_same_output_size)
{
    char compressed[libdeflate_compress_bound(sizeof(book))];
    size_t compressed_len;
    size_t output_sizes[] = { 10309, sizeof(book) };

    compressed_len = libdeflate_compress(c, book, sizeof(book), compressed, libdeflate_compress_bound(sizeof(book)));

    for (size_t i = 0; i < num_elem(output_sizes); i++) {
        size_t output_size = output_sizes[i];
        char *output = malloc(output_size);
        struct timespec start, end, t_block, t_short;

        printf("deflate %zu bytes\n", output_size);

        ts_monotime(&start);
        for (size_t i = 0; i < N; i++) {
            size_t actual_in_nbytes_ret = 0;
            size_t actual_out_nbytes_ret = 0;
            enum libdeflate_result res;

            libdeflate_decompress_block_reset(d);
            res = libdeflate_decompress_block(d, compressed, compressed_len,
                    output, 0, output_size,
                    &actual_in_nbytes_ret, &actual_out_nbytes_ret,
                    output_size < sizeof(book) ? LIBDEFLATE_STOP_BY_ANY_BLOCK_AND_FULL_OUTPUT : LIBDEFLATE_STOP_BY_FINAL_BLOCK);
#if 0
            printf("deflate: %d %zu %zu\n", res, actual_in_nbytes_ret, actual_out_nbytes_ret);
#endif
            pu_assert("", res == LIBDEFLATE_SUCCESS || res == LIBDEFLATE_MORE);
            pu_assert_equal("decompressed output_size bytes", output_size, actual_out_nbytes_ret);
        }
        ts_monotime(&end);
        timespec_sub(&t_block, &end, &start);
        print_ready("libdeflate_decompress_block", &start, &end, "");

        ts_monotime(&start);
        for (size_t i = 0; i < N; i++) {
            size_t actual_out_nbytes_ret = 0;
            enum libdeflate_result res;

            res = libdeflate_decompress_short(d,
                    compressed, compressed_len,
                    output, output_size,
                    &actual_out_nbytes_ret);
            pu_assert("", res == LIBDEFLATE_SUCCESS || res == LIBDEFLATE_MORE);
            pu_assert_equal("decompressed output_size bytes", output_size, actual_out_nbytes_ret);
#if 0
            printf("deflate: %d %zu %zu\n", res, actual_in_nbytes_ret, actual_out_nbytes_ret);
            printf("output: %.*s\n", (int)actual_out_nbytes_ret, output);
#endif
        }
        ts_monotime(&end);
        timespec_sub(&t_short, &end, &start);
        print_ready("libdeflate_decompress_short", &start, &end, "");

        free(output);
    }

    return NULL;
}
