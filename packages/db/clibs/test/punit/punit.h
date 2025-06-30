/**
 * @file punit.h
 * @brief PUnit, a portable unit testing framework for C.
 *
 * Inspired by: http://www.jera.com/techinfo/jtns/jtn002.html
 */

/*
 * Copyright (c) 2023, 2025 SAULX
 * Copyright (c) 2013, Olli Vanhoja <olli.vanhoja@cs.helsinki.fi>
 * Copyright (c) 2012, Ninjaware Oy, Olli Vanhoja <olli.vanhoja@ninjaware.fi>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * SPDX-License-Identifier: BSD-2-Clause
 */

/** @addtogroup PUnit
  * @{
  */

#pragma once
#ifndef PUNIT_H
#define PUNIT_H

#include <stdio.h>
#include <string.h>
#if PU_LMATH == 1
#include <math.h>
#endif
#include "linker_set.h"

typedef const char *punit_test_fn(void);
struct punit_test {
    punit_test_fn *fn;
    const char name[];
};

#define PU_TEST_DEF(NAME, SET_NAME) \
    static const char *CONCATENATE(NAME, _fun)(void); \
    static const struct punit_test NAME = { .fn = CONCATENATE(NAME, _fun), .name = #NAME }; \
    DATA_SET(SET_NAME, NAME) \

/**
 * Marks that this test should be executed.
 */
#define PU_TEST(NAME) \
    PU_TEST_DEF(NAME, punit_run); \
    static const char *CONCATENATE(NAME, _fun)(void)

/**
 * Marks that this test should be skipped.
 */
#define PU_SKIP(NAME) \
    PU_TEST_DEF(NAME, punit_skip); \
    static const char *CONCATENATE(NAME, _fun)(void)

/**
 * Assert condition.
 * Checks if boolean value of test is true.
 * @param message shown if assert fails.
 * @param test condition, also shown if assert fails.
 */
#define pu_assert(message, test) do { if (!(test)) { \
        printf("FAILED: %s:%d: (%s)\n",              \
            __FILE__, __LINE__, #test);              \
        return message; }                            \
} while (0)
/** \example test_example.c
 * This is an example of how to use the pu_assert.
 */

/**
 * Assert equal.
 * Checks if left == right is true.
 * @param message shown if assert fails.
 * @param left value.
 * @param right value.
 */
#define pu_assert_equal(message, left, right) do { if (!(left == right)) { \
        printf("FAILED: %s:%d: %s == %s\n\tleft:\t%lli\n\tright:\t%lli\n", \
            __FILE__, __LINE__, #left, #right, (long long)left, (long long)right); \
        return message; }                                                  \
} while(0)
/** \example test_equal.c
 * This is an example of how to use the pu_assert_equal.
 */

#define PUNIT_PRINT_ERR(_err_) \
    if ((_err_) < 0) printf("%s", selva_strerror(_err_)); \
    else             printf("%lli", (long long)(_err_));

/**
 * Assert equal.
 * Checks if left == right is true.
 * @param message shown if assert fails.
 * @param left value.
 * @param right value.
 */
#define pu_assert_err_equal(message, left, right) do { if (!(left == right)) { \
        printf("FAILED: %s:%d: %s == %s\n\tleft:\t", \
               __FILE__, __LINE__, #left, #right); \
        PUNIT_PRINT_ERR(left) \
        printf("\n\tright:\t"); \
        PUNIT_PRINT_ERR(right) \
        printf("\n"); \
        return message; } \
} while(0)

/**
 * Assert pointer equal.
 * Checks if left == right is true.
 * @param message shown if assert fails.
 * @param left value.
 * @param right value.
 */
#define pu_assert_ptr_equal(message, left, right) do { if (!(left == right)) { \
        printf("FAILED: %s:%d: %s == %s\n\tleft:\t%zx\n\tright:\t%zx\n",       \
            __FILE__, __LINE__, #left, #right, (size_t)(left), (size_t)(right)); \
        return message; }                                                      \
} while(0)

/**
 * Assert pointer not equal.
 * Checks if left != right is true.
 * @param message shown if assert fails.
 * @param left value.
 * @param right value.
 */
#define pu_assert_ptr_not_equal(message, left, right) do { if (!(left != right)) { \
        printf("FAILED: %s:%d: %s != %s\n\tleft:\t%zx\n\tright:\t%zx\n",       \
            __FILE__, __LINE__, #left, #right, (size_t)(left), (size_t)(right)); \
        return message; }                                                      \
} while(0)

/**
 * Buffer equal.
 * Checks if left and right strings are equal (memcmp).
 * @param message shown if assert fails.
 * @param left null-terminated string.
 * @param right null-terminated string.
 */
#define pu_assert_buf_equal(message, left, right, len) do {     \
    if (memcmp(left, right, len) != 0) {                        \
        printf("FAILED: %s:%d: %s equals %s\n"                  \
               "\tleft:\t\"%s\"\n\tright:\t\"%s\"\n",           \
            __FILE__, __LINE__, #left, #right, left, right);    \
    return message; }                                           \
} while (0)

/**
 * String equal.
 * Checks if left and right strings are equal (strcmp).
 * @param message shown if assert fails.
 * @param left null-terminated string.
 * @param right null-terminated string.
 */
#define pu_assert_str_equal(message, left, right) do {          \
    if (strcmp(left, right) != 0) {                             \
        printf("FAILED: %s:%d: %s equals %s\n"                  \
               "\tleft:\t\"%s\"\n\tright:\t\"%s\"\n",           \
            __FILE__, __LINE__, #left, #right, left, right);    \
    return message; }                                           \
} while (0)
/** \example test_strings.c
 * This is an example of how to use the pu_assert_str_equal.
 */

#if PU_LMATH == 1
/**
 * Doubles approximately equal.
 * Checks if left and right doubles are approximately equal.
 * @param message shown if assert fails.
 * @param left value as double.
 * @param right value as double.
 * @param delta difference allowed.
 */
#define pu_assert_double_equal(message, left, right, delta) do {    \
    if (!(fabs((double)left - (double)right) < (double)delta)) {    \
        printf("FAILED: %s:%d: %s is approximately equal to %s\n"   \
               "\tleft:\t%f\n\tright:\t%f\n\tdelta:\t%f\n",         \
            __FILE__, __LINE__, #left, #right, left, right, delta); \
        return message; }                                           \
} while (0)
#endif
/** \example test_doubles.c
 * This is an example of how to use the pu_assert_double_equal.
 */

/**
 * Assert integer arrays are equal.
 * Asserts that each integer element i of two arrays are equal (==).
 * @param message shown if assert fails.
 * @param left array.
 * @param right array.
 * @param size of the array tested.
 */
#define pu_assert_array_equal(message, left, right, size) do {    \
    int i;                                                        \
    for (i = 0; i < (int)(size); i++) {                           \
        if (!(left[i] == right[i])) {                             \
            printf("FAILED: %s:%d: integer array %s equals %s\n", \
                __FILE__, __LINE__, #left, #right);               \
            printf("\tleft[%i]:\t%i\n\tright[%i]:\t%i\n",         \
                i, left[i], i, right[i]);                         \
            return message; }                                     \
    }                                                             \
} while(0)
/** \example test_arrays.c
 * This is an example of how to use the pu_assert_array_equal.
 */

/**
 * Assert string arrays are equal.
 * Asserts that each string element i of two arrays are equal (strcmp).
 * @param message shown if assert fails.
 * @param left array of strings.
 * @param right array of strings.
 * @param size of the array tested.
 */
#define pu_assert_str_array_equal(message, left, right, size) do { \
    int i;                                                         \
    for (i = 0; i < (int)(size); i++) {                            \
        if (strcmp(left[i], right[i]) != 0) {                      \
            printf("FAILED: %s:%d: string array %s equals %s\n",   \
                __FILE__, __LINE__, #left, #right);                \
            printf("\tleft[%i]:\t\"%s\"\n\tright[%i]:\t\"%s\"\n",  \
                i, left[i], i, right[i]);                          \
            return message; }                                      \
    }                                                              \
} while(0)
/** \example test_strarrays.c
 * This is an example of how to use the pu_assert_str_array_equal.
 */

/**
 * Assert NULL.
 * Asserts that a pointer is null.
 * @param message shown if assert fails.
 * @param ptr a pointer variable.
 */
#define pu_assert_null(message, ptr) do { if ((void *)ptr) { \
        printf("FAILED: %s:%d: %s should be NULL\n",         \
            __FILE__, __LINE__, #ptr);                       \
        return message; }                                    \
} while (0)
#define pu_assert_nullptr pu_assert_null
/** \example test_null.c
 * This is an example of how to use the pu_assert_null.
 */

/**
 * Assert not NULL.
 * Asserts that a pointer isn't null.
 * @param message shown if assert fails.
 * @param ptr a pointer variable.
 */
#define pu_assert_not_null(message, ptr) do { if (!((void *)ptr)) { \
        printf("FAILED: %s:%d: %s should not be NULL\n",            \
            __FILE__, __LINE__, #ptr);                              \
        return message; }                                           \
} while (0)
#define pu_assert_not_nullptr pu_assert_not_null
/** \example test_null.c
 * This is an example of how to use the pu_assert_not_null.
 */


/**
 * Assert fail.
 * Always fails.
 * @param message that is shown.
 */
#define pu_assert_fail(message) do { printf("FAILED: Assert fail\n"); \
    return message;                                                   \
} while (0)

#define PU_TEST_BUILD 1 /*!< This definition can be used to exclude included
                         * files and souce code that are not needed for unit
                         * tests. */

/* Documented in punit.c */
void pu_test_description(char * str);
void setup(void);
void teardown(void);

#endif /* PUNIT_H */

/**
  * @}
  */
