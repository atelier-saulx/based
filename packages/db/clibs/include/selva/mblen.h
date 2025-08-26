/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#include <stdint.h>

static inline unsigned selva_mblen(char first_byte)
{
    uint8_t x = first_byte;
    unsigned l = 0;

    if (x & 0x80) {
#if __has_builtin(__builtin_clzg)
        l = __builtin_clzg((uint8_t)~x, 0) - 1;
#elif __has_builtin(__builtin_clz)
        l = __builtin_clz((unsigned)(~x << 24)) - 1;
#else
#error "No luck"
#endif
    }

    return l;
}
