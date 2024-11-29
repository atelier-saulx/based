/*
 * Copyright (c) 2024 SAULX
 *
 * SPDX-License-Identifier: MIT
 */
#include <stdarg.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <punit.h>
#include "libdeflate.h"
#include "util/ctime.h"
#include "util/timestamp.h"

static void print_ready(
        char *restrict msg,
        struct timespec * restrict ts_start,
        struct timespec * restrict ts_end,
        const char *restrict format,
        ...)
{
    va_list args;
    struct timespec ts_diff;
    double t;
    const char *t_unit;

    va_start(args);

    timespec_sub(&ts_diff, ts_end, ts_start);
    t = timespec2ms(&ts_diff);

    if (t < 0.001) {
        t *= 1e6;
        t_unit = "ns";
    } else if (t < 1) {
        t *= 1e3;
        t_unit = "us";
    } else if (t < 1e3) {
        t_unit = "ms";
    } else if (t < 60e3) {
        t /= 1e3;
        t_unit = "s";
    } else if (t < 3.6e6) {
        t /= 60e3;
        t_unit = "min";
    } else {
        t /= 3.6e6;
        t_unit = "h";
    }

    fprintf(stderr, "%s ready in %.2f %s ", msg, t, t_unit);
    vfprintf(stderr, format, args);
    if (format[strlen(format) - 1] != '\n') {
        fprintf(stderr, "\n");
    }

    va_end(args);
}

static char *book;
static struct libdeflate_compressor *c;
static struct libdeflate_decompressor *d;

void setup(void)
{
    c = libdeflate_alloc_compressor(12);
    d = libdeflate_alloc_decompressor();
}

void teardown(void)
{
    libdeflate_free_compressor(c);
    libdeflate_free_decompressor(d);
}

__constructor void init(void)
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

PU_SKIP(test_deflate_perf)
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
    print_ready("libdeflate_compress", &start, &end, "cratio: %f", (double)len / (double)compressed_len);

    ts_monotime(&start);
    enum libdeflate_result res = libdeflate_decompress(d, compressed_buf, compressed_len, output_buf, len, &output_len);
    ts_monotime(&end);

    pu_assert_equal("", res, LIBDEFLATE_SUCCESS);
    pu_assert_equal("", output_len, len);
    print_ready("libdeflate_decompress", &start, &end, "");

    return NULL;
}

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
