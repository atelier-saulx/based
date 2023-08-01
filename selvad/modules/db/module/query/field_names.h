/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#define WILDCARD_CHAR '*'

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

static inline struct selva_string *make_full_field_name(struct finalizer *fin, const char *field_prefix_str, size_t field_prefix_len, struct selva_string *field)
{
    struct selva_string *full_field_name;

    if (field_prefix_str && field_prefix_len > 0) {
        TO_STR(field);

        full_field_name = selva_string_createf("%.*s%s", (int)field_prefix_len, field_prefix_str, field_str);
        finalizer_add(fin, full_field_name, selva_string_free);
    } else {
        full_field_name = field;
    }

    return full_field_name;
}

static inline const char *make_full_field_name_str(struct finalizer *fin, const char *field_prefix_str, size_t field_prefix_len, const char *field_str, size_t field_len, size_t *len_out)
{
    if (field_prefix_str && field_prefix_len > 0) {
        struct selva_string *full_field_name;

        full_field_name = selva_string_createf("%.*s%.*s", (int)field_prefix_len, field_prefix_str, (int)field_len, field_str);
        finalizer_add(fin, full_field_name, selva_string_free);

        return selva_string_to_str(full_field_name, len_out);
    } else {
        *len_out = field_len;
        return field_str;
    }
}
