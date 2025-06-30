/*
 * Copyright (c) 2023, 2025 SAULX
 * Copyright (c) 2018 ozonesecurity
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdint.h>
#include "cstrings.h"

char *mempbrk(const char * restrict s, size_t len, const char * restrict accept, size_t accept_len)
{
    if (len == 0 || !s || !accept) {
        return 0;
    }

    for (size_t i = 0; i < len; s++, i++) {
        for (size_t j = 0; j < accept_len; j++) {
            if (*s == accept[j]) {
                return (char *)s;
            }
        }
    }

    return nullptr;
}
