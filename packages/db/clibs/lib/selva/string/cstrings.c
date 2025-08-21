/*
 * Copyright (c) 2020-2023, 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#define _GNU_SOURCE
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include "jemalloc_selva.h"
#include "cstrings.h"

static inline uint64_t b2digits(uint64_t x)
{
    return x ? 64 - __builtin_clzll(x) : 0;
}

uint64_t b10digits(uint64_t x)
{
    static const unsigned char guess[65] = {
        0 , 0 , 0 , 0 , 1,  1 , 1 , 2 , 2 , 2 ,
        3 , 3 , 3 , 3 , 4,  4 , 4 , 5 , 5 , 5 ,
        6 , 6 , 6 , 6 , 7,  7 , 7 , 8 , 8 , 8 ,
        9 , 9 , 9 , 9 , 10, 10, 10, 11, 11, 11,
        12, 12, 12, 12, 13, 13, 13, 14, 14, 14,
        15, 15, 15, 15, 16, 16, 16, 17, 17, 17,
        18, 18, 18, 18, 19
    };
    static const uint64_t ten[] = {
        1u,
        10u,
        100u,
        1000u,
        10000u,
        100000u,
        1000000u,
        10000000u,
        100000000u,
        1000000000u,
        10000000000u,
        100000000000u,
        1000000000000u,
        10000000000000u,
        100000000000000u,
        1000000000000000u,
        10000000000000000u,
        100000000000000000u,
        1000000000000000000u,
        10000000000000000000u,
    };

    if (x == 0) {
        return 1;
    };

    uint64_t digits = guess[b2digits(x)];
    return digits + (x >= ten[digits]);
}

char *selva_strndup(const char *s, size_t n)
{
  const size_t len = strnlen(s, n);
  char *copy = selva_malloc(len + 1);

  memcpy(copy, s, len);
  copy[len] = '\0';

  return copy;
}

char *selva_strdup(const char *s)
{
    const size_t len = strlen(s);
    char *copy = selva_malloc(len + 1);

    memcpy(copy, s, len);
    copy[len] = '\0';

    return copy;
}

int stringlist_search(const char *list, const char *str, size_t n, char wildcard)
{
    const char *s1 = list;

    /* Never match if `str` is empty. */
    if (!str || str[0] == '\0' || n == 0) {
        return 0;
    }

    /* Always match if `str` is non-empty and `list` starts with a wildcard. */
    if (wildcard != '\0' && list[0] == wildcard && list[1] == '\0') {
        return 1;
    }

    /* Note that if `list` is empty then we'll immediately return 0. */
    while (*s1 != '\0') {
        ssize_t i = n;
        const char *s2 = str;

was_wildcard:
        while (i-- >= 0 && *s1 && *s2 && *s1++ == *s2++);
        --s1;
        --s2;

        if (!(i == (ssize_t)(-1))) {
            if (wildcard != '\0' && *s1 == wildcard && s1 > list && *(s1 - 1) == '.') {
                const char *s1n = strchr(s1, '.');
                if (!s1n) {
                    goto next;
                }

                const size_t left = n - (s2 - str);
                const char *s2n = memchr(s2, '.', left);
                if (s2n) {
                    s1 = s1n;
                    i = n - (s2n - str);
                    s2 = s2n;
                    goto was_wildcard;
                } else {
                    goto next;
                }
            }
        } else {
            if ((s1[0] == '\n' || s1[0] == '\0') ||
                (s1[1] == '\0' || s1[1] == '\n')) {
                return 1;
            }
        }

        /* Skip the rest of the current field */
next:
        while (*s1 != '\0') {
            s1++;
            if (*s1 == '\n') {
                s1++;
                break;
            }
        }
    }

    return 0;
}

static char * prefixed_only_cpy(char *dst, const char *src, size_t len, const char *prefix_str, size_t prefix_len)
{
    if (len > prefix_len && !strncmp(src, prefix_str, prefix_len)) {
        size_t cpy_len = len - prefix_len;

        memcpy(dst, src + prefix_len, cpy_len);
        return dst + cpy_len;
    }

    return dst;
}

void stringlist_remove_prefix(char *dst, const char *src, int len, const char *prefix_str, size_t prefix_len)
{
    const char *dst_start = dst;
    const char *s = src;

    if (len <= 0) {
        return;
    }

    dst[0] = '\0';

    while (len > 0) {
        const char *end;

        end = memmem(s, len, "\n", 1);
        if (!end) {
            end = s + len;
        }

        const size_t slen = end - s;

        if (prefix_str && prefix_len > 0) {
            char *new_dst;

            new_dst = prefixed_only_cpy(dst, s, slen, prefix_str, prefix_len);
            if (new_dst != dst) {
                dst = new_dst;
                *(dst++) = '\n';
            }
        } else {
            memcpy(dst, s, slen);
            dst += slen;
            *(dst++) = '\n';
        }

        s += slen + 1;
        len -= slen + 1;
    }

    if (dst != dst_start) {
        *(--dst) = '\0';
    }
}

char *ch_replace(char *s, size_t n, char orig_ch, char new_ch)
{
    char * const e = s + n;

    for (char *p = s, c = *s; p != e && c != '\0'; c = *++p) {
        if (c == orig_ch) {
            *p = new_ch;
        }
    }

    return s;
}
