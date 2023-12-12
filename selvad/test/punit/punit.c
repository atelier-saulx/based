/**
 * @file punit.c
 * @brief PUnit, a portable unit testing framework for C.
 *
 * Inspired by: http://www.jera.com/techinfo/jtns/jtn002.html
 *
 * Copyright (c) 2012, Ninjaware Oy, Olli Vanhoja <olli.vanhoja@ninjaware.fi>
 * Copyright (c) 2013, Olli Vanhoja <olli.vanhoja@cs.helsinki.fi>
 * Copyright (c) 2022-2023 SAULX
 *
 * SPDX-License-Identifier: BSD-2-Clause
 */

/** @addtogroup PUnit
  * @{
  */

#include <stdio.h>
#include "punit.h"

SET_DECLARE(punit_run, struct punit_test);
SET_DECLARE_WEAK(punit_skip, struct punit_test);

static int pu_tests_passed; /*!< Global tests passed counter. */
static int pu_tests_skipped; /*! Global tests skipped counter */

const char * const selva_db_version = "unittest";

/**
 * Test case description.
 * @param str a test case description string.
 */
void pu_test_description(char * str)
{
#if PU_REPORT_ORIENTED == 1
    printf("\t%s\n", str);
#endif
}

__weak_sym void setup(void)
{
}

__weak_sym void teardown(void)
{
}

int main(int argc __unused, char **argv __unused)
{
    const int nr_tests = (int)(SET_COUNT(punit_run) + SET_COUNT(punit_skip));
    struct punit_test **test_p;

    SET_FOREACH(test_p, punit_run) {
        struct punit_test *test = *test_p;
        const char * message;

        printf("-%s\n", test->name);
        setup();
        message = test->fn();
        teardown();
        if (message) {
            printf("\t%s\n", message);
        } else {
            pu_tests_passed++;
        }
    }

    SET_FOREACH(test_p, punit_skip) {
        struct punit_test *test = *test_p;

        printf("-%s, skipped\n", test->name);
        pu_tests_skipped++;
    }

    if (pu_tests_passed == SET_COUNT(punit_run) + SET_COUNT(punit_skip)) {
        printf("ALL TESTS PASSED\n");
    }

    printf("Test passed: %d/%d, skipped: %d\n\n",
            pu_tests_passed, nr_tests, pu_tests_skipped);

    return (pu_tests_passed + pu_tests_skipped) != nr_tests;
}

/**
  * @}
  */
