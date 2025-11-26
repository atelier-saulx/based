/*
 * Copyright (c) 2023 SAULX
 * Copyright (c) 2012, Ninjaware Oy, Olli Vanhoja <olli.vanhoja@ninjaware.fi>
 *
 * SPDX-License-Identifier: BSD-2-Clause
 */

/* file test_strings.c */

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
    const char *str = "left string";

    pu_assert_str_equal("Strings are equal", str, "left string");
    return 0;
}

PU_TEST(test_fail)
{
    const char *str = "left string";

    pu_assert_str_equal("Strings are equal", str, "right string");
    return 0;
}
