/*
 * Copyright (c) 2024 SAULX
 *
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stdint.h>
#include <stddef.h>

struct libdeflate_block_def {
    size_t k_dict_size;
    size_t cur_block_size;
    size_t data_buf_size;
};

struct libdeflate_block_state {
    uint64_t out_cur;
    size_t data_cur;
};

LIBDEFLATEEXPORT size_t
libdeflate_block_state_limit_max_def_bsize(size_t max_block_size);

LIBDEFLATEEXPORT struct
libdeflate_block_def libdeflate_block_def_init(size_t max_block_size);

static inline struct libdeflate_block_state libdeflate_block_state_init(struct libdeflate_block_def def)
{
    return (struct libdeflate_block_state){
        .out_cur = 0,
        .data_cur = def.k_dict_size,
    };
}

LIBDEFLATEEXPORT uint8_t *
libdeflate_block_state_alloc_buf(struct libdeflate_block_def def);

static inline bool is_out_block_ready(struct libdeflate_block_def def, struct libdeflate_block_state state)
{
    return state.data_cur > def.cur_block_size + def.k_dict_size;
}

static inline size_t dict_size_avail(struct libdeflate_block_def def, uint64_t uncompressed_pos)
{
    return (uncompressed_pos < def.k_dict_size) ? (size_t)uncompressed_pos : def.k_dict_size;
}

static inline struct libdeflate_block_state libdeflate_block_state_next_state(struct libdeflate_block_def def, uint8_t *data_buf, struct libdeflate_block_state state)
{
    size_t dict_size;

    state.out_cur += state.data_cur - def.k_dict_size;
    dict_size = dict_size_avail(def, state.out_cur);
    memmove(data_buf + def.k_dict_size - dict_size, data_buf + state.data_cur - dict_size, dict_size); /* dict data for next block */
    state.data_cur = def.k_dict_size;

    return state;
}

static inline enum libdeflate_result libdeflate_decompress_block_wstate(
        struct libdeflate_decompressor *decompressor,
        struct libdeflate_block_def def,
        struct libdeflate_block_state state,
        const void *in_part, size_t in_part_nbytes_bound,
        uint8_t *data_buf,
        size_t *actual_in_nbytes_ret, size_t *actual_out_nbytes_ret,
        bool *is_final_block_ret)
{
    size_t dict_size = dict_size_avail(def, state.out_cur + (state.data_cur - def.k_dict_size));

    return libdeflate_decompress_block(decompressor, in_part, in_part_nbytes_bound,
            data_buf + state.data_cur - dict_size, dict_size, def.data_buf_size - state.data_cur,
            actual_in_nbytes_ret, actual_out_nbytes_ret,
            LIBDEFLATE_STOP_BY_ANY_BLOCK, is_final_block_ret);
}
LIBDEFLATEEXPORT uint8_t *
libdeflate_block_state_alloc_buf(struct libdeflate_block_def def);

LIBDEFLATEEXPORT void
libdeflate_block_state_free_buf(uint8_t *buf);
