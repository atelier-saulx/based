/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#define WILDCARD_CHAR '*'

struct finalizer;
struct selva_string;

__attribute__((pure, access(read_only, 1, 2))) static inline int iswildcard(const char *field_str, size_t field_len)
{
    return field_len == 1 && field_str[0] == WILDCARD_CHAR;
}

__attribute__((pure, access(read_only, 1, 2))) static inline int containswildcard(const char *field_str, size_t field_len)
{
    const char pattern[3] = {'.', WILDCARD_CHAR, '.'};

    return !!memmem(field_str, field_len, pattern, sizeof(pattern));
}

__attribute__((pure, access(read_only, 1, 2))) static inline int endswithwildcard(const char *field_str, size_t field_len)
{
    return field_len >= 2 && field_str[field_len - 2] == '.' && field_str[field_len - 1] == WILDCARD_CHAR;
}

/**
 * Make a full field name prefix + field.
 * prefix can be empty or NULL. If a new string is returned it's also added to fin.
 * The function may also return the original string.
 */
[[nodiscard]]
struct selva_string *make_full_field_name(
        struct finalizer *fin,
        const char *field_prefix_str,
        size_t field_prefix_len,
        struct selva_string *field)
    __attribute__((access(read_only, 2, 3), access(read_only, 4)));

/**
 * Make a full field name prefix + field.
 * prefix can be empty or NULL. If a new string is returned it's also added to fin.
 * The function may also return the original string.
 */
[[nodiscard]]
const char *make_full_field_name_str(
        struct finalizer *fin,
        const char *field_prefix_str, size_t field_prefix_len,
        const char *field_str, size_t field_len,
        size_t *len_out)
    __attribute__((access(read_only, 2, 3), access(read_only, 4, 5), access(write_only, 6)));

struct selva_string *deprefix_excluded_fields(
        struct finalizer *fin,
        const struct selva_string *excluded_fields,
        const char *field_str, size_t field_len,
        const char *next_field_str, size_t next_field_len)
    __attribute__((access(read_only, 2), access(read_only, 3, 4), access(read_only, 5, 6)));
