/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#define _GNU_SOURCE
#include <string.h>
#include "selva/fast_memcmp.h"

bool fast_memcmp(const void *restrict a, const void *restrict b, size_t len)
{
    return !memcmp(a, b, len);
}
