/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */

#include <stdint.h>
#include <sys/types.h>
#include <stdlib.h>
#include "selva/strsearch.h"

uint64_t seed = 100;

static inline uint64_t next(void)
{
    return (seed = 214013 * seed + 2531011);
}

int LLVMFuzzerTestOneInput(const uint8_t *Data, size_t Size)
{
    const char *mbs = (const char *)Data;
    size_t mbs_len = Size;
    const char *t = (const char *)Data;
    size_t t_len = mbs_len - mbs_len ? (next() % mbs_len) : 0;

    (void)strsearch_hamming_mbs(mbs, mbs_len, t, t_len);

    return 0;
}
