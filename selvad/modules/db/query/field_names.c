/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#define _GNU_SOURCE
#include <stdint.h>
#include <string.h>
#include <sys/types.h>
#include "util/cstrings.h"
#include "util/finalizer.h"
#include "util/selva_string.h"
#include "selva_db.h"
#include "field_names.h"

struct selva_string *make_full_field_name(struct finalizer *fin, const char *field_prefix_str, size_t field_prefix_len, struct selva_string *field)
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

const char *make_full_field_name_str(struct finalizer *fin, const char *field_prefix_str, size_t field_prefix_len, const char *field_str, size_t field_len, size_t *len_out)
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

struct selva_string *deprefix_excluded_fields(
        struct finalizer *fin,
        struct selva_string *excluded_fields,
        const char *field_str, size_t field_len,
        const char *next_field_str, size_t next_field_len)
{
    TO_STR(excluded_fields);
    size_t field_stop;
    char new_excluded_fields_str[excluded_fields_len + 1];
    size_t new_excluded_fields_len;
    struct selva_string *new_excluded_fields;

    if (iswildcard(next_field_str, next_field_len)) {
        field_stop = field_len - 1;
    } else {
        const char *s = memchr(field_str, '.', field_len);

        if (s) {
            field_stop = (size_t)(s - field_str + 1);
        } else {
            /* RFE is this a case? */
            field_stop = field_len;
        }
    }

    stringlist_remove_prefix(new_excluded_fields_str, excluded_fields_str, (int)excluded_fields_len, field_str, field_stop);
    new_excluded_fields_len = strlen(new_excluded_fields_str);

    if (new_excluded_fields_len == 0) {
        return NULL;
    }

    new_excluded_fields = selva_string_createf(new_excluded_fields_str, new_excluded_fields_len);
    finalizer_add(fin, new_excluded_fields, selva_string_free);

    return new_excluded_fields;
}
