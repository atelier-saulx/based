/*
 * Copyright (c) 2024 SAULX
 *
 * SPDX-License-Identifier: MIT
 */
#include "lib_common.h"
#include "deflate_constants.h"
#include "libdeflate.h"
#include "libdeflate_block_state.h"

#define K_DICT_SIZE (1 << DEFLATE_WINDOW_ORDER)  /* MATCHFINDER_WINDOW_SIZE */

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
    const size_t kMaxDeflateBlockSize_min = 4 * 1024;
    const size_t kMaxDeflateBlockSize_max = ((~(size_t)0) - K_DICT_SIZE) / 4;

    max_block_size = next_pow2((uint32_t)max_block_size);

    if (max_block_size < kMaxDeflateBlockSize_min) return kMaxDeflateBlockSize_min;
    if (max_block_size > kMaxDeflateBlockSize_max) return kMaxDeflateBlockSize_max;
    return max_block_size;
}

LIBDEFLATEEXPORT struct libdeflate_block_def
libdeflate_block_def_init(size_t max_block_size)
{
    const size_t cur_block_size = limit_max_def_bsize(max_block_size);
    const size_t data_buf_size = 2 * cur_block_size + K_DICT_SIZE;

    return (struct libdeflate_block_def){
        .k_dict_size = K_DICT_SIZE,
        .cur_block_size = cur_block_size,
        .data_buf_size = data_buf_size,
    };
}

LIBDEFLATEEXPORT uint8_t *
libdeflate_block_state_alloc_buf(struct libdeflate_block_def def)
{
    /* TODO Is this needed? */
    size_t code_buf_size = 2 * def.cur_block_size;

    return libdeflate_malloc(def.data_buf_size + code_buf_size);
}

LIBDEFLATEEXPORT void
libdeflate_block_state_free_buf(uint8_t *buf)
{
    libdeflate_free(buf);
}
