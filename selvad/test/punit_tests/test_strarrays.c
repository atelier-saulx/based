/*
 * Copyright (c) 2023 SAULX
 * Copyright (c) 2012, Ninjaware Oy, Olli Vanhoja <olli.vanhoja@ninjaware.fi>
 *
 * SPDX-License-Identifier: BSD-2-Clause
 */

/* file test_arrays.c */

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
    char * arr1[] = {"one", "two", "three"};
    char * arr2[] = {"one", "two", "three"};

    pu_assert_str_array_equal("Arrays are equal", arr1, arr2, sizeof(arr1)/sizeof(*arr1));
    return 0;
}

PU_TEST(test_fail)
{
    char * arr1[] = {"one", "two", "three"};
    char * arr2[] = {"one", "three", "four"};

    pu_assert_str_array_equal("Arrays are equal", arr1, arr2, sizeof(arr1)/sizeof(*arr1));
    return 0;
}
