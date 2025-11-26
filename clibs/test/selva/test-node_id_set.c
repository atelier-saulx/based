/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */

#include "jemalloc_selva.h"
#include "selva/node_id_set.h"

PU_TEST(test_add)
{
    node_id_t *arr = selva_malloc(3 * sizeof(node_id_t));
    size_t len = 0;

    node_id_set_add(&arr, &len, 3);
    node_id_set_add(&arr, &len, 1);
    node_id_set_add(&arr, &len, 2);

    node_id_t test[] = {1, 2, 3};
    pu_assert_equal("", len, 3);
    pu_assert_array_equal("", arr, test, 3);

    return nullptr;
}

PU_TEST(test_remove1)
{
    node_id_t *arr = selva_malloc(3 * sizeof(node_id_t));
    memcpy(arr, (node_id_t []){1, 2, 3}, 3 * sizeof(node_id_t));
    size_t len = 3;

    node_id_t test1[] = {1, 3};
    node_id_set_remove(&arr, &len, 2);
    pu_assert_equal("", len, 2);
    pu_assert_array_equal("", arr, test1, num_elem(test1));

    node_id_t test2[] = {3};
    node_id_set_remove(&arr, &len, 1);
    pu_assert_equal("", len, 1);
    pu_assert_array_equal("", arr, test2, num_elem(test2));

    node_id_set_remove(&arr, &len, 3);
    pu_assert_equal("", len, 0);

    return nullptr;
}

PU_TEST(test_remove2)
{
    node_id_t *arr = selva_malloc(3 * sizeof(node_id_t));
    memcpy(arr, (node_id_t []){1, 2, 3}, 3 * sizeof(node_id_t));
    size_t len = 3;

    node_id_t test1[] = {2, 3};
    node_id_set_remove(&arr, &len, 1);
    pu_assert_equal("", len, 2);
    pu_assert_array_equal("", arr, test1, num_elem(test1));

    node_id_t test2[] = {3};
    node_id_set_remove(&arr, &len, 2);
    pu_assert_equal("", len, 1);
    pu_assert_array_equal("", arr, test2, num_elem(test2));

    node_id_set_remove(&arr, &len, 3);
    pu_assert_equal("", len, 0);

    return nullptr;
}

PU_TEST(test_remove3)
{
    node_id_t *arr = selva_malloc(3 * sizeof(node_id_t));
    memcpy(arr, (node_id_t []){1, 2, 3}, 3 * sizeof(node_id_t));
    size_t len = 3;

    node_id_t test1[] = {1, 2};
    node_id_set_remove(&arr, &len, 3);
    pu_assert_equal("", len, 2);
    pu_assert_array_equal("", arr, test1, num_elem(test1));

    node_id_t test2[] = {2};
    node_id_set_remove(&arr, &len, 1);
    pu_assert_equal("", len, 1);
    pu_assert_array_equal("", arr, test2, num_elem(test2));

    node_id_set_remove(&arr, &len, 2);
    pu_assert_equal("", len, 0);

    return nullptr;
}

PU_TEST(test_remove_non_existing)
{
    node_id_t *arr = selva_malloc(3 * sizeof(node_id_t));
    memcpy(arr, (node_id_t []){1, 2}, 2 * sizeof(node_id_t));
    size_t len = 2;

    node_id_t test1[] = {1, 2};
    node_id_set_remove(&arr, &len, 3);
    pu_assert_equal("", len, 2);
    pu_assert_array_equal("", arr, test1, num_elem(test1));

    node_id_t test2[] = {1};
    node_id_set_remove(&arr, &len, 2);
    pu_assert_equal("", len, 1);
    pu_assert_array_equal("", arr, test2, num_elem(test2));

    node_id_set_remove(&arr, &len, 1);
    pu_assert_equal("", len, 0);

    node_id_set_remove(&arr, &len, 3);
    pu_assert_equal("", len, 0);

    return nullptr;
}
