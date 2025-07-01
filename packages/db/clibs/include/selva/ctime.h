/**
 *******************************************************************************
 * @file    ctime.h
 * @author  Olli Vanhoja
 * @brief   time types.
 * @section LICENSE
 * Copyright (c) 2022-2025 Saulx
 * Copyright (c) 2020 Olli Vanhoja <olli.vanhoja@alumni.helsinki.fi>
 * Copyright (c) 2014 - 2016 Olli Vanhoja <olli.vanhoja@cs.helsinki.fi>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 * SPDX-License-Identifier: BSD-2-Clause
 *******************************************************************************
 */

#pragma once

#include <stdint.h>
#include <time.h>
#include "selva/_export.h"

/**
 * Conver an msec value to a timespec struct.
 * @param[out]  ts      is a pointer to the destination struct.
 * @param[in]   nsec    is the value in milliseconds.
 */
SELVA_EXPORT
struct timespec *msec2timespec(struct timespec * ts, int64_t msec);

#define MSEC2TIMESPEC(msec) \
    ({ struct timespec _ts; (void)msec2timespec(&_ts, msec); _ts; })

/**
 * Convert a nsec value to a timespec struct.
 * @param[out]  ts      is a pointer to the destination struct.
 * @param[in]   nsec    is the value in nanoseconds.
 */
SELVA_EXPORT
struct timespec *nsec2timespec(struct timespec * ts, int64_t nsec);

#define NSEC2TIMESPEC(nsec) \
    ({ struct timespec _ts; (void)NSEC2TIMESPEC(&_ts, nsec); _ts; })

/**
 * Compare two timespec structs.
 * @param[in]   left    is a pointer to the left value.
 * @param[in]   right   is a pointer to the right value.
 * @param[in]   cmp     is the operator (<, >, ==, <=, or >=).
 * @returns a boolean value.
 */
#define timespec_cmp(left_tsp, right_tsp, cmp) ({       \
    (((left_tsp)->tv_sec == (right_tsp)->tv_sec)        \
     ? ((left_tsp)->tv_nsec cmp (right_tsp)->tv_nsec)   \
     : ((left_tsp)->tv_sec cmp (right_tsp)->tv_sec));   \
    })

/**
 * Calculate the sum of two timespec structs.
 * @param[out]  sum     is a pointer to the destination struct.
 * @param[in]   left    is a pointer to the left value.
 * @param[in]   right   is a pointer to the right value.
 */
SELVA_EXPORT
void timespec_add(struct timespec * sum, const struct timespec * left,
                  const struct timespec * right)
    __attribute__((access(write_only, 1), access(read_only, 2), access(read_only, 3)));

/**
 * Calculate the difference of two timespec structs.
 * @param[out]  sum     is a pointer to the destination struct.
 * @param[in]   left    is a pointer to the left value.
 * @param[in]   right   is a pointer to the right value.
 */
SELVA_EXPORT
void timespec_sub(struct timespec * diff, const struct timespec * left,
                  const struct timespec * right)
    __attribute__((access(write_only, 1), access(read_only, 2), access(read_only, 3)));

/**
 * Calculate the product of two timespec structs.
 * @param[out]  sum     is a pointer to the destination struct.
 * @param[in]   left    is a pointer to the left value.
 * @param[in]   right   is a pointer to the right value.
 */
SELVA_EXPORT
void timespec_mul(struct timespec * prod, const struct timespec * left,
                 const struct timespec * right)
    __attribute__((access(write_only, 1), access(read_only, 2), access(read_only, 3)));

/**
 * Calculate the quotient of two timespec structs.
 * @param[out]  sum     is a pointer to the destination struct.
 * @param[in]   left    is a pointer to the left value.
 * @param[in]   right   is a pointer to the right value.
 */
SELVA_EXPORT
void timespec_div(struct timespec * quot, const struct timespec * left,
                  const struct timespec * right)
    __attribute__((access(write_only, 1), access(read_only, 2), access(read_only, 3)));

/**
 * Calculate the modulo of two timespec structs.
 * @param[out]  sum     is a pointer to the destination struct.
 * @param[in]   left    is a pointer to the left value.
 * @param[in]   right   is a pointer to the right value.
 */
void timespec_mod(struct timespec * rem, const struct timespec * left,
                  const struct timespec * right)
    __attribute__((access(write_only, 1), access(read_only, 2), access(read_only, 3)));

static inline double timespec2ms(const struct timespec *ts)
{
    return (double)ts->tv_sec * 1000.0 + (double)ts->tv_nsec / 1.0e6;
}

