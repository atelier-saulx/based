/**
 * @file test_queue_r.c
 * @brief Test generic thread-safe queue implementation.
 * Copyright (c) 2022-2023, 2025 SAULX
 * SPDX-License-Identifier: MIT
 */

#include "selva/queue_r.h"

static int tarr[5];
static queue_cb_t queue;

void setup(void)
{
    size_t i;

    for (i = 0; i < sizeof(tarr) / sizeof(int); i++) {
        tarr[i] = 0;
    }

    queue = queue_create(&tarr, sizeof(int), sizeof(tarr));
}

void teardown(void)
{
    queue_clear_from_push_end(&queue);
}

PU_TEST(test_queue_single_push)
{
    int x = 5;
    int err;

    err = queue_push(&queue, &x);
    pu_assert("error, push failed", err != 0);
    pu_assert_equal("error, value of x was not pushed to the first index", tarr[0], x);

    return nullptr;
}

PU_TEST(test_queue_single_pop)
{
    int x = 5;
    int y;
    int err;

    err = queue_push(&queue, &x);
    pu_assert("error, push failed", err != 0);

    err = queue_pop(&queue, &y);
    pu_assert("error, pop failed", err != 0);
    pu_assert_equal("Returned value is same as pushed", x, y);

    return nullptr;
}

PU_TEST(test_queue_pop_fail)
{
    int y;
    int err;

    err = queue_pop(&queue, &y);
    pu_assert("pop should fail", err == 0);

    return nullptr;
}

PU_TEST(test_queue_peek_ok)
{
    int x = 5;
    int *xp = nullptr;
    int err;

    err = queue_push(&queue, &x);
    pu_assert("error, push failed", err != 0);

    err = queue_peek(&queue, (void **)&xp);
    pu_assert("peek is ok", err != 0);
    pu_assert("xp should be set", xp != nullptr);
    pu_assert_equal("Value of *xp is valid", *xp, x);

    return nullptr;
}

PU_TEST(test_queue_peek_fail)
{
    int *xp = nullptr;
    int err;

    err = queue_peek(&queue, (void **)&xp);
    pu_assert("peek should fail due to an empty queue", err == 0);

    return nullptr;
}

PU_TEST(test_queue_skip_one)
{
    int x = 0;
    int err, ret;

    err = queue_push(&queue, &x);
    pu_assert("error, push failed", err != 0);

    ret = queue_skip(&queue, 1);
    pu_assert_equal("One element skipped", ret, 1);

    return nullptr;
}

PU_TEST(test_queue_alloc)
{
    int * p;
    int y;
    int err;

    p = queue_alloc_get(&queue);
    pu_assert("Alloc not nullptr", p);

    *p = 5;

    err = queue_pop(&queue, &y);
    pu_assert("pop should fail", err == 0);

    queue_alloc_commit(&queue);

    err = queue_pop(&queue, &y);
    pu_assert("error, pop failed", err != 0);
    pu_assert_equal("Returned value is same as pushed", 5, y);

    return nullptr;
}

PU_TEST(test_queue_is_empty)
{
    pu_assert("Queue is empty", queue_isempty(&queue) != 0);

    return nullptr;
}

PU_TEST(test_queue_is_not_empty)
{
    int x = 1;

    queue_push(&queue, &x);
    pu_assert("Queue is empty", queue_isempty(&queue) == 0);

    return nullptr;
}
