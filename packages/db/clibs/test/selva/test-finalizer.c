/* Copyright (c) 2022-2023, 2025 SAULX
 *
 * SPDX-License-Identifier: MIT
 */

#include <stdio.h>
#include "queue.h"
#include "finalizer.h"

static int fin;

void setup(void)
{
    fin = 0;
}

static void dispose(void *p)
{
    unsigned i = (unsigned)p;

    fin |= i;
}

PU_TEST(test_finalizer)
{
    struct finalizer f;

    finalizer_init(&f);
    finalizer_add(&f, (void *)0x1,dispose);
    finalizer_add(&f, (void *)0x2, dispose);
    finalizer_run(&f);

    pu_assert_equal("", fin, 0x3);

    return NULL;
}
