/*
 * Copyright (c) 2023, 2025 SAULX
 * Copyright (c) 2012, Ninjaware Oy, Olli Vanhoja <olli.vanhoja@ninjaware.fi>
 *
 * SPDX-License-Identifier: BSD-2-Clause
 */

/* file test_arrays.c */

#include <stdio.h>

PU_TEST(test_ok)
{
    int arr1[] = {0, 1, 2, 3, 4, 5};
    int arr2[] = {0, 1, 2, 3, 4, 5};

    pu_assert_array_equal("Arrays are equal", arr1, arr2, sizeof(arr1)/sizeof(*arr1));
    return 0;
}

PU_TEST(test_fail)
{
    int arr1[] = {0, 1, 2, 3, 4, 5};
    int arr2[] = {0, 1, 2, 4, 4, 5};

    pu_assert_array_equal("Arrays are equal", arr1, arr2, sizeof(arr1)/sizeof(*arr1));
    return 0;
}
