/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stddef.h>
#include <stdint.h>

#ifndef LIBDEFLATEEXPORT
#ifdef BUILDING_LIBDEFLATE
#define LIBDEFLATEEXPORT __attribute__((visibility("default")))
#else
#define LIBDEFLATEEXPORT
#endif
#endif

struct libdeflate_block_state;
struct libdeflate_decompressor;

/**
 * Test if the compressed string in_buf is equivalent to the buffer poited by ptr2_buf.
 * First string deflated and second not
 * @return Same as memcmp().
  */
LIBDEFLATEEXPORT int
libdeflate_memcmp(struct libdeflate_decompressor *decompressor, struct libdeflate_block_state *state, const char *in_buf, size_t in_len, const void *ptr2_buf, size_t ptr2_len);

/**
 * Test if the compressed string in_buf includes the string needle_buf.
 * First string deflated and second not
 * @return Same as memmem().
  */
LIBDEFLATEEXPORT int64_t
libdeflate_memmem(struct libdeflate_decompressor *decompressor, struct libdeflate_block_state *state, const char *in_buf, size_t in_len, const void *needle_buf, size_t needle_len);
