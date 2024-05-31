/*
 * Base64url encoding/decoding (RFC4648)
 * Copyright (c) 2021-2024 SAULX
 * Copyright (c) 2005-2011, Jouni Malinen <j@w1.fi>
 * SPDX-License-Identifier: BSD-3-Clause
 */
#pragma once
#ifndef BASE64URL_H
#define BASE64URL_H

size_t base64url_encode_s(char *out, const char *str_in, size_t len, size_t line_max)
    __attribute__((access(write_only, 1), access(read_only, 2, 3)));

/**
 * base64url_encode - Base64url encode
 * Caller is responsible for freeing the returned buffer. Returned buffer is
 * nul terminated to make it easier to use as a C string. The nul terminator is
 * not included in out_len.
 * @parma str_in Data to be encoded
 * @param len Length of the data to be encoded
 * @param out_len Pointer to output length variable, or NULL if not used
 * @returns Allocated buffer of out_len bytes of encoded data,
 * or %NULL on failure
 */
[[nodiscard]]
char * base64url_encode(const char *str_in, size_t len, size_t *out_len)
    __attribute__((access(read_only, 1, 2), access(read_only, 3)));

/**
 * Base64url decode.
 * Caller is responsible for freeing the returned buffer.
 * @param str_in Data to be decoded
 * @param len Length of the data to be decoded
 * @param out_len Pointer to output length variable
 * @returns Allocated buffer of out_len bytes of decoded data, or NULL on failure
 */
[[nodiscard]]
char * base64url_decode(const char *str_in, size_t len, size_t *out_len)
    __attribute__((access(read_only, 1, 2), access(write_only, 3)));

/**
 * Calculate the required buffer size of a string of n bytes.
 * @param line_max is the max line length. 0 = no limit; 72 = typical.
 */
static inline size_t base64url_out_len(size_t n, size_t line_max) {
    size_t olen;

    /* This version would be with padding but we don't pad */
#if 0
    olen = n * 4 / 3 + 4; /* 3-byte blocks to 4-byte */
#endif
    olen = ((4 * n / 3) + 3) & ~3;
    olen += line_max > 0 ? olen / line_max : 0; /* line feeds */

    return olen;
}

#endif /* BASE64URL_H */
