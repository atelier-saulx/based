/*
 * Copyright (c) 2023 SAULX
 * Copyright (c) 2012, Ninjaware Oy, Olli Vanhoja <olli.vanhoja@ninjaware.fi>
 *
 * SPDX-License-Identifier: BSD-2-Clause
 */

/* file test_doubles.c */

#include <stdio.h>
#include "punit.h"

#if PU_LMATH != 0

void setup(void)
{
}

void teardown(void)
{
}

PU_TEST(test_ok)
{
    double value = 4.0f;

    pu_assert_double_equal("Values are approximately equal", value, 4.2f, 0.3f);
    return 0;
}

PU_TEST(test_fail)
{
    double value = 3.0f;

    pu_assert_double_equal("Values are approximately equal", value, 5.0f, 0.5f);
    return 0;
}

#endif
