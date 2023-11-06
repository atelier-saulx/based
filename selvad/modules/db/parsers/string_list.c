/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <string.h>
#include "jemalloc.h"
#include "util/finalizer.h"
#include "util/selva_string.h"
#include "parsers.h"

struct selva_string **parse_string_list(
        struct finalizer *fin,
        const char *in_str,
        size_t in_len,
        int separator)
{
    struct selva_string **list = NULL;
    const char *cur = in_str;
    ssize_t left = in_len;
    size_t n = 1;

    list = selva_realloc(list, sizeof(struct selva_string *));
    list[0] = NULL;

    while (left > 0) {
        struct selva_string *el;
        const char *next;
        size_t len;

        /*
         * Find the separator between the current and the next string.
         */
        next = memchr(cur, separator, left) ?: cur + left;
        len = (size_t)((ptrdiff_t)next - (ptrdiff_t)cur);

        /*
         * Create a string.
         */
        el = selva_string_create(cur, len, 0);
        selva_string_auto_finalize(fin, el);

        /*
         * Set to the array.
         */
        list = selva_realloc(list, ++n * sizeof(struct selva_string *));
        list[n - 2] = el;
        list[n - 1] = NULL;

        cur = next + 1;
        left -= len + 1;
    }

    finalizer_add(fin, list, selva_free);
    return list;
}
