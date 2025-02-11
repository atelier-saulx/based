/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "selva/_export.h"

typedef float v2f __attribute__((vector_size(2 * sizeof(float))));
typedef float v4f __attribute__((vector_size(4 * sizeof(float))));
typedef float v8f __attribute__((vector_size(8 * sizeof(float))));

/**
 * Calculate the cosine similarity of two vectors of length len.
 */
SELVA_EXPORT
float vector_sc(const float *a, const float *b, size_t len);
