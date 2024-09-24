/*
 * Copyright (c) 2023 SAULX
 *
 * SPDX-License-Identifier: MIT
 */

#include <stdlib.h>
#include <punit.h>
#include "util/hll.h"

static hll_t *hll;

void setup(void)
{
    hll = hll_create();
}

void teardown(void)
{
    hll_destroy(hll);
}

#define CALC_ERR(ve, p) \
    ((long long)((double)(ve) * (double)(p)))
#define WITHIN_ERR(act, ve, p) \
    ((act) >= ((ve) - CALC_ERR((ve), (p))) && ((act) <= ((ve) + CALC_ERR((ve), (p)))))

PU_TEST(test_hll_sparse)
{
#define N 100
    long long n = 0, act;

    for (int i = 0; i < N; i++) {
        for (int j = 0; j < 2; j++) {
            char buf[80];

            snprintf(buf, sizeof(buf), "%d", i + j);

            hll_add(&hll, buf, strlen(buf));
            n++;
        }
    }

    act = hll_count(hll);
    pu_assert("count correct", WITHIN_ERR(act, N, 0.02));

    hll_t *dense = hll_sparse_to_dense(hll);
    pu_assert_ptr_not_equal("converted only now", dense, hll);
    hll = dense;

    return NULL;
#undef N
}

PU_TEST(test_hll_huge)
{
#define N 100000
    long long n = 0, act;

    for (int i = 0; i < N; i++) {
        for (int j = 0; j < 2; j++) {
            char buf[80];

            snprintf(buf, sizeof(buf), "%d", i + j);

            hll_add(&hll, buf, strlen(buf));
            n++;
        }
    }

    act = hll_count(hll);
    pu_assert("count correct", WITHIN_ERR(act, N, 0.02));

    return NULL;
#undef N
}

PU_TEST(test_hll_dense)
{
#define N 100
    long long n = 0, act;
    hll_t *dense;

    hll_add(&hll, "f", 1);
    dense = hll_sparse_to_dense(hll);
    pu_assert_not_null("conversion ok", dense);
    pu_assert_ptr_not_equal("converted", dense, hll);
    hll = dense;

    for (int i = 0; i < N; i++) {
        for (int j = 0; j < 2; j++) {
            char buf[80];

            snprintf(buf, sizeof(buf), "%d", i + j);

            hll_add(&hll, buf, strlen(buf));
            n++;
        }
    }

    act = hll_count(hll);
    pu_assert("count correct", WITHIN_ERR(act, N, 0.02));

    return NULL;
#undef N
}

PU_TEST(test_hll_dense2)
{
#define N 100
    long long n = 0, act;

    for (int i = 0; i < N; i++) {
        for (int j = 0; j < 2; j++) {
            char buf[80];

            snprintf(buf, sizeof(buf), "%d", i + j);

            hll_add(&hll, buf, strlen(buf));
            n++;
        }
    }

    hll_t *dense = hll_sparse_to_dense(hll);
    pu_assert_not_null("conversion ok", dense);
    pu_assert_ptr_not_equal("converted", dense, hll);
    hll = dense;

    act = hll_count(hll);
    pu_assert("count correct", WITHIN_ERR(act, N, 0.02));

    return NULL;
#undef N
}
