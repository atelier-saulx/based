/*
 * Copyright (c) 2025 SAULX
 *
 * SPDX-License-Identifier: MIT
 */

#include "selva/fast_linear_search.h"

PU_TEST(test_u32_0)
{
    uint32_t arr[0];
    ssize_t res = fast_linear_search_uint32(arr, 0, 0);

    pu_assert_equal("", res, -1);

    return nullptr;
}

PU_TEST(test_u32_1)
{
    uint32_t arr[1] = { 1 };
    ssize_t res1 = fast_linear_search_uint32(arr, num_elem(arr), 0);
    ssize_t res2 = fast_linear_search_uint32(arr, num_elem(arr), 1);

    pu_assert_equal("", res1, -1);
    pu_assert_equal("", res2, 0);

    return nullptr;
}

PU_TEST(test_u32_2)
{
    uint32_t arr[2] = { 1, 2 };
    ssize_t res1 = fast_linear_search_uint32(arr, num_elem(arr), 0);
    ssize_t res2 = fast_linear_search_uint32(arr, num_elem(arr), 1);
    ssize_t res3 = fast_linear_search_uint32(arr, num_elem(arr), 2);

    pu_assert_equal("", res1, -1);
    pu_assert_equal("", res2, 0);
    pu_assert_equal("", res3, 1);

    return nullptr;
}

PU_TEST(test_u32_3)
{
    uint32_t arr[3] = { 1, 2, 3 };
    ssize_t res1 = fast_linear_search_uint32(arr, num_elem(arr), 0);
    ssize_t res2 = fast_linear_search_uint32(arr, num_elem(arr), 1);
    ssize_t res3 = fast_linear_search_uint32(arr, num_elem(arr), 2);
    ssize_t res4 = fast_linear_search_uint32(arr, num_elem(arr), 3);

    pu_assert_equal("", res1, -1);
    pu_assert_equal("", res2, 0);
    pu_assert_equal("", res3, 1);
    pu_assert_equal("", res4, 2);

    return nullptr;
}

PU_TEST(test_u32_4)
{
    uint32_t arr[4] = { 1, 2, 3, 4 };
    ssize_t res1 = fast_linear_search_uint32(arr, num_elem(arr), 0);
    ssize_t res2 = fast_linear_search_uint32(arr, num_elem(arr), 1);
    ssize_t res3 = fast_linear_search_uint32(arr, num_elem(arr), 2);
    ssize_t res4 = fast_linear_search_uint32(arr, num_elem(arr), 3);
    ssize_t res5 = fast_linear_search_uint32(arr, num_elem(arr), 4);

    pu_assert_equal("", res1, -1);
    pu_assert_equal("", res2, 0);
    pu_assert_equal("", res3, 1);
    pu_assert_equal("", res4, 2);
    pu_assert_equal("", res5, 3);

    return nullptr;
}

PU_TEST(test_u32_5)
{
    uint32_t arr[5] = { 1, 2, 3, 4, 5 };
    ssize_t res1 = fast_linear_search_uint32(arr, num_elem(arr), 0);
    ssize_t res2 = fast_linear_search_uint32(arr, num_elem(arr), 1);
    ssize_t res3 = fast_linear_search_uint32(arr, num_elem(arr), 2);
    ssize_t res4 = fast_linear_search_uint32(arr, num_elem(arr), 3);
    ssize_t res5 = fast_linear_search_uint32(arr, num_elem(arr), 4);
    ssize_t res6 = fast_linear_search_uint32(arr, num_elem(arr), 5);

    pu_assert_equal("", res1, -1);
    pu_assert_equal("", res2, 0);
    pu_assert_equal("", res3, 1);
    pu_assert_equal("", res4, 2);
    pu_assert_equal("", res5, 3);
    pu_assert_equal("", res6, 4);

    return nullptr;
}

PU_TEST(test_u32_6)
{
    uint32_t arr[6] = { 1, 2, 3, 4, 5, 6 };
    ssize_t res1 = fast_linear_search_uint32(arr, num_elem(arr), 0);
    ssize_t res2 = fast_linear_search_uint32(arr, num_elem(arr), 1);
    ssize_t res3 = fast_linear_search_uint32(arr, num_elem(arr), 2);
    ssize_t res4 = fast_linear_search_uint32(arr, num_elem(arr), 3);
    ssize_t res5 = fast_linear_search_uint32(arr, num_elem(arr), 4);
    ssize_t res6 = fast_linear_search_uint32(arr, num_elem(arr), 5);
    ssize_t res7 = fast_linear_search_uint32(arr, num_elem(arr), 6);

    pu_assert_equal("", res1, -1);
    pu_assert_equal("", res2, 0);
    pu_assert_equal("", res3, 1);
    pu_assert_equal("", res4, 2);
    pu_assert_equal("", res5, 3);
    pu_assert_equal("", res6, 4);
    pu_assert_equal("", res7, 5);

    return nullptr;
}
