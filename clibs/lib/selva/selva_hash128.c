/*
 * Copyright (c) 2024-2026 SAULX
 * SPDX-License-Identifier: MIT
 */
#define XXH_STATIC_LINKING_ONLY
#include "xxhash.h"
#include <stddef.h>
#include <stdint.h>
#include "selva/selva_hash128.h"

selva_hash_state_t *selva_hash_create_state(void)
{
    selva_hash_state_t *const state = selva_aligned_alloc(64, sizeof(XXH3_state_t));

    XXH3_INITSTATE(state);

    return state;
}

extern inline void selva_hash_free_state(selva_hash_state_t *state);
extern inline selva_hash128_t selva_hash_digest(selva_hash_state_t *hash_state);

char *selva_hash_to_hex(char s[SELVA_HASH_HEX_LEN], selva_hash128_t hash)
{
    static constexpr char map[] = "0123456789abcdef";
    const uint8_t *h = (const uint8_t *)&hash;
    char *p = s;

    for (size_t i = 0; i < sizeof(selva_hash128_t); i++) {
        *p++ = map[(h[i] >> 4) % sizeof(map)];
        *p++ = map[(h[i] & 0x0f) % sizeof(map)];
    }

    return s;
}
