/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stddef.h>
#include "selva/_export.h"

/**
 * Fast buffer equals comparison.
 * @param a is an array of length len.
 * @param b is an array of length len.
 * @param len length of a and b in bytes, must be greater than 0.
 * @returns true if a and b contains the same byte sequence; Otherwise false.
 */
SELVA_EXPORT
bool fast_memcmp(const void *restrict a, const void *restrict b, size_t len);
