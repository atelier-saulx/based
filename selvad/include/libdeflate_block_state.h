/*
 * Copyright (c) 2024 SAULX
 *
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stdint.h>
#include <stddef.h>

struct libdeflate_block_state {
    size_t k_dict_size;
    size_t cur_block_size;
    size_t data_cur;
    uint64_t out_cur;
    size_t data_buf_size;
    uint8_t *data_buf;
};

LIBDEFLATEEXPORT struct libdeflate_block_state
libdeflate_block_state_init(size_t max_block_size);

LIBDEFLATEEXPORT void
libdeflate_block_state_deinit(struct libdeflate_block_state *state);

LIBDEFLATEEXPORT bool
libdeflate_block_state_growbuf(struct libdeflate_block_state *state);

static inline bool libdeflate_block_state_is_out_block_ready(struct libdeflate_block_state *state)
{
    return state->data_cur > state->cur_block_size + state->k_dict_size;
}

static inline size_t dict_size_avail(size_t k_dict_size, uint64_t uncompressed_pos)
{
    return (uncompressed_pos < k_dict_size) ? (size_t)uncompressed_pos : k_dict_size;
}

/**
 * Get the next state after libdeflate_block_state_is_out_block_ready().
 */
static inline void libdeflate_block_state_next(struct libdeflate_block_state *state)
{
    size_t dict_size;

    state->out_cur += state->data_cur - state->k_dict_size;
    dict_size = dict_size_avail(state->k_dict_size, state->out_cur);
    __builtin_memmove(state->data_buf + state->k_dict_size - dict_size, state->data_buf + state->data_cur - dict_size, dict_size); /* dict data for next block */
    state->data_cur = state->k_dict_size;
}

static inline enum libdeflate_result libdeflate_decompress_block_wstate(
        struct libdeflate_decompressor *decompressor,
        struct libdeflate_block_state *state,
        const void *in_part, size_t in_part_nbytes_bound,
        size_t *actual_in_nbytes_ret, size_t *actual_out_nbytes_ret,
        bool *is_final_block_ret)
{
    size_t dict_size = dict_size_avail(state->k_dict_size, state->out_cur + (state->data_cur - state->k_dict_size));

    return libdeflate_decompress_block(decompressor, in_part, in_part_nbytes_bound,
            state->data_buf + state->data_cur - dict_size, dict_size, state->data_buf_size - state->data_cur,
            actual_in_nbytes_ret, actual_out_nbytes_ret,
            LIBDEFLATE_STOP_BY_ANY_BLOCK, is_final_block_ret);
}
