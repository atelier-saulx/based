/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#include "selva/_export.h"
#include <stdint.h>

/***
 * Get the length of multibyte char.
 */
SELVA_EXPORT
#if defined(__clang__)
/*
 * optnone is needed at least on clang to not optimize out the clz.
 * Otherwise this function will always return 0.
 */
__attribute__((optnone))
#endif
inline unsigned selva_mblen(char first_byte)
#ifndef __zig
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
#else
;
#endif /* __zig */
