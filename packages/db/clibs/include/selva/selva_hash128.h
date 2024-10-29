/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#include "xxhash.h"
#include "selva/types.h"

typedef struct XXH3_state_s selva_hash_state_t;

#define selva_hash_create_state XXH3_createState
#define selva_hash_reset XXH3_128bits_reset
#define selva_hash_free_state XXH3_freeState
#define selva_hash_update XXH3_128bits_update

SELVA_EXPORT
selva_hash128_t selva_hash_digest_zig(selva_hash_state_t *hash_state);

#ifdef __zig
#define selva_hash_digest selva_hash_digest_zig
#else
static inline selva_hash128_t selva_hash_digest(selva_hash_state_t *hash_state)
{
    XXH128_hash_t res;

retry:
    res = XXH3_128bits_digest(hash_state);
    if (res.low64 == 0 && res.high64 == 0) {
        /*
         * We don't allow zero hash.
         * RFE Is this a good approach?
         */
        XXH3_128bits_update(hash_state, &(int64_t){ 1 }, sizeof(int64_t));
        goto retry;
    }

    return (selva_hash128_t)res.low64 | (selva_hash128_t)res.high64 << 64;
}
#endif
