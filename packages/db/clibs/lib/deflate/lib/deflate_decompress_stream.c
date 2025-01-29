/*
 * Copyright (c) 2024-2025 SAULX
 * Copyright 2023 housisong
 *
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include "jemalloc_selva.h"
#include "lib_common.h"
#include "deflate_constants.h"
#include "libdeflate.h"

#define K_DICT_SIZE (1 << DEFLATE_WINDOW_ORDER)  /* MATCHFINDER_WINDOW_SIZE */
#define K_MAX_BLOCK_SIZE_MIN 4096
#define K_MAX_BLOCK_SIZE_MAX ((0xFFFFFFFF - K_DICT_SIZE) / 4) /* Not a real limit but somewhat sane. */

#define MAX_DEFLATE_BLOCK_SIZE 64 * 1024

static uint32_t next_pow2(uint32_t v)
{
    v--;
    v |= v >> 1;
    v |= v >> 2;
    v |= v >> 4;
    v |= v >> 8;
    v |= v >> 16;
    v++;

    return v;
}

static size_t limit_max_def_bsize(size_t max_block_size)
{
    max_block_size = next_pow2((uint32_t)max_block_size);

    if (max_block_size < K_MAX_BLOCK_SIZE_MIN) return K_MAX_BLOCK_SIZE_MIN;
    if (max_block_size > K_MAX_BLOCK_SIZE_MAX) return K_MAX_BLOCK_SIZE_MAX;
    return max_block_size;
}

static inline size_t new_data_buf_size(size_t cur_block_size)
{
    return 2 * cur_block_size + K_DICT_SIZE;
}

static inline uint8_t *alloc_buf(size_t data_buf_size)
{
    return selva_malloc(data_buf_size);
}

static inline void free_buf(uint8_t *buf)
{
    selva_free(buf);
}

LIBDEFLATEEXPORT struct libdeflate_block_state
libdeflate_block_state_init(size_t max_block_size)
{
    const size_t cur_block_size = limit_max_def_bsize(max_block_size);
    const size_t data_buf_size = new_data_buf_size(cur_block_size);

    return (struct libdeflate_block_state){
        .cur_block_size = cur_block_size,
        .data_cur = K_DICT_SIZE,
        .out_cur = 0,
        .data_buf_size = data_buf_size,
        .data_buf = alloc_buf(data_buf_size),
    };
}

static void
libdeflate_block_state_reset(struct libdeflate_block_state *state)
{
    state->data_cur = K_DICT_SIZE;
    state->out_cur = 0;
}

LIBDEFLATEEXPORT void
libdeflate_block_state_deinit(struct libdeflate_block_state *state)
{
    free_buf(state->data_buf);
    state->data_buf = NULL;
}

LIBDEFLATEEXPORT bool
libdeflate_block_state_growbuf(struct libdeflate_block_state *state)
{
    size_t new_block_size = 2 * state->cur_block_size;

    if (new_block_size > K_MAX_BLOCK_SIZE_MAX) {
        return false;
    }

    state->cur_block_size = new_block_size;
    state->data_buf_size = new_data_buf_size(new_block_size);
    state->data_buf = selva_realloc(state->data_buf, state->data_buf_size);
    return true;
}

static inline bool libdeflate_block_state_is_out_block_ready(struct libdeflate_block_state *state)
{
    return state->data_cur > state->cur_block_size + K_DICT_SIZE;
}

static inline size_t dict_size_avail(size_t uncompressed_pos)
{
    return (uncompressed_pos < K_DICT_SIZE) ? uncompressed_pos : K_DICT_SIZE;
}

/**
 * Get the next state after libdeflate_block_state_is_out_block_ready().
 */
static inline void libdeflate_block_state_next(struct libdeflate_block_state *state)
{
    size_t dict_size;

    state->out_cur += state->data_cur - K_DICT_SIZE;
    dict_size = dict_size_avail(state->out_cur);
    memmove(state->data_buf + K_DICT_SIZE - dict_size, state->data_buf + state->data_cur - dict_size, dict_size); /* dict data for next block */
    state->data_cur = K_DICT_SIZE;
}

LIBDEFLATEEXPORT enum libdeflate_result
libdeflate_decompress_stream(
        struct libdeflate_decompressor *decompressor,
        struct libdeflate_block_state *state,
        const char *in_buf, size_t in_len,
        libdeflate_decompress_stream_cb_t cb, void *ctx,
        int *result)
{
    const char *in_cur = in_buf;
    size_t in_left = in_len;
    enum libdeflate_result dres;

    libdeflate_block_state_reset(state);
    libdeflate_decompress_block_reset(decompressor);
    do {
        size_t actual_in_nbytes_ret;
        size_t actual_out_nbytes_ret;
        size_t dict_size = dict_size_avail(state->out_cur + (state->data_cur - K_DICT_SIZE));

        dres = libdeflate_decompress_block(decompressor, in_cur, in_left,
                state->data_buf + state->data_cur - dict_size, dict_size, state->data_buf_size - state->data_cur,
                &actual_in_nbytes_ret, &actual_out_nbytes_ret,
                LIBDEFLATE_STOP_BY_ANY_BLOCK);
        if (dres != LIBDEFLATE_MORE && dres != LIBDEFLATE_SUCCESS) {
            return dres;
        }

		in_cur += actual_in_nbytes_ret;
        in_left -= actual_in_nbytes_ret;
		state->data_cur += actual_out_nbytes_ret;

		if (dres == LIBDEFLATE_SUCCESS || libdeflate_block_state_is_out_block_ready(state)) {
            int res;

            res = cb(ctx, state->data_buf + K_DICT_SIZE - dict_size, dict_size, state->data_cur - K_DICT_SIZE);
            if (res) {
                *result = res;
                break;
            }

            libdeflate_block_state_next(state);
		}
	} while (dres == LIBDEFLATE_MORE);

    return dres;
}
