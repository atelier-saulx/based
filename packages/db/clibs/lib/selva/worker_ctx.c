/*
 * Copyright (c) 2024-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stdint.h>
#include <pthread.h>
#include "selva/selva_string.h"
#include "libdeflate.h"
#include "selva/worker_ctx.h"

static __thread bool worker_initialized;
static __thread struct libdeflate_decompressor *libdeflate_decompressor;
static __thread struct libdeflate_block_state libdeflate_block_state;

__constructor void worker_ctx_init(void)
{
#if 0
    pthread_t x = pthread_self();
#endif

    selva_string_init_tls();
    libdeflate_decompressor = libdeflate_alloc_decompressor();
    libdeflate_block_state = libdeflate_block_state_init(305000);
    worker_initialized = true;
}

__destructor void worker_ctx_deinit(void)
{
    if (worker_initialized) {
        selva_string_deinit_tls();
        libdeflate_block_state_deinit(&libdeflate_block_state);
        libdeflate_free_decompressor(libdeflate_decompressor);
        libdeflate_decompressor = nullptr;
        worker_initialized = false;
    }
}

enum libdeflate_result worker_ctx_libdeflate_decompress(
			      const void *in, size_t in_nbytes,
			      void *out, size_t out_nbytes_avail,
			      size_t *actual_out_nbytes_ret)
{
    return libdeflate_decompress(libdeflate_decompressor, in, in_nbytes, out, out_nbytes_avail, actual_out_nbytes_ret);
}

enum libdeflate_result worker_ctx_libdeflate_decompress_stream(
        const char *in_buf, size_t in_len,
        libdeflate_decompress_stream_cb_t cb, void *ctx,
        int *result)
{
    return libdeflate_decompress_stream(libdeflate_decompressor, &libdeflate_block_state, in_buf, in_len, cb, ctx, result);
}
