// Copyright (c) 2012, Ninjaware Oy, Olli Vanhoja <olli.vanhoja@ninjaware.fi>
//
// SPDX-License-Identifier: BSD-2-Clause

/* file test_example.c */

#include <stdio.h>
#include "punit.h"

int foo;
int bar;

void setup(void)
{
    foo = 7;
    bar = 4;
}

void teardown(void)
{
}

PU_RUN(test_foo)
{
    pu_test_description("This test case will just demostrate usage of the most basic assert function.");

    pu_assert("error, foo != 7", foo == 7);
    return NULL;
}

PU_SKIP(test_derp)
{
    pu_assert("error, bar != 5", bar == 4);
    return NULL;
}
