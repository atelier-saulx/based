/*
 * Copyright (c) 2020-2023, 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stdint.h>

uint64_t b10digits(uint64_t x);

[[nodiscard]]
char *selva_strndup(const char *s, size_t n)
    __attribute__((access(read_only, 1, 2), returns_nonnull));

[[nodiscard]]
char *selva_strdup(const char *s)
    __attribute__((access(read_only, 1), returns_nonnull));

int str_endswith(const char *str, const char *suffix)
    __attribute__((pure, access(read_only, 1), access(read_only, 2)));

int stringlist_search(const char *list, const char *str, size_t n, char wildcard)
    __attribute__((pure, access(read_only, 1), access(read_only, 2, 3)));

/**
 * Filter strings by prefix and remove the prefix when inserting to dst.
 * @param dst must be large enough to fit src in the worst case.
 * @param prefix_str is an optional prefix.
 */
void stringlist_remove_prefix(char *dst, const char *src, int len, const char *prefix_str, size_t prefix_len)
    __attribute__((access(write_only, 1), access(read_only, 2, 3)));

size_t substring_count(const char *string, const char *substring, size_t n)
    __attribute__((pure, access(read_only, 1), access(read_only, 2, 3)));

/**
 * Calculate the number of instances of ch in s.
 */
int ch_count(const char *s, char ch)
    __attribute__((pure, access(read_only, 1)));

/**
 * Replace all occurrences of orig_ch in s with new_ch.
 */
char *ch_replace(char *s, size_t n, char orig_ch, char new_ch)
    __attribute__((access(read_write, 1, 2)));

#ifndef HAS_MEMRCHR
/**
 * Locate last occurrence of the byte c the in s.
 */
void *memrchr(const void *s, int c, size_t n)
    __attribute__((pure, access(read_only, 1, 3)));
#endif

/**
 * Locate the first occurrence of any of the bytes in accept.
 */
char *mempbrk(const char * restrict s, size_t len, const char * restrict accept, size_t accept_len)
    __attribute__((pure, access(read_only, 1, 2), access(read_only, 3, 4)));

long int strntol(const char *s, size_t n, const char **end)
    __attribute__((access(read_only, 1, 2), access(write_only, 3)));
