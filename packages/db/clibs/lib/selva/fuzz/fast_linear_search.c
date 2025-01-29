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

int LLVMFuzzerTestOneInput(const uint8_t *Data, size_t Size)
{
    if (Size % sizeof(uint32_t) != 0) {
        return 0;
    }

    const uint32_t *arr = Data;
    size_t len = Size / sizeof(uint32_t);
    uint32_t x = len == 0 ? 0 : next() % len;

    (void)fast_linear_search_uint32(arr, len, x);

    return 0;
}
