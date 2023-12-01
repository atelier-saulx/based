/*
 * Copyright (c) 2023 SAULX
 * Copyright (c) 2012, Ninjaware Oy, Olli Vanhoja <olli.vanhoja@ninjaware.fi>
 *
 * SPDX-License-Identifier: BSD-2-Clause
 */

/* file test_unix_stdin.c */

#include <stdio.h>
#include "punit.h"
#include "unixunit.h"

void setup(void)
{
    uu_open_pipe();
}

void teardown(void)
{
    uu_close_pipe();
}

PU_TEST(test_stdin_ok)
{
    char * input[] = {"1\n", "2\n"};
    int ret_val1, ret_val2;

    /* Write input values to stdin */
    uu_open_stdin_writer();
    uu_write_stdin(input[0]);
    uu_write_stdin(input[1]);
    uu_close_stdin_writer();

    /* Get input from stdin */
    scanf("%i", &ret_val1);
    scanf("%i", &ret_val2);

    pu_assert_equal("First value read from stdin", ret_val1, 1);
    pu_assert_equal("Second value read from stdin", ret_val2, 2);
    return 0;
}

PU_TEST(test_stdin_fail)
{
    char * input[] = {"2\n", "3\n"};
    int ret_val1, ret_val2;

    /* Write input values to stdin */
    uu_open_stdin_writer();
    uu_write_stdin(input[0]);
    uu_write_stdin(input[1]);
    uu_close_stdin_writer();

    /* Get input from stdin */
    scanf("%i", &ret_val1);
    scanf("%i", &ret_val2);

    pu_assert_equal("First value read from stdin", ret_val1, 1);
    pu_assert_equal("Second value read from stdin", ret_val2, 2);
    return 0;
}
