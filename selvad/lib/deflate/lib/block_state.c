/*
 * Copyright (c) 2024 SAULX
 * Copyright 2023 housisong
 *
 * SPDX-License-Identifier: MIT
 */
#include <stdio.h> /* FIXME REMOVE */
#include "lib_common.h"
#include "deflate_constants.h"
#include "libdeflate.h"
#include "libdeflate_block_state.h"

#define K_DICT_SIZE (1 << DEFLATE_WINDOW_ORDER)  /* MATCHFINDER_WINDOW_SIZE */
#define K_MAX_BLOCK_SIZE_MIN 4096
#define K_MAX_BLOCK_SIZE_MAX ((0xFFFFFFFF - K_DICT_SIZE) / 4) /* Not a real limit but somewhat sane. */

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
    /* TODO Is this needed? */
#if 0
    size_t code_buf_size = 2 * def.cur_block_size;

    return libdeflate_malloc(data_buf_size + code_buf_size);
#endif
    return libdeflate_malloc(data_buf_size);
}

static inline void free_buf(uint8_t *buf)
{
    libdeflate_free(buf);
}

LIBDEFLATEEXPORT struct libdeflate_block_state
libdeflate_block_state_init(size_t max_block_size)
{
    const size_t cur_block_size = limit_max_def_bsize(max_block_size);
    const size_t data_buf_size = new_data_buf_size(cur_block_size);

    return (struct libdeflate_block_state){
        .k_dict_size = K_DICT_SIZE,
        .cur_block_size = cur_block_size,
        .data_cur = K_DICT_SIZE,
        .out_cur = 0,
        .data_buf_size = data_buf_size,
        .data_buf = alloc_buf(data_buf_size),
    };
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

    libdeflate_free(state->data_buf);

    state->cur_block_size = new_block_size;
    state->data_cur = K_DICT_SIZE;
    state->out_cur = 0;
    state->data_buf_size = new_data_buf_size(new_block_size);
    state->data_buf = libdeflate_malloc(state->data_buf_size);
    return true;
}
