/*
 * Copyright (c) 2020-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef _UTIL_ARRAY_FIELD_H_
#define _UTIL_ARRAY_FIELD_H_

struct SVector;

/**
 * Convert integer index to unsigned absolute index.
 * Negative index starts counting from the end of the array.
 */
size_t ary_idx_to_abs(ssize_t len, ssize_t ary_idx)
    __attribute__((const));

/**
 * Convert integer index to unsigned absolute index.
 * Negative index starts counting from the end of the vector.
 */
size_t vec_idx_to_abs(struct SVector *vec, ssize_t ary_idx)
    __attribute__((pure));

#endif /* _UTIL_ARRAY_FIELD_H_ */
