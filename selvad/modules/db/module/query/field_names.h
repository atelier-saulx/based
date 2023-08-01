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
