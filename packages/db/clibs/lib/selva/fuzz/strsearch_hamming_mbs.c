/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */

#include <stdint.h>
#include <sys/types.h>
#include <stdlib.h>
#include "selva/strsearch.h"

uint64_t seed = 100;

int LLVMFuzzerTestOneInput(const uint8_t *Data, size_t Size)
{
    seed = 214013 * seed + 2531011;

    const char *mbs = (const char *)Data;
    size_t mbs_len = Size;
    const char *t = (const char *)Data + Size / 2;
    size_t t_len = seed % 16;

    if (Size / 2 + t_len > Size) {
        return 0;
    }

    (void)strsearch_hamming_mbs(mbs, mbs_len, t, t_len);

    return 0;
}
