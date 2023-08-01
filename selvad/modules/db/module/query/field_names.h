/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#define WILDCARD_CHAR '*'

struct finalizer;
struct selva_string;

static inline int iswildcard(const char *field_str, size_t field_len)
{
    return field_len == 1 && field_str[0] == WILDCARD_CHAR;
}

static inline int containswildcard(const char *field_str, size_t field_len)
{
    const char pattern[3] = {'.', WILDCARD_CHAR, '.'};

    return !!memmem(field_str, field_len, pattern, sizeof(pattern));
}

static inline int endswithwildcard(const char *field_str, size_t field_len)
{
    return field_len >= 2 && field_str[field_len - 2] == '.' && field_str[field_len - 1] == WILDCARD_CHAR;
}

static inline int is_edgemeta(const char *field_str, size_t field_len)
{
    return field_len >= sizeof(SELVA_EDGE_META_FIELD) - 1 &&
           !memcmp(field_str, SELVA_EDGE_META_FIELD, sizeof(SELVA_EDGE_META_FIELD) - 1) &&
           (field_len == sizeof(SELVA_EDGE_META_FIELD) - 1 ||
            (field_len >= sizeof(SELVA_EDGE_META_FIELD) && field_str[sizeof(SELVA_EDGE_META_FIELD) - 1] == '.'));
}

struct selva_string *make_full_field_name(struct finalizer *fin, const char *field_prefix_str, size_t field_prefix_len, struct selva_string *field);

const char *make_full_field_name_str(struct finalizer *fin, const char *field_prefix_str, size_t field_prefix_len, const char *field_str, size_t field_len, size_t *len_out);

struct selva_string *deprefix_excluded_fields(
        struct finalizer *fin,
        struct selva_string *excluded_fields,
        const char *field_str, size_t field_len,
        const char *next_field_str, size_t next_field_len);
