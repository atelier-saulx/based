/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include "parsers.h"

struct finalizer;
struct selva_string;

struct selva_string **parse_index_hints(struct finalizer *fin, const char *index_hints_str, size_t index_hints_len, int *nr_index_hints_out)
{
    struct selva_string **index_hints;
    const struct selva_string *s;
    int nr_index_hints = 0;

    index_hints = parse_string_list(fin, index_hints_str, index_hints_len, '\0');

    s = index_hints[0];
    while (s) {
        s = index_hints[++nr_index_hints];
        if (nr_index_hints >= SELVA_INDEX_MAX_HINTS_CMD) {
            break;
        }
    }

    *nr_index_hints_out = nr_index_hints;
    return index_hints;
}
