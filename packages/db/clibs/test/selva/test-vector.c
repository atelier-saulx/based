/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */

#include <stdlib.h>
#include "selva/vector.h"

PU_TEST(test_dot_simple)
{
    float a[] = { 2.0, 7.0, 1.0 };
    float b[] = { 8.0, 2.0, 8.0 };
    float x = vector_dot(a, b, 3);

    pu_assert_equal("Dot product", x, 38);

    return nullptr;
}

PU_TEST(test_dot_simple_long)
{
    float a[] = { 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0 };
    float b[] = { 5.0, 4.0, 3.0, 4.0, 2.0, 4.0, 7.0, 8.0, 9.0, 0.0, 4.0 };
    float x = vector_dot(a, b, 11);

    pu_assert_equal("Dot product", x, 310.0);

    return nullptr;
}

PU_TEST(test_l1_simple)
{
    float a[] = { 13.0, 23.0, 11.0, 24.0 };
    float b[] = { 23.0, 57.0, 23.0, 12.0 };
    float x = vector_l1(a, b, 4);

    pu_assert_equal("Manhattan distance", x, 68.0);

    return nullptr;
}

PU_TEST(test_l2s_simple)
{
    float a[] = { 4.0, 3.0, 5.0, 1.0 };
    float b[] = { 7.0, 5.0, 3.0, 1.0 };
    float x = vector_l2s(a, b, 4);

    pu_assert_equal("Squared Euclidean distance", x, 17.0);

    return nullptr;
}
