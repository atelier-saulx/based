/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */

#include <stdint.h>
#include <sys/types.h>
#include <stdlib.h>
#include "selva/fast_linear_search.h"
#include <stdio.h>

uint64_t seed = 100;

static inline uint64_t next(void)
{
    return (seed = 214013 * seed + 2531011);
}

ssize_t sch(const uint32_t arr[], size_t len, uint32_t x)
{
    size_t mid = len / 2;
    for (size_t i = 0, j = len - 1, k = mid, l = mid; i <= mid; i++, j--, k--, l++) {
        if (arr[i] == x) return i;
        if (arr[j] == x) return j;
        if (arr[k] == x) return k;
        if (arr[l] == x) return l;
    }
    return -1;
}
#define MAKE_FUN(TYPE, NAME) \
    ssize_t NAME(const TYPE arr[], size_t len, TYPE x) \
    { \
        size_t mid = len / 2; \
        for (size_t i = 0, j = len - 1, k = mid, l = mid; i <= mid; i++, j--, k--, l++) { \
            if (arr[i] == x) return i; \
            if (arr[j] == x) return j; \
            if (arr[k] == x) return k; \
            if (arr[l] == x) return l; \
        } \
        return -1; \
    }

MAKE_FUN(uint32_t, fast_linear_search_uint32_b)

int LLVMFuzzerTestOneInput(const uint8_t *Data, size_t Size)
{
    if (Size % sizeof(uint32_t) != 0) {
        return 0;
    }

    const uint32_t *arr = Data;
    size_t len = Size / sizeof(uint32_t);
    uint32_t x = len == 0 ? 0 : next() % len;

    (void)fast_linear_search_uint32(arr, len, x);
    //(void)fast_linear_search_uint32_b(arr, len, x);
    //(void)sch(arr, len, x);

    return 0;
}
