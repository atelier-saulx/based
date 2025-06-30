/*
 * Copyright (c) 2024-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#define XXH_STATIC_LINKING_ONLY
#include "xxhash.h"
#include "selva/selva_hash128.h"

selva_hash_state_t *selva_hash_create_state(void)
{
    selva_hash_state_t *const state = selva_aligned_alloc(64, sizeof(XXH3_state_t));

    XXH3_INITSTATE(state);

    return state;
}

extern inline void selva_hash_free_state(selva_hash_state_t *state);
extern inline selva_hash128_t selva_hash_digest(selva_hash_state_t *hash_state);
