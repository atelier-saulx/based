/*
 * Copyright (c) 2023 SAULX
 * Copyright (c) 2012, Ninjaware Oy, Olli Vanhoja <olli.vanhoja@ninjaware.fi>
 *
 * SPDX-License-Identifier: BSD-2-Clause
 */

/* file test_null.c */

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
    void * ptr1 = NULL;
    void * ptr2 = &ptr1;

    pu_assert_null("ptr1 is null", ptr1);
    pu_assert_not_null("ptr2 is not null", ptr2);
    return 0;
}

PU_TEST(test_fail1)
{
    char a = 'a';
    void * ptr1 = &a;
    void * ptr2 = NULL;

    pu_assert_null("ptr1 is null", ptr1);
    pu_assert_not_null("ptr2 is not null", ptr2);
    return 0;
}

PU_TEST(test_fail2)
{
    void * ptr2 = NULL;

    pu_assert_not_null("ptr2 is not null", ptr2);
    return 0;
}
