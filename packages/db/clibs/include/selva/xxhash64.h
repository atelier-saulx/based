/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef XXHASH64_H
#define XXHASH64_H

#include <stdint.h>
#include "selva/_export.h"

/**
 * @brief Wrapper function that computes the 64-bit hash of a given input string using the xxHash algorithm.
 *
 * Takes a string as input and returns a 64-bit hash value.
 *
 * @param s The input string to be hashed.
 * @return A 64-bit hash value of the input string.
 */
SELVA_EXPORT
uint64_t xxHash64(const char *s, size_t len);

#endif
