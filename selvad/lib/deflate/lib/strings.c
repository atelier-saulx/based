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
#include "libdeflate_block_state.h"
#include "libdeflate_strings.h"

#define MAX_DEFLATE_BLOCK_SIZE 64 * 1024

static int do_deflate(
        struct libdeflate_decompressor *decompressor,
        const char *in_buf, size_t in_len,
        int (*cb)(void * restrict ctx, uint8_t * restrict buf, size_t len), void *ctx)
{
    struct libdeflate_block_state state = libdeflate_block_state_init(MAX_DEFLATE_BLOCK_SIZE);
	size_t in_cur = 0;
	size_t actual_in_nbytes_ret;
    bool final_block = false;
	int ret;
    int result = 0;

retry:
    libdeflate_decompress_block_reset(decompressor);
	do {
		size_t actual_out_nbytes_ret;

        ret = libdeflate_decompress_block_wstate(
                decompressor, &state,
                in_buf + in_cur, in_len - in_cur,
                &actual_in_nbytes_ret, &actual_out_nbytes_ret, &final_block);
        if (ret != LIBDEFLATE_SUCCESS) {
            if (ret == LIBDEFLATE_INSUFFICIENT_SPACE &&
                libdeflate_block_state_growbuf(&state)) {
                in_cur = 0;
                goto retry;
            }
            result = -1; /* TODO What would be the correct ret value? */
            break;
        }

		in_cur += actual_in_nbytes_ret;
		state.data_cur += actual_out_nbytes_ret;

		if (final_block || libdeflate_block_state_is_out_block_ready(&state)) {
            result = cb(ctx, state.data_buf + state.k_dict_size, state.data_cur - state.k_dict_size);
            if (result) {
                break;
            }

            libdeflate_block_state_next(&state);
		}
	} while (!final_block);

    libdeflate_block_state_deinit(&state);

    return result;
}

struct memcmp_ctx {
    const void *ptr2_buf;
    size_t ptr2_len;
    size_t ptr2_i;
};

static int cb_memcmp(void * restrict ctx, uint8_t * restrict buf, size_t len)
{
    struct memcmp_ctx *c = (struct memcmp_ctx *)ctx;
    size_t test_len = MIN(len, c->ptr2_len - c->ptr2_i);
    int res;

    res = memcmp(buf, (uint8_t *)c->ptr2_buf + c->ptr2_i, test_len);
    if (res) {
        return res;
    } else if (c->ptr2_i + len > c->ptr2_len) {
        return buf[len - 1] - '\0';
    } else {
        c->ptr2_i += test_len;
        return 0;
    }
}

/*
 * First string deflated and second not
 * TODO Support shared data_buf as an arg
 */
LIBDEFLATEEXPORT int
libdeflate_memcmp(struct libdeflate_decompressor *decompressor, const char *in_buf, size_t in_len, const void *ptr2_buf, size_t ptr2_len)
{
    struct memcmp_ctx ctx = {
        .ptr2_buf = ptr2_buf,
        .ptr2_len = ptr2_len,
        .ptr2_i = 0,
    };

    return do_deflate(decompressor, in_buf, in_len, cb_memcmp, &ctx);
}

struct includes_ctx {
    const char *s;
    size_t len;
    size_t match_len;
};

static int cb_includes(void * restrict ctx, uint8_t * restrict buf, size_t len)
{
    struct includes_ctx *c = (struct includes_ctx *)ctx;

    for (size_t i = 0; i < len; i++) {
        if (buf[i] == c->s[c->match_len]) {
            if (++c->match_len == len) {
                return 1;
            }
        } else {
            c->match_len = 0;
        }
    }

    return 0;
}

LIBDEFLATEEXPORT int
libdeflate_includes(struct libdeflate_decompressor *decompressor, const char *in_buf, size_t in_len, const void *needle_buf, size_t needle_len)
{
    if (in_len == 0 || needle_len == 0) {
        return 0;
    }

    struct includes_ctx ctx = {
        .s = needle_buf,
        .len = needle_len,
        .match_len = 0,
    };

    return do_deflate(decompressor, in_buf, in_len, cb_includes, &ctx);
}

#if 0
/* Both deflated */
LIBDEFLATEEXPORT int
libdeflate_dmemcmp(struct libdeflate_decompressor *decompressor, const char *in1_buf, size_t in1_len, const void *in2_buf, size_t in2_len)
{
    /* TODO */
}
#endif
