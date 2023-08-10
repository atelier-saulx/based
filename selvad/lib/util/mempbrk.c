/*
 * Copyright (c) 2023 SAULX
 * Copyright (c) 2018 ozonesecurity
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <string.h>
#include "util/cstrings.h"

char *mempbrk(register const char * restrict s, const char * restrict accept, size_t limit)
{
    if (limit <= 0 || !s || !accept || !*accept) {
        return 0;
    }

    const size_t acc_len = strlen(accept);

    for (size_t i = 0; i < limit; s++, i++) {
        for (size_t j = 0; j < acc_len; j++) {
            if (*s == accept[j]) {
                return (char *)s;
            }
        }
    }

    return NULL;
}
