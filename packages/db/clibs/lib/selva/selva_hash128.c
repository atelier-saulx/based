/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include "selva/selva_hash128.h"

selva_hash128_t selva_hash_digest_zig(selva_hash_state_t *hash_state)
{
    return selva_hash_digest(hash_state);
}
