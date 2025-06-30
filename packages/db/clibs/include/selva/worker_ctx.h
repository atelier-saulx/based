/*
 * Copyright (c) 2024-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "selva/_export.h"
#include "libdeflate.h"

SELVA_EXPORT
void worker_ctx_init(void);

SELVA_EXPORT
void worker_ctx_deinit(void);

SELVA_EXPORT
enum libdeflate_result worker_ctx_libdeflate_decompress(
			      const void *in, size_t in_nbytes,
			      void *out, size_t out_nbytes_avail,
			      size_t *actual_out_nbytes_ret);

SELVA_EXPORT
enum libdeflate_result worker_ctx_libdeflate_decompress_stream(
        const char *in_buf, size_t in_len,
        libdeflate_decompress_stream_cb_t cb, void *ctx,
        int *result);

SELVA_EXPORT
bool worker_ctx_libdeflate_block_state_growbuf(void);
