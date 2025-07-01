/*
 * Copyright (c) 2023 SAULX
 * Copyright (c) 2012, Ninjaware Oy, Olli Vanhoja <olli.vanhoja@ninjaware.fi>
 *
 * SPDX-License-Identifier: BSD-2-Clause
 */

/* file test_equal.c */

#include <stdio.h>
#include "punit.h"

void setup(void)
{
}

void teardown(void)
{
}

PU_TEST(test_ok)
{
    int value = 4;

    pu_assert_equal("Values are equal", value, 4);
    return 0;
}

PU_TEST(test_fail)
{
    int value = 4;

    pu_assert_equal("Values are equal", value, 5);
    return 0;
}
