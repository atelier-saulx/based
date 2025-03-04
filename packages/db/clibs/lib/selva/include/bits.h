/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stdint.h>

/**
 * The following macros will look like they do a lot of mangling in runtime but
 * any -O level should actually optimize the results to be comptime constants.
 */

#define findnz(arr) ({uint64_t i = 0; while(i < sizeof(arr) && arr[i] == 0) ++i; i; })
#define findbit(arr, fn) ({int i = findnz(arr); (uint64_t)(i * 8 * sizeof(arr[0]) + fn(arr[i])); })

#define __bitoffsetof(t, f, l) ({ \
    typedef unsigned long long __pad; \
    union { __pad raw##l [(sizeof(t) + sizeof(__pad) - 1)/sizeof(__pad)]; t typ; } a = {}; \
    ++a.typ.f; findbit(a.raw##l, __builtin_ctzll); \
})
#define _bitoffsetof(t, f, l) __bitoffsetof(t, f, l)

/**
 * Offset of a field in a struct in bits.
 */
#define bitoffsetof(t, f) _bitoffsetof(t, f, __LINE__)

#define __bitsizeof(t, f, l) ({ \
    typedef unsigned long long __pad; \
    union { __pad raw##l[(sizeof(t)+sizeof(__pad)-1)/sizeof(__pad)]; t typ; } a = {}; \
    --a.typ.f; (findbit(a.raw##l, 64-__builtin_clzll))-findbit(a.raw##l, __builtin_ctzll); \
 })
#define _bitsizeof(t, f, l) __bitsizeof(t, f, l)

/**
 * Size of a bitfield in struct in bits.
 */
#define bitsizeof(t, f) _bitsizeof(t, f, __LINE__)
