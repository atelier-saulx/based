/*
 * Copyright (c) 2024-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#include "xxhash.h"
#ifndef __zig
#include "jemalloc_selva.h"
#endif
#include "selva/types.h"

typedef struct XXH3_state_s selva_hash_state_t;
#define SELVA_HASH_HEX_LEN (2 * sizeof(selva_hash128_t))

#define selva_hash_reset XXH3_128bits_reset
#define selva_hash_update XXH3_128bits_update

SELVA_EXPORT
selva_hash_state_t *selva_hash_create_state(void);

SELVA_EXPORT
inline void selva_hash_free_state(selva_hash_state_t *state)
#ifndef __zig
{
    selva_free(state);
}
#else
;
#endif

SELVA_EXPORT
inline selva_hash128_t selva_hash_digest(selva_hash_state_t *hash_state)
#ifndef __zig
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
#else
;
#endif

char *selva_hash_to_hex(char s[SELVA_HASH_HEX_LEN], selva_hash128_t hash);
