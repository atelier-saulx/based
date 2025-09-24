/*
 * Copyright (c) 2022-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#define _GNU_SOURCE
#define __STDC_WANT_LIB_EXT1__ 1
#include <assert.h>
#include <errno.h>
#include <stdarg.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "jemalloc_selva.h"
#include "libdeflate.h"
#include "libdeflate_strings.h"
#include "selva_error.h"
#include "selva/crc32c.h"
#include "finalizer.h"
#include "bits.h"
#include "selva/selva_string.h"

#ifdef EN_VALGRIND
#define selva_sallocx(p, v)     0
#endif

/**
 * Don't use libdeflate_strings functions for compressed strings under this size.
 * This is a questimate of the minimum heap space required to use the block
 * stream API. We could be ok in most cases with a smaller buffer but there is
 * no way to know the size of the biggest DEFLATE block we'll see and there is
 * no standard limit. So, if we'd use a very small buffer here it would cause a
 * perf hit for those cases that actually do need a larger block buffer because
 * the lib will need to do guess work and grow the buffer until it's big enough
 * to fit the biggest block in the DEFLATE stream.
 * Anyway, it's probably just faster to decompress small strings straight away,
 * rather than using the block streaming API.
 */
#define DEFLATE_STRINGS_THRESHOLD_SIZE 65536

#define SELVA_STRING_QP(T, F, S, ...) \
    STATIC_IF(IS_POINTER_CONST((S)), \
              (T const *) (F) ((S) __VA_OPT__(,) __VA_ARGS__), \
              (T *) (F) ((S) __VA_OPT__(,) __VA_ARGS__))

/**
 * Test that only one or none of excl flags are set in flags.
 */
static inline bool test_mutually_exclusive_flags(enum selva_string_flags flags, enum selva_string_flags excl)
{
    return __builtin_popcount(flags & excl) > 1;
}

static inline enum selva_string_flags len_parity(size_t len)
{
    return _Generic(len,
            unsigned int: __builtin_parity,
            unsigned long: __builtin_parityl,
            unsigned long long: __builtin_parityll)(len) << (__builtin_ffsll(SELVA_STRING_LEN_PARITY) - 1);
}

static inline bool verify_parity(const struct selva_string *hdr)
{
    return len_parity(hdr->len) == (hdr->flags & SELVA_STRING_LEN_PARITY);
}

/**
 * Get a pointer to the string buffer.
 */
static inline char *get_buf(const struct selva_string *s)
{
    if (!verify_parity(s)) {
        abort();
    }

    return (s->flags & SELVA_STRING_MUTABLE) ? (char *)s->p : (char *)s->emb;
}

#define get_buf(S) SELVA_STRING_QP(char, get_buf, (S))

/**
 * Get a buffer that can be compared with standard string functions.
 * If the string s is compressed then it's first decompressed into a temporary
 * buffer. must_free is set to indicate that the returned buffer must be freed
 * with selva_free().
 */
static char *get_comparable_buf(struct libdeflate_decompressor *decompressor, const struct selva_string *s, size_t *buf_len, bool *must_free)
{
    size_t len = selva_string_getz_ulen(s);
    char *buf;

    if (s->flags & SELVA_STRING_COMPRESS) {
        buf = selva_malloc(len);
        selva_string_decompress(decompressor, s, buf); /* RFE Should we return a NULL on error? */
        buf[len] = '\0';
        *must_free = true;
    } else {
        buf = get_buf((struct selva_string *)s);
        *must_free = false;
    }

    if (buf_len) {
        *buf_len = len;
    }
    return buf;
}

/**
 * DO NOT CALL THIS FUNCTION IF CRC is not enabled.
 */
static uint32_t get_crc(const struct selva_string *s) __attribute__((pure, access (read_only, 1)));
static uint32_t get_crc(const struct selva_string *s)
{
    uint32_t csum;

    memcpy(&csum, get_buf(s) + s->len, sizeof(csum));

    return csum;
}

/**
 * DO NOT CALL THIS FUNCTION IF CRC is not enabled.
 */
static void set_crc(struct selva_string *s, uint32_t csum)
{
#if 0
    assert(s->flags & SELVA_STRING_CRC);
    if (s->flags & SELVA_STRING_MUTABLE) {
        if (selva_sallocx(s->p, 0) < s->len + sizeof(csum)) {
            fprintf(stderr, "ERROR: %zu < %zu\n", selva_sallocx(s->p, 0), s->len + sizeof(csum));
        }
        assert(selva_sallocx(s->p, 0) >= s->len + sizeof(csum));
    }
#endif

    /*
     * Space for the CRC was hopefully allocated when alloc_immutable() or
     * alloc_mutable() was called.
     */
    memcpy(get_buf(s) + s->len, &csum, sizeof(csum));
}

/**
 * Calculate the CRC of a selva_string.
 * @param hdr is the header part of a selva_string i.e. without the actual string.
 */
static uint32_t calc_crc(const struct selva_string *s) __attribute__((pure, access(read_only, 1)));
static uint32_t calc_crc(const struct selva_string *s)
{
    return crc32c(0, get_buf(s), s->len);
}

static void update_crc(struct selva_string *s)
{
    if (s->flags & SELVA_STRING_CRC) {
        set_crc(s, calc_crc(s));
    }
}

[[nodiscard]]
static struct selva_string *alloc_mutable(size_t len)
{
    struct selva_string *s;

    s = selva_calloc(1, sizeof(struct selva_string));
    s->p = selva_malloc(len);

    return s;
}

/**
 * Calculate the buffer size needed for an immutable selva_string.
 */
static size_t calc_immutable_alloc_size(size_t len)
{
    const size_t emb_size = sizeof_field(struct selva_string, emb);
    const size_t add = len <= emb_size ? 0 : len - emb_size;

    return sizeof(struct selva_string) + add;
}

/**
 * Allocate an immutable selva_string.
 */
[[nodiscard]]
static struct selva_string *alloc_immutable(size_t len)
{
    struct selva_string *s;

    s = selva_malloc(calc_immutable_alloc_size(len));
    memset(s, 0, sizeof(struct selva_string)); /* We only want to clear the header. */

    return s;
}

static void _set_string(struct selva_string *s, const char *str, size_t len, enum selva_string_flags flags)
{
    char *buf;

    s->flags = (flags & ~SELVA_STRING_LEN_PARITY) | len_parity(len);
    s->len = len;

    buf = get_buf(s);
    if (str && len > 0) {
        memcpy(buf, str, len);
    } else {
        memset(buf, '\0', s->len);
    }
}

static struct selva_string *set_string(struct selva_string *s, const char *str, size_t len, enum selva_string_flags flags)
{
    _set_string(s, str, len, flags);
    update_crc(s);

    return s;
}

static struct selva_string *set_string_crc(struct selva_string *s, const char *str, size_t len, uint32_t crc, enum selva_string_flags flags)
{
    _set_string(s, str, len, flags);
    set_crc(s, crc);

    return s;
}

static int init_check(const char *str, size_t len, enum selva_string_flags flags)
{
#if 0
    static_assert(bitsizeof(struct selva_string, len) == 56);
#endif

    /* TODO Support compression. */
    if ((flags & (INVALID_FLAGS_MASK | SELVA_STRING_COMPRESS)) ||
        test_mutually_exclusive_flags(flags, (SELVA_STRING_MUTABLE | SELVA_STRING_MUTABLE_FIXED)) ||
        (!(flags & (SELVA_STRING_MUTABLE_FIXED | SELVA_STRING_MUTABLE)) && !str) ||
        len > 72057594037927936) /* 2^56 */ {
        return SELVA_EINVAL;
    }
    return 0;
}

int selva_string_init(struct selva_string *s, const char *str, size_t len, enum selva_string_flags flags)
{
    int err;

    err = init_check(str, len, flags);
    if (err) {
        return err;
    }

    flags |= SELVA_STRING_STATIC | len_parity(len);
    if (flags & SELVA_STRING_MUTABLE_FIXED) {
        set_string(s, str, len, flags);
    } else if (flags & SELVA_STRING_MUTABLE) {
        const size_t trail = (flags & SELVA_STRING_CRC) ? sizeof(uint32_t) : 0;

        s->p = selva_malloc(len + trail);
        set_string(s, str, len, flags);
    } else {
        set_string(s, str, len, flags);
    }

    return 0;
}

int selva_string_init_crc(struct selva_string *s, const char *str, size_t len, uint32_t crc, enum selva_string_flags flags)
{
    int err;

    err = init_check(str, len, flags);
    if (err) {
        return err;
    }

    /* TODO remove len_parity() call */
    flags |= SELVA_STRING_STATIC | SELVA_STRING_CRC | len_parity(len);
    if (flags & SELVA_STRING_MUTABLE_FIXED) {
        set_string_crc(s, str, len, crc, flags);
    } else if (flags & SELVA_STRING_MUTABLE) {
        const size_t trail = !!(flags & SELVA_STRING_CRC) * sizeof(uint32_t);

        s->p = selva_malloc(len + trail);
        set_string_crc(s, str, len, crc, flags);
    } else {
        set_string_crc(s, str, len, crc, flags);
    }

    return 0;
}

struct selva_string *selva_string_create(const char *str, size_t len, enum selva_string_flags flags)
{
    const size_t trail = !!(flags & SELVA_STRING_CRC) * sizeof(uint32_t);
    const size_t alloc_len = len + trail;

    if ((flags & (INVALID_FLAGS_MASK | SELVA_STRING_STATIC)) ||
        test_mutually_exclusive_flags(flags, SELVA_STRING_FREEZE | SELVA_STRING_MUTABLE)) {
        return nullptr; /* Invalid flags */
    }

    return (flags & SELVA_STRING_MUTABLE)
        ? set_string(alloc_mutable(alloc_len), str, len, flags)
        : set_string(alloc_immutable(alloc_len), str, len, flags);
}

struct selva_string *selva_string_create_crc(const char *str, size_t len, enum selva_string_flags flags, uint32_t crc)
{
    const size_t alloc_len = len + sizeof(uint32_t);

    if ((flags & (INVALID_FLAGS_MASK | SELVA_STRING_STATIC)) ||
        test_mutually_exclusive_flags(flags, SELVA_STRING_FREEZE | SELVA_STRING_MUTABLE)) {
        return nullptr; /* Invalid flags */
    }

    /*
     * We just trust that this is the correct crc and that the data isn't
     * corrupted yet.
     */
    flags |= SELVA_STRING_CRC;
    return (flags & SELVA_STRING_MUTABLE)
        ? set_string_crc(alloc_mutable(alloc_len), str, len, crc, flags)
        : set_string_crc(alloc_immutable(alloc_len), str, len, crc, flags);
}

struct selva_string *selva_string_createf(const char *fmt, ...)
{
    va_list args;
    int res;
    struct selva_string *s;

    va_start(args);
    res = vsnprintf(nullptr, 0, fmt, args);
    va_end(args);

    if (res < 0) {
        return nullptr;
    }

    s = selva_string_create(nullptr, res + 1, 0);
    if (!s) {
        return nullptr;
    }

    va_start(args);
    (void)vsnprintf(get_buf(s), s->len, fmt, args);
    va_end(args);

    /* TODO truncate? */

    return s;
}

struct selva_string *selva_string_fread(FILE *fp, size_t size, enum selva_string_flags flags)
{
    const enum selva_string_flags suppported_flags = SELVA_STRING_CRC | SELVA_STRING_COMPRESS;
    struct selva_string *s;

    flags &= suppported_flags;
    s = selva_string_create(nullptr, size, flags);
    if (!s) {
        return nullptr;
    }

    s->len = fread(get_buf(s), 1, size, fp);
    flags |= len_parity(s->len);
    s->flags = flags;

    update_crc(s);
    return s;
}

struct selva_string *selva_string_createz(struct libdeflate_compressor *compressor, const char *in_str, size_t in_len, enum selva_string_flags flags)
{
    const size_t trail = (flags & SELVA_STRING_CRC) ? sizeof(uint32_t) : 0;
    struct selva_string *s;
    size_t compressed_size;
    struct selva_string *tmp;

    if ((flags & (SELVA_STRING_MUTABLE | SELVA_STRING_MUTABLE_FIXED | SELVA_STRING_STATIC)) ||
        (flags & INVALID_FLAGS_MASK)) {
        return nullptr; /* Invalid flags */
    }

    s = alloc_immutable(sizeof(struct selva_string_compressed_hdr) + in_len + trail);
    compressed_size = libdeflate_compress(compressor, in_str, in_len, get_buf(s) + sizeof(struct selva_string_compressed_hdr), in_len);
    if (compressed_size == 0) {
        /*
         * No compression was achieved.
         * Therefore we use the original uncompressed string.
         */
        set_string(s, in_str, in_len, (flags & ~SELVA_STRING_COMPRESS));
    } else {
        /*
         * The string was compressed.
         */
        struct selva_string_compressed_hdr hdr;
        char *buf = get_buf(s);

        s->len = sizeof(hdr) + compressed_size;
        s->flags = flags | SELVA_STRING_COMPRESS | len_parity(s->len);

        hdr.uncompressed_size = in_len;
        memcpy(buf, &hdr, sizeof(hdr));
    }

    tmp = selva_realloc(s, calc_immutable_alloc_size(s->len + trail));
    if (tmp) {
        s = tmp;
    }

    update_crc(s);
    return s;
}

static const void *get_compressed_data(const struct selva_string *s, size_t *compressed_size, size_t *uncompressed_size)
{
    struct selva_string_compressed_hdr hdr;
    const char *buf = get_buf(s);

    memcpy(&hdr, buf, sizeof(hdr));
    *compressed_size = s->len - sizeof(hdr);
    *uncompressed_size = hdr.uncompressed_size;
    return buf + sizeof(hdr);
}

int selva_string_decompress(struct libdeflate_decompressor *decompressor, const struct selva_string * restrict s, char * restrict buf)
{
    if (s->flags & SELVA_STRING_COMPRESS) {
        const void *data;
        size_t data_len;
        size_t uncompressed_size;

        if (!verify_parity(s)) {
            abort();
        }

        data = get_compressed_data(s, &data_len, &uncompressed_size);

        size_t nbytes_out = 0;
        enum libdeflate_result res;

        res = libdeflate_decompress(decompressor, data, data_len, buf, uncompressed_size, &nbytes_out);
        if (res != 0 || nbytes_out != uncompressed_size) {
            return SELVA_EINVAL;
        }
    } else {
        memcpy(buf, get_buf(s), s->len);
    }

    return 0;
}

struct selva_string *selva_string_dup(const struct selva_string *s, enum selva_string_flags flags)
{
    /* TODO Decompress the original if (s->flags & SELVA_STRING_COMPRESS) is set but (flags & SELVA_STRING_COMPRESS) is not set. */
    return selva_string_create(get_buf(s), s->len, flags);
}

int selva_string_truncate(struct selva_string *s, size_t newlen)
{
    const enum selva_string_flags flags = s->flags;
    const size_t oldlen = s->len;

    if (!(flags & SELVA_STRING_MUTABLE)) {
        return SELVA_ENOTSUP;
    }

    if (newlen >= oldlen) {
        return SELVA_EINVAL;
    } else if (newlen < oldlen) {
        const size_t trail = (flags & SELVA_STRING_CRC) ? sizeof(uint32_t) : 0;

        s->len = newlen;
        s->flags = (flags & ~SELVA_STRING_LEN_PARITY) | len_parity(newlen);
        s->p = selva_realloc(s->p, newlen + trail);

        update_crc(s);
    }

    return 0;
}

int selva_string_append(struct selva_string *s, const char *str, size_t len)
{
    const enum selva_string_flags flags = s->flags;

    if (!(flags & SELVA_STRING_MUTABLE)) {
        return SELVA_ENOTSUP;
    }

    if (len > 0) {
        size_t old_len = s->len;
        const size_t trail = (flags & SELVA_STRING_CRC) ? sizeof(uint32_t) : 0;

        s->len += len;
        s->flags = (s->flags & ~SELVA_STRING_LEN_PARITY) | len_parity(s->len);
        s->p = selva_realloc(s->p, s->len + trail);
        if (str) {
            memcpy(s->p + old_len, str, len);
        } else {
            memset(s->p + old_len, 0, len);
        }

        update_crc(s);
    }

    return 0;
}

static int replace_str(struct selva_string *s, const char *str, size_t len)
{
    const enum selva_string_flags flags = s->flags;

    if (flags & SELVA_STRING_MUTABLE_FIXED) {
        if (len > s->len) {
            return SELVA_EINVAL;
        }

        if (str) {
            memcpy(s->emb, str, len);
#ifdef __STDC_LIB_EXT1__
            (void)memset_s(s->emb + len, s->len - len, 0, s->len - len);
#else
            if (len < s->len) {
                memset(s->emb + len, 0, s->len - len);
            }
#endif
        } else {
            memset(s->emb, 0, s->len);
        }
    } else if (flags & SELVA_STRING_MUTABLE) {
        const size_t trail = (flags & SELVA_STRING_CRC) ? sizeof(uint32_t) : 0;

        s->len = len;
        s->flags = (flags & ~SELVA_STRING_LEN_PARITY) | len_parity(len);
        s->p = selva_realloc(s->p, len + trail);
        if (str) {
            memcpy(s->p, str, len);
        } else {
            memset(s->p, 0, len);
        }
    } else {
        return SELVA_ENOTSUP;
    }

    return 0;
}

int selva_string_replace(struct selva_string *s, const char *str, size_t len)
{
    int err;

    err = replace_str(s, str, len);
    if (!err) {
        update_crc(s);
    }

    return err;
}

int selva_string_replace_crc(struct selva_string *s, const char *str, size_t len, uint32_t crc)
{
    int err;

    if (!(s->flags & SELVA_STRING_CRC)) {
        return SELVA_ENOTSUP;
    }

    err = replace_str(s, str, len);
    if (!err) {
        set_crc(s, crc);
    }

    return err;
}

void selva_string_free(_selva_string_ptr_t _s)
{
    if (!_s.__s) {
        return; /* Traditional. */
    }

    struct selva_string *s = _s.__s;
    const enum selva_string_flags flags = s->flags;

    if (flags & SELVA_STRING_FREEZE) {
        return;
    }

    if (flags & SELVA_STRING_MUTABLE) {
        selva_free(s->p);
    }

    if (flags & SELVA_STRING_STATIC) {
        return;
    }

    selva_free(s);
}

void selva_string_auto_finalize(struct finalizer *finalizer, struct selva_string *s) {
    finalizer_add(finalizer, s, selva_string_free);
}

enum selva_string_flags selva_string_get_flags(const struct selva_string *s)
{
    return s->flags;
}

size_t selva_string_get_len(const struct selva_string *s)
{
    if (!verify_parity(s)) {
        abort();
    }

    return s->len;
}

size_t selva_string_getz_ulen(const struct selva_string *s)
{
    if (s->flags & SELVA_STRING_COMPRESS) {
        struct selva_string_compressed_hdr hdr;

        memcpy(&hdr, get_buf(s), sizeof(hdr));
        return hdr.uncompressed_size;
    } else {
        if (!verify_parity(s)) {
            abort();
        }

        return s->len;
    }
}

double selva_string_getz_cratio(const struct selva_string *s)
{
    if (s->flags & SELVA_STRING_COMPRESS) {
        struct selva_string_compressed_hdr hdr;

        memcpy(&hdr, get_buf(s), sizeof(hdr));

        return (double)hdr.uncompressed_size / (double)(s->len - sizeof(hdr));
    } else {
        return 1;
    }
}

const uint8_t *selva_string_to_buf(const struct selva_string *s, size_t *size)
{
    const size_t trail = (s->flags & SELVA_STRING_CRC) ? sizeof(uint32_t) : 0;

    if (size) {
        *size = s->len + trail;
    }

    return (const uint8_t *)get_buf(s);
}

const char *selva_string_to_str(const struct selva_string *s, size_t *len)
{
    *len = s->len;
    return get_buf(s);
}

char *selva_string_to_mstr(struct selva_string *s, size_t *len)
{
    /* Compat with legacy. */
    if (!s || !(s->flags & (SELVA_STRING_MUTABLE | SELVA_STRING_MUTABLE_FIXED))) {
        if (len) {
            *len = 0;
        }
        return nullptr;
    }

    if (len) {
        *len = s->len;
    }

    return get_buf(s);
}

int selva_string_to_ll(const struct selva_string *s, long long *ll)
{
    const char *str = get_buf(s);
    int e;

    errno = 0;
    *ll = strtoll(str, nullptr, 10);
    e = errno;
    if (e == ERANGE) {
        return SELVA_ERANGE;
    } else if (e == EINVAL) {
        return SELVA_EINVAL;
    }

    return 0;
}

int selva_string_to_ull(const struct selva_string *s, unsigned long long *ull)
{
    const char *str = get_buf(s);
    int e;

    errno = 0;
    *ull = strtoull(str, nullptr, 10);
    e = errno;
    if (e == ERANGE) {
        return SELVA_ERANGE;
    } else if (e == EINVAL) {
        return SELVA_EINVAL;
    }

    return 0;
}

int selva_string_to_float(const struct selva_string *s, float *f)
{
    const char *str = get_buf(s);
    int e;

    errno = 0;
    *f = strtof(str, nullptr);
    e = errno;
    if (e == ERANGE) {
        return SELVA_ERANGE;
    } else if (e == EINVAL) {
        return SELVA_EINVAL;
    }

    return 0;
}

int selva_string_to_double(const struct selva_string *s, double *d)
{
    const char *str = get_buf(s);
    int e;

    errno = 0;
    *d = strtod(str, nullptr);
    e = errno;
    if (e == ERANGE) {
        return SELVA_ERANGE;
    } else if (e == EINVAL) {
        return SELVA_EINVAL;
    }

    return 0;
}

int selva_string_to_ldouble(const struct selva_string *s, long double *ld)
{
    const char *str = get_buf(s);
    int e;

    errno = 0;
    *ld = strtold(str, nullptr);
    e = errno;
    if (e == ERANGE) {
        return SELVA_ERANGE;
    } else if (e == EINVAL) {
        return SELVA_EINVAL;
    }

    return 0;
}

void selva_string_freeze(struct selva_string *s)
{
    s->flags |= SELVA_STRING_FREEZE;
}

int selva_string_verify_crc(const struct selva_string *s)
{
    if (!verify_parity(s)) {
        return 0;
    }
    if ((s->flags & (SELVA_STRING_COMPRESS | SELVA_STRING_CRC)) == (SELVA_STRING_COMPRESS | SELVA_STRING_CRC)) {
        return 1; /* We don't check compressed strings because the CRC is for the uncompressed string. */
    }

    return (s->flags & SELVA_STRING_CRC) && get_crc(s) == calc_crc(s);
}

uint32_t selva_string_get_crc(const struct selva_string *s)
{
    if (!(s->flags & SELVA_STRING_CRC)) {
        return 0;
    }

    return get_crc(s);
}

void selva_string_set_crc(struct selva_string *s, uint32_t csum)
{
    if (s->flags & SELVA_STRING_CRC) {
        set_crc(s, csum);
    }
}

void selva_string_set_compress(struct selva_string *s)
{
    s->flags |= SELVA_STRING_COMPRESS;
}

static int selva_string_cmp_unz(struct libdeflate_decompressor *, const struct selva_string *a, const struct selva_string *b)
{
    return strcmp(get_buf(a), get_buf(b));
}

static int selva_string_cmp_shortz(struct libdeflate_decompressor *decompressor, const struct selva_string *a, const struct selva_string *b)
{
    bool must_free_a, must_free_b;
    char *a_str = get_comparable_buf(decompressor, a, nullptr, &must_free_a);
    char *b_str = get_comparable_buf(decompressor, b, nullptr, &must_free_b);
    int res;

    res = strcmp(a_str, b_str);

    if (must_free_a) {
        selva_free(a_str);
    }
    if (must_free_b) {
        selva_free(b_str);
    }

    return res;
}

static int selva_string_cmp_alongz(struct libdeflate_decompressor *decompressor, const struct selva_string *a, const struct selva_string *b)
{
    size_t a_zlen;
    size_t a_ulen;
    const char *a_zstr = get_compressed_data(a, &a_zlen, &a_ulen);
    bool must_free_b;
    size_t b_ulen;
    char *b_str = get_comparable_buf(decompressor, b, &b_ulen, &must_free_b);
    struct libdeflate_block_state state;
    int res;

    state = libdeflate_block_state_init(DEFLATE_STRINGS_THRESHOLD_SIZE);
    res = libdeflate_memcmp(decompressor, &state, a_zstr, a_zlen, b_str, b_ulen);
    libdeflate_block_state_deinit(&state);

    if (must_free_b) {
        selva_free(b_str);
    }

    return res;
}

static int selva_string_cmp_blongz(struct libdeflate_decompressor *decompressor, const struct selva_string *a, const struct selva_string *b)
{
    return selva_string_cmp_alongz(decompressor, b, a);
}

/**
 *
 * - 0: a is compressed
 * - 1: b is compressed
 * - 2: a_ulen > DEFLATE_STRINGS_THRESHOLD_SIZE
 * - 3: b_len > DEFLATE_STRINGS_THRESHOLD_SIZE
 * - 4: b >= a
 */
static int (*const selva_string_cmp_fn[])(struct libdeflate_decompressor *decompressor, const struct selva_string *a, const struct selva_string *b) = {
    [0x00] = selva_string_cmp_unz, /* 00000, neither is compressed and b < a. */
    [0x04] = selva_string_cmp_unz, /* 00100. */
    [0x08] = selva_string_cmp_unz, /* 01000. */
    [0x0c] = selva_string_cmp_unz, /* 01100. */
    [0x10] = selva_string_cmp_unz, /* 10000, neither is compressed and b >= a. */
    [0x14] = selva_string_cmp_unz, /* 10100. */
    [0x18] = selva_string_cmp_unz, /* 11000. */
    [0x1c] = selva_string_cmp_unz, /* 11100. */
    [0x01] = selva_string_cmp_shortz, /* 00001, a is compressed and b < a. */
    [0x09] = selva_string_cmp_shortz, /* 01001. */
    [0x11] = selva_string_cmp_shortz, /* 10001, a is compressed and b >= a. */
    [0x19] = selva_string_cmp_shortz, /* 11001. */
    [0x06] = selva_string_cmp_shortz, /* 00110. */
    [0x02] = selva_string_cmp_shortz, /* 00010, b is compressed and b < a. */
    [0x12] = selva_string_cmp_shortz, /* 10010, b is compressed and b >= a. */
    [0x16] = selva_string_cmp_shortz, /* 10110. */
    [0x03] = selva_string_cmp_shortz, /* 00011, a and b are compressed and b < a. */
    [0x13] = selva_string_cmp_shortz, /* 10011, a and b are compressed and b >= a. */
    [0x05] = selva_string_cmp_alongz, /* 00101, a is compressed and a_uzlen > DEFLATE_STRINGS_THRESHOLD_SIZE and b < a. */
    [0x0d] = selva_string_cmp_alongz, /* 01101, */
    [0x15] = selva_string_cmp_alongz, /* 10101, a is compressed and a_uzlen > DEFLATE_STRINGS_THRESHOLD_SIZE and b >= a */
    [0x1d] = selva_string_cmp_alongz, /* 11101 */
    [0x0a] = selva_string_cmp_blongz, /* 01010, b is comressed and b_uzlen > DEFLATE_STRINGS_THRESHOLD_SIZE and b < a. */
    [0x0e] = selva_string_cmp_blongz, /* 01110, */
    [0x1a] = selva_string_cmp_blongz, /* 11010, b is comressed and b_uzlen > DEFLATE_STRINGS_THRESHOLD_SIZE and b <= a. */
    [0x1e] = selva_string_cmp_blongz, /* 11110, */
    [0x07] = selva_string_cmp_alongz, /* 00111, and b are compressed and a_uzlen > DEFLATE_STRINGS_THRESHOLD_SIZE. */
    [0x0b] = selva_string_cmp_blongz, /* 01011, a and b are compressed and b_uzlen > DEFLATE_STRINGS_THRESHOLD_SIZE and b < a. */
    [0x0f] = selva_string_cmp_alongz, /* 01111, a and b are compressed and uzlen > DEFLATE_STRINGS_THRESHOLD_SIZE and b < a. */
    [0x17] = selva_string_cmp_alongz, /* 10111. */
    [0x1b] = selva_string_cmp_blongz, /* 11011, */
    [0x1f] = selva_string_cmp_blongz, /* 11111, a and b are compressed and uzlen > DEFLATE_STRINGS_THRESHOLD_SIZE and b >= a. */
};

int selva_string_cmp(struct libdeflate_decompressor *decompressor, const struct selva_string *a, const struct selva_string *b)
{
    const unsigned z = (!!(a->flags & SELVA_STRING_COMPRESS)) | ((!!(b->flags & SELVA_STRING_COMPRESS)) << 1);
    const size_t a_ulen = selva_string_getz_ulen(a);
    const size_t b_ulen = selva_string_getz_ulen(b);
    const unsigned aget = (a_ulen > DEFLATE_STRINGS_THRESHOLD_SIZE) << 2;
    const unsigned bget = (b_ulen > DEFLATE_STRINGS_THRESHOLD_SIZE) << 3;
    const unsigned bgea = (b_ulen >= a_ulen) << 4;
    unsigned selector = z | aget | bget | bgea;

    if (z && !decompressor) {
        return 0;
    }

    return selva_string_cmp_fn[selector](decompressor, a, b);
}

int selva_string_endswith(const struct selva_string *s, const char *suffix)
{
    const size_t lensuffix = strlen(suffix);
    size_t len = selva_string_getz_ulen(s);

    if (lensuffix > len) {
        return 0;
    }

    bool must_free;
    char *str = get_comparable_buf(nullptr, s, nullptr, &must_free); /* TODO No support for compressed for now. */
    int res = !memcmp(str + len - lensuffix, suffix, lensuffix);

    if (must_free) {
        selva_free(str);
    }

    return res;
}
