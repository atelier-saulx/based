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
 * Calculate the dot product of two vectors of length len.
 */
SELVA_EXPORT
float vector_dot(const float *a, const float *b, size_t len);

/**
 * Calculate the Manhattan distance of two vectors of length len.
 */
SELVA_EXPORT
float vector_l1(const float *a, const float *b, size_t len);

/**
 * Calculate the squared Euclidean distance of two vectors of length len.
 */
SELVA_EXPORT
float vector_l2s(const float *a, const float *b, size_t len);

/**
 * Calculate the cosine similarity of two vectors of length len.
 */
SELVA_EXPORT
float vector_sc(const float *a, const float *b, size_t len);
