/*
 * Copyright (c) 2023, 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stdio.h>
#include <ctype.h>
#include <stddef.h>
#include "cstrings.h"

long int strntol(const char *s, size_t n, const char **end)
{
    long int x = 0;
    long int m = 1;
    long int valid = 0;

    while (n && isspace(*s)) {
        s++;
        n--;
    }

    if (n) {
        const char c = *s;

        if (c == '-') {
            m = -1;
            s++;
            n--;
        } else if (c == '+') {
            s++;
            n--;
        }
    }

    while (n && isdigit(*s)) {
        x = x * 10 + (*s - '0');
        s++;
        n--;
        valid = 1;
    }

    if (end) {
        if (valid) {
            *end = s;
        } else {
            *end = nullptr;
        }
    }

    return x * m;
}
