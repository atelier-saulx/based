/*
 * Copyright (c) 2022-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stdint.h>
#include <sys/types.h>
#include "selva/_export.h"

struct finalizer;
struct selva_string;
struct libdeflate_compressor;
struct libdeflate_decompressor;

/**
 * Selva string flags.
 */
enum selva_string_flags {
    /**
     * CRC enabled.
     * For compressed string this is for the uncompressed string.
     */
    SELVA_STRING_CRC = 0x01,
    /**
     * Permanently shared string; Shouldn't be freed.
     */
    SELVA_STRING_FREEZE = 0x02,
    /**
     * A mutable string.
     */
    SELVA_STRING_MUTABLE = 0x04,
    /**
     * Fixed size mutable string.
     * Mutable only with selva_string_replace() and selva_string_to_mstr().
     */
    SELVA_STRING_MUTABLE_FIXED = 0x08,
    /**
     * Static string.
     * The selva_string structure is not allocated by selva_string.
     */
    SELVA_STRING_STATIC = 0x10,
    /**
     * Compressed string.
     */
    SELVA_STRING_COMPRESS = 0x20,
    SELVA_STRING_LEN_PARITY =  0x80,
} __packed;

#define INVALID_FLAGS_MASK (~(SELVA_STRING_CRC | SELVA_STRING_FREEZE | SELVA_STRING_MUTABLE | SELVA_STRING_MUTABLE_FIXED | SELVA_STRING_STATIC | SELVA_STRING_COMPRESS | SELVA_STRING_LEN_PARITY))

/**
 * Header before compressed string.
 * This is stored just before the actual string.
 * Currently the compression used is raw DEFLATE.
 */
struct selva_string_compressed_hdr {
    /* TODO uint8_t type header here. */
    /**
     * Uncompressed size of the string.
     */
    uint32_t uncompressed_size;
} __packed;

#define SELVA_STRING_STRUCT_SIZE 16
#ifndef __zig
struct selva_string {
    struct {
        uint64_t len: 56;
        enum selva_string_flags flags: 8;
    };
    /* Don't add __counted_by(len) here because it's not the real size. */
    union {
        char *p;
        char emb[sizeof(char *)];
    };
};
static_assert(sizeof(struct selva_string) == SELVA_STRING_STRUCT_SIZE);

/* RFE is + 1 extra? */
#define SELVA_STRING_STATIC_BUF_SIZE(len) \
    (((len + 1) < sizeof(char *)) ? 0 : len + 1 - sizeof(char *))

/* RFE is + 1 extra? */
#define SELVA_STRING_STATIC_BUF_SIZE_WCRC(len) \
    (((len + 1 + sizeof(uint32_t)) < sizeof(char *)) ? 0 : len + 1 - sizeof(char *) + sizeof(uint32_t))

#define SELVA_STRING_STATIC_S(name, len) \
    struct { \
        struct selva_string name; \
        char name ## buf[SELVA_STRING_STATIC_BUF_SIZE(len)]; \
    }

#define SELVA_STRING_STATIC_S_WCRC(name, len) \
    struct { \
        struct selva_string name; \
        char name ## buf[SELVA_STRING_STATIC_BUF_SIZE_WCRC(len)]; \
    }
#endif

void selva_string_init_tls(void);
void selva_string_deinit_tls(void);

/**
 * Initialize a statically allocated selva_string.
 * Note that the string buffer doesn't need to be statically allocated, just the struct.
 * The `SELVA_STRING_STATIC` macro should be used to also allocate the buffer statically
 * with a fixed size.
 * If `SELVA_STRING_MUTABLE_FIXED` is given then the buffer following the string must be large
 * enough.
 * @param str can be NULL if a mutable flag is set.
 */
SELVA_EXPORT
int selva_string_init(struct selva_string *s, const char *str, size_t len, enum selva_string_flags flags);


/**
 * Same as selva_string_init() but with a precalculated CRC32-C.
 */
SELVA_EXPORT
int selva_string_init_crc(struct selva_string *s, const char *str, size_t len, uint32_t crc, enum selva_string_flags flags);

/**
 * Create a new string.
 * @param str can be NULL.
 */
[[nodiscard]]
SELVA_EXPORT
struct selva_string *selva_string_create(const char *str, size_t len, enum selva_string_flags flags)
    __attribute__((access(read_only, 1)));

/**
 * Create a new string with a user provided CRC.
 * @param str can be NULL.
 */
SELVA_EXPORT
struct selva_string *selva_string_create_crc(const char *str, size_t len, enum selva_string_flags flags, uint32_t crc)
    __attribute__((access(read_only, 1, 2)));

/**
 * Create a string using a printf format string.
 */
[[nodiscard]]
SELVA_EXPORT
struct selva_string *selva_string_createf(const char *fmt, ...)
    __attribute__((format(printf, 1, 2)));

#if defined(_STDIO_H) || defined(_STDIO_H_)
/**
 * Read a string from a file directly into a new selva_string.
 * If the resulting string is shorter than `size` an errno is set. Use the
 * ferror() and feof() functions to distinguish between a read error and an
 * end-of-file.
 * @param flags can be SELVA_STRING_CRC | SELVA_STRING_COMPRESS.
 */
[[nodiscard]]
SELVA_EXPORT
struct selva_string *selva_string_fread(FILE *fp, size_t size, enum selva_string_flags flags);
#endif

/**
 * Create a compressed string.
 * Note that most of the selva_string functions don't know how to handle with
 * compressed strings and will just assume it's a regular string.
 * @param flags Compressed strings can't handle most of the flags but notably
 *              SELVA_STRING_CRC is supported.
 */
[[nodiscard]]
SELVA_EXPORT
struct selva_string *selva_string_createz(struct libdeflate_compressor *compressor, const char *in_str, size_t in_len, enum selva_string_flags flags)
    __attribute__((access(read_only, 2, 3)));

/**
 * Decompress a compressed string.
 * @param s is a pointer to a compressed selva_string.
 * @param buf is the destination where the decompressed string will be copied to.
 *            The size of the buffer must be at least selva_string_getz_ulen(s) bytes.
 * @returns 0 if succeeded;
 *          SELVA_PROTO_EINTYPE if not a compressed string;
 *          SELVA_EINVAL if the string cannot be decompressed.
 */
SELVA_EXPORT
int selva_string_decompress(struct libdeflate_decompressor *decompressor, const struct selva_string * restrict s, char * restrict buf)
    __attribute__((access(read_only, 2), access(write_only, 3)));

/**
 * Duplicate a string.
 * @param s is a pointer to a selva_string.
 */
[[nodiscard]]
SELVA_EXPORT
struct selva_string *selva_string_dup(const struct selva_string *s, enum selva_string_flags flags)
    __attribute__((access(read_only, 1)));

/**
 * Truncate the string s to a new length of newlen.
 * @param s is a pointer to a selva_string. Must be mutable.
 * @param newlen is the new length of the string.
 * @returns 0 if succeeded; Otherwise an error code.
 */
SELVA_EXPORT
int selva_string_truncate(struct selva_string *s, size_t newlen)
    __attribute__((access(read_write, 1)));

/**
 * Append str of length len to the string s.
 * @param s is a pointer to a selva_string. Must be mutable.
 * @returns 0 if succeeded; Otherwise an error code.
 */
SELVA_EXPORT
int selva_string_append(struct selva_string *s, const char *str, size_t len)
    __attribute__((access(read_only, 2)));

/**
 * Replace current value of the string s with str.
 * @param s must be mutable.
 * @returns 0 if succeeded; Otherwise an error code.
 */
SELVA_EXPORT
int selva_string_replace(struct selva_string *s, const char *str, size_t len)
    __attribute__((access(read_only, 2, 3)));

/**
 * Replace current value of the string s with str and an externally computed crc.
 * @param s must be mutable.
 * @returns 0 if succeeded; Otherwise an error code.
 */
SELVA_EXPORT
int selva_string_replace_crc(struct selva_string *s, const char *str, size_t len, uint32_t crc)
    __attribute__((access(read_only, 2, 3)));

/**
 * Allows selva_string_free() to be passed to finalizer_add() and other similar
 * functions accepting void functions.
 */
typedef union {
    struct selva_string *__s;
    void *__p;
} _selva_string_ptr_t __transparent_union;


/**
 * Free the strings s.
 * @param s is a pointer to a selva_string.
 */
SELVA_EXPORT
#if __zig
void selva_string_free(struct selva_string *s);
#else
void selva_string_free(_selva_string_ptr_t s);
#endif

/**
 * Add a selva_string to the given finalizer.
 * @param finalizer is a pointer to a finalizer.
 * @param s is a pointer to a selva_string.
 */
SELVA_EXPORT
void selva_string_auto_finalize(struct finalizer *finalizer, struct selva_string *s);

/**
 * Get the currently set flags of the string s.
 * @param s is a pointer to a selva_string.
 */
SELVA_EXPORT
enum selva_string_flags selva_string_get_flags(const struct selva_string *s)
    __attribute__((access(read_only, 1)));

/**
 * Get string length.
 * If the string is compressed then the length returned is the compressed
 * length including any metadata related to the compression algorithm.
 */
SELVA_EXPORT
size_t selva_string_get_len(const struct selva_string *s)
    __attribute__((access(read_only, 1)));

/**
 * Get uncompressed length.
 * The function will return the right size regardless whether the string is
 * actually compressed.
 */
SELVA_EXPORT
size_t selva_string_getz_ulen(const struct selva_string *s)
    __attribute__((access(read_only, 1)));

/**
 * Get compression ratio.
 */
SELVA_EXPORT
double selva_string_getz_cratio(const struct selva_string *s)
    __attribute__((access(read_only, 1)));

/**
 * Get the raw buffer including CRC.
 */
SELVA_EXPORT
const uint8_t *selva_string_to_buf(const struct selva_string *s, size_t *size)
    __attribute__((access(write_only, 2)));

/**
 * Get a pointer to the contained C-string.
 * If the string is compressed then the compressed string is returned.
 * selva_string_decompress() can be used to retrieve the original string.
 * @param s is a pointer to a selva_string.
 * @param[out] len is a pointer to a variable to store the length of s.
 * @retruns Returns a pointer to the C-string.
 */
SELVA_EXPORT
const char *selva_string_to_str(const struct selva_string *s, size_t *len)
    __attribute__((access(write_only, 2)));

/**
 * Get a pointer to the mutable C-string.
 * @param s is a pointer to a selva_string.
 * @param[out] len is a pointer to a variable to store the length of s.
 * @returns Returns a pointer to the C-string if the string is mutable; Otherwise a NULL pointer is returned.
 */
SELVA_EXPORT
char *selva_string_to_mstr(struct selva_string *s, size_t *len)
    __attribute__((access(write_only, 2)));

/**
 * Convert a string into a long long integer.
 */
SELVA_EXPORT
int selva_string_to_ll(const struct selva_string *s, long long *ll)
    __attribute__((access(write_only, 2)));

/**
 * Convert a string into an unsigned long long integer.
 */
SELVA_EXPORT
int selva_string_to_ull(const struct selva_string *s, unsigned long long *ull)
    __attribute__((access(write_only, 2)));

/**
 * Convert a string into a float.
 */
SELVA_EXPORT
int selva_string_to_float(const struct selva_string *s, float *f)
    __attribute__((access(write_only, 2)));

/**
 * Convert a string into a double.
 */
SELVA_EXPORT
int selva_string_to_double(const struct selva_string *s, double *d)
    __attribute__((access(write_only, 2)));

/**
 * Convert a string into a long double.
 */
SELVA_EXPORT
int selva_string_to_ldouble(const struct selva_string *s, long double *ld)
    __attribute__((access(write_only, 2)));

/**
 * Freeze the string s in memory.
 * Freezing a string allows sharing it in memory between multiple users and
 * disallows freeing it until the program exits.
 * This function can be called even if the string is immutable.
 * @param s is a pointer to a selva_string.
 */
SELVA_EXPORT
void selva_string_freeze(struct selva_string *s)
    __attribute((access(read_write, 1)));

/**
 * Verify the CRC of the string s.
 * If the string is compressed the CRC is computed from the compressed data.
 * @param s is a pointer to a selva_string.
 */
SELVA_EXPORT
int selva_string_verify_crc(const struct selva_string *s)
    __attribute((access(read_only, 1)));

/**
 * Get the CRC of the string s.
 */
SELVA_EXPORT
uint32_t selva_string_get_crc(const struct selva_string *s)
    __attribute((access(read_only, 1)));

SELVA_EXPORT
void selva_string_set_crc(struct selva_string *s, uint32_t csum);

/**
 * Set SELVA_STRING_COMPRESS flag on an existing string.
 * Setting the flag won't compress the string but mark it as compressed;
 * i.e. it's only a metadata update.
 * This function should be used if you know that you have a selva_string
 * that has been marked as uncompressed but it actually contains data that
 * the selva_string compression utility will recognize properly. Usually
 * meaning that the data was originally compressed using selva_string.
 */
SELVA_EXPORT
void selva_string_set_compress(struct selva_string *s)
    __attribute__((access(read_write, 1)));

/**
 * Compare two strings.
 * This function works correctly with compressed strings.
 * @param decompress can be nullptr if strings are not compressed.
 * @param a is a pointer to the first string to be compared.
 * @param b is a pointer to the second strings to be compared.
 * @returns < 0 if the first character that does not match has a lower value in ptr1 than in ptr2;
 *            0 if the contents of both strings are equal;
 *          > 0 if the first character that does not match has a greater value in ptr1 than in ptr2.
 */
SELVA_EXPORT
int selva_string_cmp(struct libdeflate_decompressor *decompressor, const struct selva_string *a, const struct selva_string *b)
    __attribute__((access(read_only, 1), access(read_only, 2)));

/**
 * Test if a string ends with suffix.
 * This function works correctly with compressed strings.
 */
SELVA_EXPORT
int selva_string_endswith(const struct selva_string *s, const char *suffix)
    __attribute__((access(read_only, 1), access(read_only, 2)));

#define TO_STR_1(_var) \
    size_t _var##_len; \
    const char * _var##_str = selva_string_to_str(_var, & _var##_len);

#define TO_STR_2(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_1(__VA_ARGS__)

#define TO_STR_3(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_2(__VA_ARGS__)

#define TO_STR_4(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_3(__VA_ARGS__)

#define TO_STR_5(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_4(__VA_ARGS__)

#define TO_STR_6(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_5(__VA_ARGS__)

#define TO_STR_7(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_6(__VA_ARGS__)

#define TO_STR_8(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_7(__VA_ARGS__)

#define TO_STR_9(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_7(__VA_ARGS__)

#define TO_STR_10(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_9(__VA_ARGS__)

#define TO_STR_11(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_10(__VA_ARGS__)

#define TO_STR_12(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_11(__VA_ARGS__)

#define TO_STR_13(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_12(__VA_ARGS__)

#define TO_STR_14(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_13(__VA_ARGS__)

#define TO_STR_15(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_14(__VA_ARGS__)

#define TO_STR_16(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_15(__VA_ARGS__)

#define TO_STR_17(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_16(__VA_ARGS__)

#define TO_STR_18(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_17(__VA_ARGS__)

#define TO_STR_19(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_18(__VA_ARGS__)

#define TO_STR_20(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_19(__VA_ARGS__)

#define TO_STR_21(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_20(__VA_ARGS__)

#define TO_STR_22(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_21(__VA_ARGS__)

#define TO_STR_23(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_22(__VA_ARGS__)

#define TO_STR_24(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_23(__VA_ARGS__)

#define TO_STR_25(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_24(__VA_ARGS__)

#define TO_STR_26(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_25(__VA_ARGS__)

#define TO_STR_27(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_26(__VA_ARGS__)

#define TO_STR_28(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_27(__VA_ARGS__)

#define TO_STR_29(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_28(__VA_ARGS__)

#define TO_STR_30(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_29(__VA_ARGS__)

#define TO_STR_31(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_30(__VA_ARGS__)

#define TO_STR_32(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_31(__VA_ARGS__)

#define TO_STR_33(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_32(__VA_ARGS__)

#define TO_STR_34(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_33(__VA_ARGS__)

#define TO_STR_35(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_34(__VA_ARGS__)

#define TO_STR_36(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_35(__VA_ARGS__)

#define TO_STR_37(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_36(__VA_ARGS__)

#define TO_STR_38(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_37(__VA_ARGS__)

#define TO_STR_39(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_38(__VA_ARGS__)

#define TO_STR_40(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_39(__VA_ARGS__)

#define TO_STR_41(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_40(__VA_ARGS__)

#define TO_STR_42(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_41(__VA_ARGS__)

#define TO_STR_43(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_42(__VA_ARGS__)

#define TO_STR_44(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_43(__VA_ARGS__)

#define TO_STR_45(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_44(__VA_ARGS__)

#define TO_STR_46(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_45(__VA_ARGS__)

#define TO_STR_47(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_46(__VA_ARGS__)

#define TO_STR_48(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_47(__VA_ARGS__)

#define TO_STR_49(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_48(__VA_ARGS__)

#define TO_STR_50(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_49(__VA_ARGS__)

#define TO_STR_51(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_50(__VA_ARGS__)

#define TO_STR_52(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_51(__VA_ARGS__)

#define TO_STR_53(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_52(__VA_ARGS__)

#define TO_STR_54(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_53(__VA_ARGS__)

#define TO_STR_55(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_54(__VA_ARGS__)

#define TO_STR_56(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_55(__VA_ARGS__)

#define TO_STR_57(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_56(__VA_ARGS__)

#define TO_STR_58(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_57(__VA_ARGS__)

#define TO_STR_59(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_58(__VA_ARGS__)

#define TO_STR_60(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_59(__VA_ARGS__)

#define TO_STR_61(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_60(__VA_ARGS__)

#define TO_STR_62(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_61(__VA_ARGS__)

#define TO_STR_63(_var, ...) \
    TO_STR_1(_var) \
    TO_STR_62(__VA_ARGS__)

/**
 * Create C-string pointer variable(s) from `RedisModuleString` pointer(s).
 * If `name` is a pointer to `RedisModuleString` then this macro will define
 * symbols `name_str` and `name_len`. `name_str` is a `const char` pointer to
 * the C-string representation of `name` and `name_len` is a `size_t` variable
 * containing the the length of `name`.
 */
#define TO_STR(...) \
        CONCATENATE(TO_STR_, UTIL_NARG(__VA_ARGS__))(__VA_ARGS__)
