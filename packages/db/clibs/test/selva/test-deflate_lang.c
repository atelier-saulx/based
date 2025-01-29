/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "libdeflate.h"
#include "selva/selva_lang.h"

static struct libdeflate_compressor *c;
static struct libdeflate_decompressor *d;
static locale_t loc;

#include "../deflate/book.h"

void setup(void)
{
    c = libdeflate_alloc_compressor(9);
    d = libdeflate_alloc_decompressor();

#if __linux__
    /*
     * This might not be the name of the locale in your system tho.
     * Indeed, the selva locale would be en_US.UTF-8 but it's really hard to
     * read it here.
     */
    setlocale(LC_CTYPE, "en_US.utf8");
    setlocale(LC_CTYPE, "en_US.UTF-8");
#endif
}

void teardown(void)
{
    libdeflate_free_compressor(c);
    libdeflate_free_decompressor(d);

    if (loc) {
        freelocale(loc);
    }
    /* Haha, not gonna reset the locale for you. */
}

struct full_decompress_ctx {
    char *out_buf;
    size_t out_i;
    size_t out_len;
};

static int full_decompress_cb(void *ctx, uint8_t *buf, size_t len, uint8_t *, size_t)
{
    struct full_decompress_ctx *c = (struct full_decompress_ctx *)ctx;

    if (c->out_i + len > c->out_len) {
        return -1;
    }

    memmove(c->out_buf + c->out_i, buf, len);
    c->out_i += len;

    return 0;
}

/*
 * FIXME The API has changed
 */
#if 0
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

    return nullptr;
}
#endif

PU_TEST(test_deflate_mbscmp)
{
    wctrans_t trans;
    struct libdeflate_block_state state = libdeflate_block_state_init(1024);
    char compressed[libdeflate_compress_bound(sizeof(book))];
    size_t compressed_len;

    trans = wctrans_l("tolower", loc);
    compressed_len = libdeflate_compress(c, book, sizeof(book), compressed, libdeflate_compress_bound(sizeof(book)));
    pu_assert("", compressed_len != 0);

    bool res = selva_deflate_mbscmp(d, &state, compressed, compressed_len, book, sizeof(book) - 1, trans, loc);
    pu_assert_equal("Match found", res, true);

    libdeflate_block_state_deinit(&state);

    return nullptr;
}

PU_TEST(test_deflate_mbscmp_fail)
{
    wctrans_t trans;
    struct libdeflate_block_state state = libdeflate_block_state_init(1024);
    char compressed[libdeflate_compress_bound(sizeof(book))];
    size_t compressed_len;
    const char find[] = "EVERYTHING MATERIAL SOON DISAPPEARS IN THE SUBSTANCE OF THE WHOLE";

    trans = wctrans_l("tolower", loc);
    compressed_len = libdeflate_compress(c, book, sizeof(book), compressed, libdeflate_compress_bound(sizeof(book)));
    pu_assert("", compressed_len != 0);

    bool res = selva_deflate_mbscmp(d, &state, compressed, compressed_len, find, sizeof(find) - 1, trans, loc);
    pu_assert_equal("Match found", res, true);

    libdeflate_block_state_deinit(&state);

    return nullptr;
}

PU_TEST(test_deflate_mbsstrstr)
{
    wctrans_t trans;
    struct libdeflate_block_state state = libdeflate_block_state_init(1024);
    char compressed[libdeflate_compress_bound(sizeof(book))];
    size_t compressed_len;
    const char find[] = "Everything material soon DISAPPEARS in the substance of the whole";

    trans = wctrans_l("tolower", loc);
    compressed_len = libdeflate_compress(c, book, sizeof(book), compressed, libdeflate_compress_bound(sizeof(book)));
    pu_assert("", compressed_len != 0);

    bool res = selva_deflate_mbsstrstr(d, &state, compressed, compressed_len, find, sizeof(find) - 1, trans, loc);
    pu_assert_equal("Match found", res, true);

    libdeflate_block_state_deinit(&state);

    return nullptr;
}

PU_TEST(test_deflate_mbsstrstr_hard)
{
    wctrans_t trans;
    struct libdeflate_block_state state = libdeflate_block_state_init(1024);
    const char text[] = "The word “aaaloha” is a Hawaiian term that holds deep cultural and spiritual significance. It is commonly used as a greeting or farewell, but its meaning extends far beyond that. “Aloha” embodies love, affection, peace, compassion, and mercy. It is a way of life and a guiding principle for the people of Hawaii, emphasizing kindness, unity, humility, and patience. \n\
        Interestingly, the word “hahaloha” is derived from two Hawaiian words: “alo,” meaning presence or face, and “ha,” meaning breath. Together, they convey the idea of sharing the breath of life.";
    char compressed[libdeflate_compress_bound(sizeof(text))];
    size_t compressed_len;
    const char find[] = "aaloha";

    trans = wctrans_l("tolower", loc);
    compressed_len = libdeflate_compress(c, text, sizeof(text), compressed, libdeflate_compress_bound(sizeof(text)));
    pu_assert("", compressed_len != 0);

    bool res = selva_deflate_mbsstrstr(d, &state, compressed, compressed_len, find, sizeof(find) - 1, trans, loc);
    pu_assert_equal("Match found", res, true);

    libdeflate_block_state_deinit(&state);

    return nullptr;
}
