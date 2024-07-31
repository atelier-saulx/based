/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef _SELVA_ENDIAN_H_
#define _SELVA_ENDIAN_H_

#include <stddef.h>
#include <stdint.h>

/*
 * NOTICE
 * This header conflicts with `endian.h` on Linux/glibc and gets included at
 * least by `sys/types.h`. This is not a big problem because we implement the
 * same functionality + some extras.
 * The original header could be included with `#include_next`. Isn't it pretty
 * stupid that we can override system headers included by system headers in
 * this way?
 */

_Static_assert(sizeof(double) == 8, "Only 64bit doubles are supported");

#if __BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__

#ifndef htobe16
#define htobe16(x) __builtin_bswap16(x)
#define htole16(x) (x)
#define be16toh(x) __builtin_bswap16(x)
#define le16toh(x) (x)
#endif

#ifndef htobe32
#define htobe32(x) __builtin_bswap32(x)
#define htole32(x) (x)
#define be32toh(x) __builtin_bswap32(x)
#define le32toh(x) (x)
#endif

#ifndef htobe64
#define htobe64(x) __builtin_bswap64(x)
#define htole64(x) (x)
#define be64toh(x) __builtin_bswap64(x)
#define le64toh(x) (x)
#endif

static inline void htoledouble(char buf[8], double x) {
#if __FLOAT_WORD_ORDER__ == __ORDER_BIG_ENDIAN__
    /*
     * x: 4 5 6 7  0 1 2 3
     *    0 1 2 3  4 5 6 7
     */
    char s[8];

    __builtin_memcpy(s, &x, 8);
    buf[0] = s[4];
    buf[1] = s[5];
    buf[2] = s[6];
    buf[3] = s[7];
    buf[4] = s[0];
    buf[5] = s[1];
    buf[6] = s[2];
    buf[7] = s[3];
#else
    __builtin_memcpy(buf, &x, 8);
#endif
}

static inline double ledoubletoh(const char buf[8]) {
#if __FLOAT_WORD_ORDER__ == __ORDER_BIG_ENDIAN__
    char s[8];
    double x;

    s[0] = buf[4];
    s[1] = buf[5];
    s[2] = buf[6];
    s[3] = buf[7];
    s[4] = buf[0];
    s[5] = buf[1];
    s[6] = buf[2];
    s[7] = buf[3];

    __builtin_memcpy(&x, s, sizeof(double));
    return x;
#else
    double x;

    __builtin_memcpy(&x, buf, sizeof(double));

    return x;
#endif
}

#elif __BYTE_ORDER__ == __ORDER_BIG_ENDIAN__

#ifndef htobe16
#define htobe16(x) (x)
#define htole16(x) __builtin_bswap16(x)
#define be16toh(x) (x)
#define le16toh(x) __builtin_bswap16(x)
#endif

#ifndef htobe32
#define htobe32(x) (x)
#define htole32(x) __builtin_bswap32(x)
#define be32toh(x) (x)
#define le32toh(x) __builtin_bswap32(x)
#endif

#ifndef htobe64
#define htobe64(x) (x)
#define htole64(x) __builtin_bswap64(x)
#define be64toh(x) (x)
#define le64toh(x) __builtin_bswap64(x)
#endif

static inline void htoledouble(char buf[8], double x) {
#if __FLOAT_WORD_ORDER__ == __ORDER_LITTLE_ENDIAN__
    /*
     * x: 3 2 1 0  7 6 5 4
     * s: 0 1 2 3  4 5 6 7
     */
    char s[8];

    __builtin_memcpy(s, &x, 8);
    buf[0] = s[3];
    buf[1] = s[2];
    buf[2] = s[1];
    buf[3] = s[0];
    buf[4] = s[7];
    buf[5] = s[6];
    buf[6] = s[5];
    buf[7] = s[4];
#else
    /*
     * x: 7 6 5 4  3 2 1 0
     * s: 0 1 2 3  4 5 6 7
     */
    char s[8];

    __builtin_memcpy(s, &x, 8);
    buf[0] = s[7];
    buf[1] = s[6];
    buf[2] = s[5];
    buf[3] = s[4];
    buf[4] = s[3];
    buf[5] = s[2];
    buf[6] = s[1];
    buf[7] = s[0];
#endif
}

static inline double ledoubletoh(const char buf[8]) {
    char s[8];
    double x;

#if __FLOAT_WORD_ORDER__ == __ORDER_LITTLE_ENDIAN__
    s[0] = buf[3];
    s[1] = buf[2];
    s[2] = buf[1];
    s[3] = buf[0];
    s[4] = buf[7];
    s[5] = buf[6];
    s[6] = buf[5];
    s[7] = buf[4];
#else
    s[0] = buf[7];
    s[1] = buf[6];
    s[2] = buf[5];
    s[3] = buf[4];
    s[4] = buf[3];
    s[5] = buf[2];
    s[6] = buf[1];
    s[7] = buf[0];
#endif

    __builtin_memcpy(&x, s, sizeof(double));
    return x;
}

#else
#error "Machine byte order not supported"
#endif

#if __linux__

/**
 * Type generic Host to BE.
 */
#define htobe(v) _Generic((v), \
        uint16_t: htobe16(v), \
        int16_t: (int16_t)htobe16(v), \
        uint32_t: htobe32(v), \
        int32_t: (int32_t)htobe32(v), \
        uint64_t: htobe64(v), \
        int64_t: (int64_t)htobe64(v), \
        unsigned long long: (unsigned long long)htobe64(v), \
        long long: (int64_t)htobe64(v))

/**
 * Type generic Host to LE.
 */
#define htole(v) _Generic((v), \
        uint16_t: htole16(v), \
        int16_t: (int16_t)htole16(v), \
        uint32_t: htole32(v), \
        int32_t: (int32_t)htole32(v), \
        uint64_t: htole64(v), \
        int64_t: (int64_t)htole64(v), \
        unsigned long long: (unsigned long long)htole64(v), \
        long long: (int64_t)htole64(v))

/**
 * Type generic LE to Host.
 */
#define letoh(v) _Generic((v), \
        uint16_t: le16toh(v), \
        int16_t: (int16_t)le16toh(v), \
        uint32_t: le32toh(v), \
        int32_t: (int32_t)le32toh(v), \
        uint64_t: le64toh(v), \
        int64_t: (int64_t)le64toh(v), \
        unsigned long long: (unsigned long long)le64toh(v), \
        long long: (int64_t)le64toh(v))

/**
 * Type generic BE to Host.
 */
#define betoh(v) _Generic((v), \
        uint16_t: be16toh(v), \
        int16_t: (int16_t)be16toh(v), \
        uint32_t: be32toh(v), \
        int32_t: (int32_t)be32toh(v), \
        uint64_t: be64toh(v), \
        int64_t: (int64_t)be64toh(v), \
        unsigned long long: (unsigned long long)be64toh(v), \
        long long: (int64_t)be64toh(v))

/* 128-bit machines not supported atm. */
static_assert(sizeof(long long) == sizeof(uint64_t));

#else

/**
 * Type generic Host to BE.
 */
#define htobe(v) _Generic((v), \
        uint16_t: htobe16(v), \
        int16_t: (int16_t)htobe16(v), \
        uint32_t: htobe32(v), \
        int32_t: (int32_t)htobe32(v), \
        uint64_t: htobe64(v), \
        size_t: htobe64(v), \
        ssize_t: htobe64(v), \
        int64_t: (int64_t)htobe64(v))

/**
 * Type generic Host to LE.
 */
#define htole(v) _Generic((v), \
        uint16_t: htole16(v), \
        int16_t: (int16_t)htole16(v), \
        uint32_t: htole32(v), \
        int32_t: (int32_t)htole32(v), \
        uint64_t: htole64(v), \
        size_t: htole64(v), \
        ssize_t: htole64(v), \
        int64_t: (int64_t)htole64(v))

/**
 * Type generic LE to Host.
 */
#define letoh(v) _Generic((v), \
        uint16_t: le16toh(v), \
        int16_t: (int16_t)le16toh(v), \
        uint32_t: le32toh(v), \
        int32_t: (int32_t)le32toh(v), \
        uint64_t: le64toh(v), \
        size_t: le64toh(v), \
        ssize_t: le64toh(v), \
        int64_t: (int64_t)le64toh(v))

/**
 * Type generic BE to Host.
 */
#define betoh(v) _Generic((v), \
        uint16_t: be16toh(v), \
        int16_t: (int16_t)be16toh(v), \
        uint32_t: be32toh(v), \
        int32_t: (int32_t)be32toh(v), \
        uint64_t: be64toh(v), \
        size_t: be64toh(v), \
        ssize_t: be64toh(v), \
        int64_t: (int64_t)be64toh(v))

#endif

/* If this fails then htole and letoh will need some adjustment. */
static_assert(sizeof(size_t) == sizeof(uint64_t));

#endif /* _SELVA_ENDIAN_H_ */
