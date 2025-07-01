/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#define _GNU_SOURCE
#include <string.h>
#include <stdint.h>
#include "selva/fast_memcmp.h"

/*
 * Generic version of fast_memcmp().
 */
bool fast_memcmp(const void *restrict a, const void *restrict b, size_t len)
{
    /*
     * Clang should vectorize this well.
     */
#if defined(__clang__)
    const char *x = (const char *)a;
    const char *y = (const char *)b;
    bool res = false;

    if (x[0] != y[0]) {
        return false;
    }

    for (size_t i = 0; i < len; i++) {
        res |= x[i] != y[i];
    }

    return !res;
#else
    return !memcmp(a, b, len);
#endif
}
