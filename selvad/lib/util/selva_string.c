/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#define _GNU_SOURCE
#include <errno.h>
#include <stdarg.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "jemalloc.h"
#include "libdeflate.h"
#include "cdefs.h"
#include "selva_error.h"
#include "util/crc32c.h"
#include "util/finalizer.h"
#include "util/selva_string.h"

#define SELVA_STRING_QP(T, F, S, ...) \
    STATIC_IF(IS_POINTER_CONST((S)), \
              (T const *) (F) ((S) __VA_OPT__(,) __VA_ARGS__), \
              (T *) (F) ((S) __VA_OPT__(,) __VA_ARGS__))

struct selva_string {
    struct {
        uint64_t len: 48;
        enum selva_string_flags flags: 16;
    };
    /* Don't add __counted_by(len) here because it's not the real size. */
    union {
        char *p;
        char emb[sizeof(char *)];
    };
};

/**
 * Header before compressed string.
 * This is stored just before the actual string.
 */
struct compressed_string_header {
    /**
     * Uncompressed size of the string.
     */
    uint32_t uncompressed_size;
} __packed;

static struct libdeflate_compressor *compressor;
static struct libdeflate_decompressor *decompressor;

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
static char *get_comparable_buf(const struct selva_string *s, size_t *buf_len, bool *must_free)
{
    size_t len = selva_string_getz_ulen(s);
    char *buf;

    if (s->flags & SELVA_STRING_COMPRESS) {
        buf = selva_malloc(len + 1);
        selva_string_decompress(s, buf); /* RFE Should we return a NULL on error? */
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

    memcpy(&csum, get_buf(s) + s->len + 1, sizeof(csum));

    return csum;
}

/**
 * DO NOT CALL THIS FUNCTION IF CRC is not enabled.
 */
static void set_crc(struct selva_string *s, uint32_t csum)
{
    /*
     * Space for the CRC was hopefully allocated when alloc_immutable() or
     * alloc_mutable() was called.
     */
    memcpy(get_buf(s) + s->len + 1, &csum, sizeof(csum));
}

/**
 * Calculate the CRC of a selva_string.
 * @param hdr is the header part of a selva_string i.e. without the actual string.
 */
static uint32_t calc_crc(const struct selva_string *hdr, const char *str) __attribute__((pure, access(read_only, 1), access(read_only, 2)));
static uint32_t calc_crc(const struct selva_string *hdr, const char *str)
{
    uint32_t res;

    res = crc32c(0, hdr, sizeof(struct selva_string) - sizeof_field(struct selva_string, emb));
    res = crc32c(res, str, hdr->len + 1);
    return res;
}

static void update_crc(struct selva_string *s)
{
    if (s->flags & SELVA_STRING_CRC) {
        set_crc(s, calc_crc(s, get_buf(s)));
    }
}

[[nodiscard]]
static struct selva_string *alloc_mutable(size_t len)
{
    struct selva_string *s;

    s = selva_calloc(1, sizeof(struct selva_string));
    s->p = selva_malloc(len + 1);

    return s;
}

/**
 * Calculate the buffer size needed for an immuatable selva_string.
 */
static size_t calc_immutable_alloc_size(size_t len)
{
    const size_t emb_size = sizeof_field(struct selva_string, emb);
    const size_t add = len + 1 <= emb_size ? 0 : len + 1 - emb_size;

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

static struct selva_string *set_string(struct selva_string *s, const char *str, size_t len, enum selva_string_flags flags)
{
    char *buf;

    s->flags = (flags & ~SELVA_STRING_LEN_PARITY) | len_parity(len);
    s->len = len;

    buf = get_buf(s);
    if (str && len > 0) {
        memcpy(buf, str, len);
        buf[s->len] = '\0';
    } else {
        memset(buf, '\0', s->len + 1);
    }

    update_crc(s);
    return s;
}

struct selva_string *selva_string_create(const char *str, size_t len, enum selva_string_flags flags)
{
    const size_t trail = (flags & SELVA_STRING_CRC) ? sizeof(uint32_t) : 0;

    if ((flags & INVALID_FLAGS_MASK) ||
        test_mutually_exclusive_flags(flags, SELVA_STRING_FREEZE | SELVA_STRING_MUTABLE)) {
        return NULL; /* Invalid flags */
    }

    return (flags & SELVA_STRING_MUTABLE)
        ? set_string(alloc_mutable(len + trail), str, len, flags)
        : set_string(alloc_immutable(len + trail), str, len, flags);
}

struct selva_string *selva_string_createf(const char *fmt, ...)
{
    va_list args;
    int res;
    struct selva_string *s;

    va_start(args, fmt);
    res = vsnprintf(NULL, 0, fmt, args);
    va_end(args);

    if (res < 0) {
        return NULL;
    }

    s = selva_string_create(NULL, res, 0);
    if (!s) {
        return NULL;
    }

    va_start(args, fmt);
    (void)vsnprintf(get_buf(s), s->len + 1, fmt, args);
    va_end(args);

    return s;
}

struct selva_string *selva_string_fread(FILE *fp, size_t size, enum selva_string_flags flags)
{
    const enum selva_string_flags suppported_flags = SELVA_STRING_CRC | SELVA_STRING_COMPRESS;
    struct selva_string *s;

    flags &= suppported_flags;
    s = selva_string_create(NULL, size, flags);
    if (!s) {
        return NULL;
    }

    s->len = fread(get_buf(s), 1, size, fp);
    flags |= len_parity(s->len);

    update_crc(s);
    return s;
}

struct selva_string *selva_string_createz(const char *in_str, size_t in_len, enum selva_string_flags flags)
{
    const size_t trail = (flags & SELVA_STRING_CRC) ? sizeof(uint32_t) : 0;
    struct selva_string *s;
    size_t compressed_size;
    struct selva_string *tmp;

    if ((flags & (SELVA_STRING_MUTABLE | SELVA_STRING_MUTABLE_FIXED)) ||
        (flags & INVALID_FLAGS_MASK)) {
        return NULL; /* Invalid flags */
    }

    s = alloc_immutable(sizeof(struct compressed_string_header) + in_len + trail);
    compressed_size = libdeflate_deflate_compress(compressor, in_str, in_len, get_buf(s) + sizeof(struct compressed_string_header), in_len);
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
        struct compressed_string_header hdr;
        char *buf = get_buf(s);

        s->len = sizeof(hdr) + compressed_size;
        s->flags = flags | SELVA_STRING_COMPRESS | len_parity(s->len);
        memset(buf + s->len, '\0', sizeof(char));

        hdr.uncompressed_size = in_len;
        memcpy(buf, &hdr, sizeof(hdr));
    }

    tmp = selva_realloc(s, calc_immutable_alloc_size(s->len));
    if (tmp) {
        s = tmp;
    }

    update_crc(s);
    return s;
}

int selva_string_decompress(const struct selva_string * restrict s, char * restrict buf)
{
    if (s->flags & SELVA_STRING_COMPRESS) {
        struct compressed_string_header hdr;
        const void *data;
        size_t data_len;

        if (!verify_parity(s)) {
            abort();
        }

        memcpy(&hdr, get_buf(s), sizeof(hdr));
        data = get_buf(s) + sizeof(hdr);
        data_len = s->len - sizeof(hdr);

        size_t nbytes_out = 0;
        enum libdeflate_result res;

        res = libdeflate_deflate_decompress(decompressor, data, data_len, buf, hdr.uncompressed_size, &nbytes_out);
        if (res != 0 || nbytes_out != (size_t)hdr.uncompressed_size) {
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
        s->len = newlen;
        s->flags = (flags & ~SELVA_STRING_LEN_PARITY) | len_parity(newlen);
        s->p = selva_realloc(s->p, newlen + 1);
        s->p[newlen] = '\0';

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

        s->len += len;
        s->flags = (s->flags & ~SELVA_STRING_LEN_PARITY) | len_parity(s->len);
        s->p = selva_realloc(s->p, s->len + 1);
        if (str) {
            memcpy(s->p + old_len, str, len);
        } else {
            memset(s->p + old_len, 0, len);
        }
        s->p[s->len] = '\0';

        update_crc(s);
    }

    return 0;
}

int selva_string_replace(struct selva_string *s, const char *str, size_t len)
{
    const enum selva_string_flags flags = s->flags;

    if (flags & SELVA_STRING_MUTABLE_FIXED) {
        if (len != s->len) {
            return SELVA_EINVAL;
        }

        memcpy(s->emb, str, len);

        return 0;
    }

    if (flags & SELVA_STRING_MUTABLE) {
        s->len = len;
        s->flags = (flags & ~SELVA_STRING_LEN_PARITY) | len_parity(len);
        s->p = selva_realloc(s->p, len + 1);
        memcpy(s->p, str, len);

        return 0;
    }

    return SELVA_ENOTSUP;
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
        struct compressed_string_header hdr;

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
        struct compressed_string_header hdr;

        memcpy(&hdr, get_buf(s), sizeof(hdr));

        return (double)hdr.uncompressed_size / (double)(s->len - sizeof(hdr));
    } else {
        return 1;
    }
}

const char *selva_string_to_str(const struct selva_string *s, size_t *len)
{
    /* Compat with legacy. */
    if (!s) {
        if (len) {
            *len = 0;
        }
        return NULL;
    }

    if (len) {
        *len = s->len;
    }

    return get_buf(s);
}

char *selva_string_to_mstr(struct selva_string *s, size_t *len)
{
    /* Compat with legacy. */
    if (!s || !(s->flags & (SELVA_STRING_MUTABLE | SELVA_STRING_MUTABLE_FIXED))) {
        if (len) {
            *len = 0;
        }
        return NULL;
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
    *ll = strtoll(str, NULL, 10);
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
    *ull = strtoull(str, NULL, 10);
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
    *f = strtof(str, NULL);
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
    *d = strtod(str, NULL);
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
    *ld = strtold(str, NULL);
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
    return verify_parity(s) && (s->flags & SELVA_STRING_CRC) && get_crc(s) == calc_crc(s, get_buf(s));
}

uint32_t selva_string_get_crc(const struct selva_string *s)
{
    if (!(s->flags & SELVA_STRING_CRC)) {
        return 0;
    }

    return get_crc(s);
}

void selva_string_set_compress(struct selva_string *s)
{
    s->flags |= SELVA_STRING_COMPRESS;
}

int selva_string_cmp(const struct selva_string *a, const struct selva_string *b)
{
    bool must_free_a, must_free_b;
    char *a_str = get_comparable_buf(a, NULL, &must_free_a);
    char *b_str = get_comparable_buf(b, NULL, &must_free_b);
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

int selva_string_endswith(const struct selva_string *s, const char *suffix)
{
    const size_t lensuffix = strlen(suffix);
    size_t len;
    const char *str = selva_string_to_str(s, &len);

    return (lensuffix > len)
        ? 0
        : !strcmp(str + len - lensuffix, suffix);
}

ssize_t selva_string_strstr(const struct selva_string *s, const char *sub_str, size_t sub_len)
{
    bool must_free;
    size_t len;
    char *str = get_comparable_buf(s, &len, &must_free);
    char *pos;
    ssize_t i;

    pos = memmem(str, len, sub_str, sub_len);
    i = pos ? (ssize_t)(pos - str) : -1;

    if (must_free) {
        selva_free(str);
    }

    return i;
}

__constructor static void init_compressor(void)
{
    /* TODO How to configure compression level? */
    compressor = libdeflate_alloc_compressor(6);
    if (!compressor) {
        abort();
    }

    decompressor = libdeflate_alloc_decompressor();
    if (!decompressor) {
        abort();
    }
}

/* FIXME freeing the compressor crashes the io child process at exit. */
#if 0
__destructor static void deinit_compressor(void)
{
    libdeflate_free_compressor(compressor);
    compressor = NULL;

    libdeflate_free_decompressor(decompressor);
    decompressor = NULL;
}
#endif
