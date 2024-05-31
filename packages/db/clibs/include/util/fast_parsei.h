/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef _UTIL_FAST_PARSEI_H_
#define _UTIL_FAST_PARSEI_H_

/**
 * Like atoi but faster and more unsafe.
 * This is way faster than strtoll() in glibc.
 */
static inline int fast_atou(const char *str)
{
    int n = 0;

    while (*str >= '0' && *str <= '9') {
        n = n * 10 + (int)(*str++) - '0';
    }

    return n;
}

/**
 * Like strtol but faster and more unsafe.
 * This is way faster than strtoll() in glibc.
 */
static inline int fast_strtou(const char *str, const char **end)
{
    int n = 0;

    while (*str >= '0' && *str <= '9') {
        n = n * 10 + (int)(*str++) - '0';
    }

    *end = str;
    return n;
}

#endif /* _UTIL_FAST_PARSEI_H_ */
