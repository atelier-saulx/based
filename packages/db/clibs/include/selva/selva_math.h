/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#include <math.h>

static inline double nan_undefined(void)
{
    return nan("1");
}

static inline int isnan_undefined(double x)
{
    long long i;

    if (!isnan(x)) {
      return 0;
    }

    __builtin_memcpy(&i, &x, sizeof(i));

    return i & 1;
}

/**
 * Mod (%) like it is in JS.
 */
static inline double js_fmod(double x, double y)
{
    double result = remainder(fabs(x), (y = fabs(y)));
    if (signbit(result)) {
        result += y;
    }

    return copysign(result, x);
}
