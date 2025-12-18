/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */

#include <inttypes.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include "expire.h"

static struct SelvaExpire ex;
static int64_t t;
static int expire_called;
static int cancel_called;

static void expire_cb(struct SelvaExpireToken *token, void *ctx)
{
    expire_called++;
    free(token);
}

static void cancel_cb(struct SelvaExpireToken *token)
{
    cancel_called++;
    free(token);
}

static struct SelvaExpireToken *new_token(int64_t expire)
{
    struct SelvaExpireToken *token = malloc(sizeof(struct SelvaExpireToken));

    token->expire = expire;

    return token;
}

void setup(void)
{
    ex.expire_cb = expire_cb;
    ex.cancel_cb = cancel_cb;
    selva_expire_init(&ex);
    t = 0;
    expire_called = 0;
    cancel_called = 0;
}

void teardown(void)
{
    selva_expire_deinit(&ex);
}

static char err_buf[80];

#define TICK(expected_count) \
    do { \
        size_t n; \
        size_t expected = (expected_count); \
        snprintf(err_buf, sizeof(err_buf), "tick %" PRId64, t); \
        selva_expire_tick(&ex, nullptr, t++); \
        n = selva_expire_count(&ex); \
        pu_assert_equal(err_buf, n, expected); \
    } while (0)


PU_TEST(test_expire)
{
    TICK(0);

    selva_expire_insert(&ex, new_token(2));

    TICK(1);
    TICK(0);
    pu_assert_equal("one expired", expire_called, 1);
    pu_assert_equal("none cancelled", cancel_called, 0);

    selva_expire_insert(&ex, new_token(4));
    selva_expire_insert(&ex, new_token(4));
    selva_expire_insert(&ex, new_token(4));
    selva_expire_insert(&ex, new_token(4));
    selva_expire_insert(&ex, new_token(4));
    selva_expire_insert(&ex, new_token(4));
    selva_expire_insert(&ex, new_token(7));
    selva_expire_insert(&ex, new_token(7));

    TICK(8);
    TICK(2);
    TICK(2);
    TICK(2);
    TICK(0);

    for (size_t i = 0; i < 1'000; i++) {
        size_t n;

        selva_expire_insert(&ex, new_token(9 + i % 3));
        n = selva_expire_count(&ex);
        pu_assert_equal("count increments", n, i + 1);
    }

    TICK(1'000);
    TICK(666);
    TICK(333);
    TICK(0);

    for (size_t i = 0; i < 10'000; i++) {
        size_t n1, n2;

        selva_expire_insert(&ex, new_token(t + i % 50));
        n1 = selva_expire_count(&ex);

        selva_expire_tick(&ex, nullptr, t++);
        n2 = selva_expire_count(&ex);

        snprintf(err_buf, sizeof(err_buf), "n1: %zu n2: %zu", n1, n2);
        pu_assert(err_buf, n2 <= n1);
    }


    return nullptr;
}

static bool cmp_addr(struct SelvaExpireToken *token, selva_expire_cmp_arg_t arg)
{
    return (arg.p == token);
}

#define ASSERT_EX_COUNT(count) \
    do { \
        size_t c = (count); \
        size_t n = selva_expire_count(&ex); \
        pu_assert_equal("count", n, c); \
    } while (0)

PU_TEST(test_cancel)
{
    size_t n;

    TICK(0);

    struct SelvaExpireToken *tok1 = new_token(2);
    struct SelvaExpireToken *tok2 = new_token(2);
    struct SelvaExpireToken *tok3 = new_token(2);

    selva_expire_insert(&ex, tok1);
    selva_expire_insert(&ex, tok2);
    selva_expire_insert(&ex, tok3);
    ASSERT_EX_COUNT(3);

    selva_expire_remove(&ex, cmp_addr, tok2);
    ASSERT_EX_COUNT(2);

    selva_expire_remove(&ex, cmp_addr, tok1);
    ASSERT_EX_COUNT(1);

    selva_expire_remove(&ex, cmp_addr, tok3);
    ASSERT_EX_COUNT(0);

    return nullptr;
}
