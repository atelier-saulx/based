/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <string.h>
#include "jemalloc.h"
#include "util/finalizer.h"
#include "util/selva_string.h"

struct selva_string **string_list_parse(
        struct finalizer *fin,
        const char *in_str,
        size_t in_len)
{
    const char *cur = in_str;
    size_t left = in_len;
    struct selva_string **list = NULL;
    size_t n = 1;

    const size_t list_size = n * sizeof(struct selva_string *);
    list = selva_realloc(list, list_size);

    list[n - 1] = NULL;
    if (cur[0] != '\0' || in_len > 0) {
        do {
            struct selva_string *el;
            const char *next;
            size_t len;

            /*
             * Find the separator between the current and the next string.
             */
            next = memchr(cur, '\0', left) ?: cur + left;
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
        } while (left);
    }

    finalizer_add(fin, list, selva_free);
    return list;
}
