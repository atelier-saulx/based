/*
 * common_defs.h
 *
 * Copyright 2016 Eric Biggers
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */

#ifndef COMMON_DEFS_H
#define COMMON_DEFS_H

#include <stdbool.h>
#include <stddef.h> /* for size_t */
#include <stdint.h>
#include <string.h> /* for memcpy() */
#include "cdefs.h"

/* ========================================================================== */
/*                              Type definitions                              */
/* ========================================================================== */

/* Fixed-width integer types */
typedef uint8_t u8;
typedef uint16_t u16;
typedef uint32_t u32;
typedef uint64_t u64;
typedef int8_t s8;
typedef int16_t s16;
typedef int32_t s32;
typedef int64_t s64;

/*
 * Word type of the target architecture.  Use 'size_t' instead of
 * 'unsigned long' to account for platforms such as Windows that use 32-bit
 * 'unsigned long' on 64-bit architectures.
 */
typedef size_t machine_word_t;

/* Number of bytes in a word */
#define WORDBYTES   ((int)sizeof(machine_word_t))

/* Number of bits in a word */
#define WORDBITS    (8 * WORDBYTES)

/* ========================================================================== */
/*                         Optional compiler features                         */
/* ========================================================================== */

/* Compiler version checks.  Only use when absolutely necessary. */
#if defined(__GNUC__) && !defined(__clang__) && !defined(__INTEL_COMPILER)
#  define GCC_PREREQ(major, minor)      \
    (__GNUC__ > (major) ||          \
     (__GNUC__ == (major) && __GNUC_MINOR__ >= (minor)))
#else
#  define GCC_PREREQ(major, minor)  0
#endif
#ifdef __clang__
#  ifdef __apple_build_version__
#    define CLANG_PREREQ(major, minor, apple_version)   \
    (__apple_build_version__ >= (apple_version))
#  else
#    define CLANG_PREREQ(major, minor, apple_version)   \
    (__clang_major__ > (major) ||           \
     (__clang_major__ == (major) && __clang_minor__ >= (minor)))
#  endif
#else
#  define CLANG_PREREQ(major, minor, apple_version) 0
#endif

/*
 * Macros to check for compiler support for attributes and builtins.  clang
 * implements these macros, but gcc doesn't, so generally any use of one of
 * these macros must also be combined with a gcc version check.
 */
#ifndef __has_attribute
#  define __has_attribute(attribute)    0
#endif
#ifndef __has_builtin
#  define __has_builtin(builtin)    0
#endif

/* LIBEXPORT - export a function from a shared library */
#define LIBEXPORT       __attribute__((visibility("default")))

/* forceinline - force a function to be inlined, if possible */
#ifdef __GNUC__
#  define forceinline       inline __attribute__((always_inline))
#else
#  define forceinline       inline
#endif

/* MAYBE_UNUSED - mark a function or variable as maybe unused */
#ifdef __GNUC__
#  define MAYBE_UNUSED      __attribute__((unused))
#else
#  define MAYBE_UNUSED
#endif

/* prefetchr(addr) - prefetch into L1 cache for read */
#ifdef __GNUC__
#  define prefetchr(addr)   __builtin_prefetch((addr), 0)
#else
#  define prefetchr(addr)
#endif

/* prefetchw(addr) - prefetch into L1 cache for write */
#ifdef __GNUC__
#  define prefetchw(addr)   __builtin_prefetch((addr), 1)
#else
#  define prefetchw(addr)
#endif

/*
 * _aligned_attribute(n) - declare that the annotated variable, or variables of
 * the annotated type, must be aligned on n-byte boundaries.
 */
#undef _aligned_attribute
#ifdef __GNUC__
#  define _aligned_attribute(n) __attribute__((aligned(n)))
#endif

/* Does the compiler support the 'target' function attribute? */
#define COMPILER_SUPPORTS_TARGET_FUNCTION_ATTRIBUTE \
    (GCC_PREREQ(4, 4) || __has_attribute(target))

/* ========================================================================== */
/*                          Miscellaneous macros                              */
/* ========================================================================== */

#define ARRAY_LEN(A)        (sizeof(A) / sizeof((A)[0]))
#define MIN(a, b)       ((a) <= (b) ? (a) : (b))
#define MAX(a, b)       ((a) >= (b) ? (a) : (b))
#define DIV_ROUND_UP(n, d)  (((n) + (d) - 1) / (d))
#define STATIC_ASSERT(expr) static_assert(expr)
#define ALIGN(n, a)     (((n) + (a) - 1) & ~((a) - 1))
#define ROUND_UP(n, d)      ((d) * DIV_ROUND_UP((n), (d)))

/* ========================================================================== */
/*                           Endianness handling                              */
/* ========================================================================== */

/*
 * CPU_IS_LITTLE_ENDIAN() - 1 if the CPU is little endian, or 0 if it is big
 * endian.  When possible this is a compile-time macro that can be used in
 * preprocessor conditionals.  As a fallback, a generic method is used that
 * can't be used in preprocessor conditionals but should still be optimized out.
 */
#if defined(__BYTE_ORDER__) /* gcc v4.6+ and clang */
#  define CPU_IS_LITTLE_ENDIAN()  (__BYTE_ORDER__ == __ORDER_LITTLE_ENDIAN__)
#else
static forceinline bool CPU_IS_LITTLE_ENDIAN(void)
{
    union {
        u32 w;
        u8 b;
    } u;

    u.w = 1;
    return u.b;
}
#endif

/* bswap16(v) - swap the bytes of a 16-bit integer */
static forceinline u16 bswap16(u16 v)
{
#if GCC_PREREQ(4, 8) || __has_builtin(__builtin_bswap16)
    return __builtin_bswap16(v);
#else
    return (v << 8) | (v >> 8);
#endif
}

/* bswap32(v) - swap the bytes of a 32-bit integer */
static forceinline u32 bswap32(u32 v)
{
#if GCC_PREREQ(4, 3) || __has_builtin(__builtin_bswap32)
    return __builtin_bswap32(v);
#else
    return ((v & 0x000000FF) << 24) |
           ((v & 0x0000FF00) << 8) |
           ((v & 0x00FF0000) >> 8) |
           ((v & 0xFF000000) >> 24);
#endif
}

/* bswap64(v) - swap the bytes of a 64-bit integer */
static forceinline u64 bswap64(u64 v)
{
#if GCC_PREREQ(4, 3) || __has_builtin(__builtin_bswap64)
    return __builtin_bswap64(v);
#else
    return ((v & 0x00000000000000FF) << 56) |
           ((v & 0x000000000000FF00) << 40) |
           ((v & 0x0000000000FF0000) << 24) |
           ((v & 0x00000000FF000000) << 8) |
           ((v & 0x000000FF00000000) >> 8) |
           ((v & 0x0000FF0000000000) >> 24) |
           ((v & 0x00FF000000000000) >> 40) |
           ((v & 0xFF00000000000000) >> 56);
#endif
}

#define le16_bswap(v) (CPU_IS_LITTLE_ENDIAN() ? (v) : bswap16(v))
#define le32_bswap(v) (CPU_IS_LITTLE_ENDIAN() ? (v) : bswap32(v))
#define le64_bswap(v) (CPU_IS_LITTLE_ENDIAN() ? (v) : bswap64(v))
#define be16_bswap(v) (CPU_IS_LITTLE_ENDIAN() ? bswap16(v) : (v))
#define be32_bswap(v) (CPU_IS_LITTLE_ENDIAN() ? bswap32(v) : (v))
#define be64_bswap(v) (CPU_IS_LITTLE_ENDIAN() ? bswap64(v) : (v))

/* ========================================================================== */
/*                          Unaligned memory accesses                         */
/* ========================================================================== */

/*
 * UNALIGNED_ACCESS_IS_FAST() - 1 if unaligned memory accesses can be performed
 * efficiently on the target platform, otherwise 0.
 */
#if defined(__GNUC__) && \
    (defined(__x86_64__) || defined(__i386__) || \
     defined(__ARM_FEATURE_UNALIGNED) || defined(__powerpc64__) || \
     /*
      * For all compilation purposes, WebAssembly behaves like any other CPU
      * instruction set. Even though WebAssembly engine might be running on
      * top of different actual CPU architectures, the WebAssembly spec
      * itself permits unaligned access and it will be fast on most of those
      * platforms, and simulated at the engine level on others, so it's
      * worth treating it as a CPU architecture with fast unaligned access.
      */ defined(__wasm__))
#  define UNALIGNED_ACCESS_IS_FAST  1
#else
#  define UNALIGNED_ACCESS_IS_FAST  0
#endif

/*
 * Implementing unaligned memory accesses using memcpy() is portable, and it
 * usually gets optimized appropriately by modern compilers.  I.e., each
 * memcpy() of 1, 2, 4, or WORDBYTES bytes gets compiled to a load or store
 * instruction, not to an actual function call.
 *
 * We no longer use the "packed struct" approach to unaligned accesses, as that
 * is nonstandard, has unclear semantics, and doesn't receive enough testing
 * (see https://gcc.gnu.org/bugzilla/show_bug.cgi?id=94994).
 *
 * arm32 with __ARM_FEATURE_UNALIGNED in gcc 5 and earlier is a known exception
 * where memcpy() generates inefficient code
 * (https://gcc.gnu.org/bugzilla/show_bug.cgi?id=67366).  However, we no longer
 * consider that one case important enough to maintain different code for.
 * If you run into it, please just use a newer version of gcc (or use clang).
 */

/* Unaligned loads and stores without endianness conversion */

#define DEFINE_UNALIGNED_TYPE(type)             \
static forceinline type                     \
load_##type##_unaligned(const void *p)              \
{                               \
    type v;                         \
                                \
    memcpy(&v, p, sizeof(v));               \
    return v;                       \
}                               \
                                \
static forceinline void                     \
store_##type##_unaligned(type v, void *p)           \
{                               \
    memcpy(p, &v, sizeof(v));               \
}

DEFINE_UNALIGNED_TYPE(u16)
DEFINE_UNALIGNED_TYPE(u32)
DEFINE_UNALIGNED_TYPE(u64)
DEFINE_UNALIGNED_TYPE(machine_word_t)

#define load_word_unaligned load_machine_word_t_unaligned
#define store_word_unaligned    store_machine_word_t_unaligned

/* Unaligned loads with endianness conversion */

static forceinline u16
get_unaligned_le16(const u8 *p)
{
    if (UNALIGNED_ACCESS_IS_FAST)
        return le16_bswap(load_u16_unaligned(p));
    else
        return ((u16)p[1] << 8) | p[0];
}

static forceinline u16
get_unaligned_be16(const u8 *p)
{
    if (UNALIGNED_ACCESS_IS_FAST)
        return be16_bswap(load_u16_unaligned(p));
    else
        return ((u16)p[0] << 8) | p[1];
}

static forceinline u32
get_unaligned_le32(const u8 *p)
{
    if (UNALIGNED_ACCESS_IS_FAST)
        return le32_bswap(load_u32_unaligned(p));
    else
        return ((u32)p[3] << 24) | ((u32)p[2] << 16) |
            ((u32)p[1] << 8) | p[0];
}

static forceinline u32
get_unaligned_be32(const u8 *p)
{
    if (UNALIGNED_ACCESS_IS_FAST)
        return be32_bswap(load_u32_unaligned(p));
    else
        return ((u32)p[0] << 24) | ((u32)p[1] << 16) |
            ((u32)p[2] << 8) | p[3];
}

static forceinline u64
get_unaligned_le64(const u8 *p)
{
    if (UNALIGNED_ACCESS_IS_FAST)
        return le64_bswap(load_u64_unaligned(p));
    else
        return ((u64)p[7] << 56) | ((u64)p[6] << 48) |
            ((u64)p[5] << 40) | ((u64)p[4] << 32) |
            ((u64)p[3] << 24) | ((u64)p[2] << 16) |
            ((u64)p[1] << 8) | p[0];
}

static forceinline machine_word_t
get_unaligned_leword(const u8 *p)
{
    STATIC_ASSERT(WORDBITS == 32 || WORDBITS == 64);
    if (WORDBITS == 32)
        return get_unaligned_le32(p);
    else
        return get_unaligned_le64(p);
}

/* Unaligned stores with endianness conversion */

static forceinline void
put_unaligned_le16(u16 v, u8 *p)
{
    if (UNALIGNED_ACCESS_IS_FAST) {
        store_u16_unaligned(le16_bswap(v), p);
    } else {
        p[0] = (u8)(v >> 0);
        p[1] = (u8)(v >> 8);
    }
}

static forceinline void
put_unaligned_be16(u16 v, u8 *p)
{
    if (UNALIGNED_ACCESS_IS_FAST) {
        store_u16_unaligned(be16_bswap(v), p);
    } else {
        p[0] = (u8)(v >> 8);
        p[1] = (u8)(v >> 0);
    }
}

static forceinline void
put_unaligned_le32(u32 v, u8 *p)
{
    if (UNALIGNED_ACCESS_IS_FAST) {
        store_u32_unaligned(le32_bswap(v), p);
    } else {
        p[0] = (u8)(v >> 0);
        p[1] = (u8)(v >> 8);
        p[2] = (u8)(v >> 16);
        p[3] = (u8)(v >> 24);
    }
}

static forceinline void
put_unaligned_be32(u32 v, u8 *p)
{
    if (UNALIGNED_ACCESS_IS_FAST) {
        store_u32_unaligned(be32_bswap(v), p);
    } else {
        p[0] = (u8)(v >> 24);
        p[1] = (u8)(v >> 16);
        p[2] = (u8)(v >> 8);
        p[3] = (u8)(v >> 0);
    }
}

static forceinline void
put_unaligned_le64(u64 v, u8 *p)
{
    if (UNALIGNED_ACCESS_IS_FAST) {
        store_u64_unaligned(le64_bswap(v), p);
    } else {
        p[0] = (u8)(v >> 0);
        p[1] = (u8)(v >> 8);
        p[2] = (u8)(v >> 16);
        p[3] = (u8)(v >> 24);
        p[4] = (u8)(v >> 32);
        p[5] = (u8)(v >> 40);
        p[6] = (u8)(v >> 48);
        p[7] = (u8)(v >> 56);
    }
}

static forceinline void
put_unaligned_leword(machine_word_t v, u8 *p)
{
    STATIC_ASSERT(WORDBITS == 32 || WORDBITS == 64);
    if (WORDBITS == 32)
        put_unaligned_le32(v, p);
    else
        put_unaligned_le64(v, p);
}

/* ========================================================================== */
/*                         Bit manipulation functions                         */
/* ========================================================================== */

/*
 * Bit Scan Reverse (BSR) - find the 0-based index (relative to the least
 * significant end) of the *most* significant 1 bit in the input value.  The
 * input value must be nonzero!
 */

static forceinline unsigned
bsr32(u32 v)
{
#ifdef __GNUC__
    return 31 - __builtin_clz(v);
#else
    unsigned i = 0;

    while ((v >>= 1) != 0)
        i++;
    return i;
#endif
}

static forceinline unsigned
bsr64(u64 v)
{
#ifdef __GNUC__
    return 63 - __builtin_clzll(v);
#else
    unsigned i = 0;

    while ((v >>= 1) != 0)
        i++;
    return i;
#endif
}

static forceinline unsigned
bsrw(machine_word_t v)
{
    STATIC_ASSERT(WORDBITS == 32 || WORDBITS == 64);
    if (WORDBITS == 32)
        return bsr32(v);
    else
        return bsr64(v);
}

/*
 * Bit Scan Forward (BSF) - find the 0-based index (relative to the least
 * significant end) of the *least* significant 1 bit in the input value.  The
 * input value must be nonzero!
 */

static forceinline unsigned
bsf32(u32 v)
{
#ifdef __GNUC__
    return __builtin_ctz(v);
#else
    unsigned i = 0;

    for (; (v & 1) == 0; v >>= 1)
        i++;
    return i;
#endif
}

static forceinline unsigned
bsf64(u64 v)
{
#ifdef __GNUC__
    return __builtin_ctzll(v);
#else
    unsigned i = 0;

    for (; (v & 1) == 0; v >>= 1)
        i++;
    return i;
#endif
}

static forceinline unsigned
bsfw(machine_word_t v)
{
    STATIC_ASSERT(WORDBITS == 32 || WORDBITS == 64);
    if (WORDBITS == 32)
        return bsf32(v);
    else
        return bsf64(v);
}

/*
 * rbit32(v): reverse the bits in a 32-bit integer.  This doesn't have a
 * fallback implementation; use '#ifdef rbit32' to check if this is available.
 */
#undef rbit32
#if defined(__GNUC__) && defined(__arm__) && \
    (__ARM_ARCH >= 7 || (__ARM_ARCH == 6 && defined(__ARM_ARCH_6T2__)))
static forceinline u32
rbit32(u32 v)
{
    __asm__("rbit %0, %1" : "=r" (v) : "r" (v));
    return v;
}
#define rbit32 rbit32
#elif defined(__GNUC__) && defined(__aarch64__)
static forceinline u32
rbit32(u32 v)
{
    __asm__("rbit %w0, %w1" : "=r" (v) : "r" (v));
    return v;
}
#define rbit32 rbit32
#endif

#endif /* COMMON_DEFS_H */
