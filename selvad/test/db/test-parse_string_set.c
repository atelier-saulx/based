/*
 * Copyright (c) 2023 SAULX
 *
 * SPDX-License-Identifier: MIT
 */

#include <punit.h>
#include <stdint.h>
#include "util/finalizer.h"
#include "util/selva_string.h"
#include "selva_object.h"
#include "parsers.h"

static struct finalizer fin;

static void setup(void)
{
    finalizer_init(&fin);
}

static void teardown(void)
{
    finalizer_run(&fin);
}

static char * test_parse1(void)
{
    struct selva_string *input = selva_string_createf("a|b\n!c\nd|!e\n!f|g");
    struct SelvaObject *list = NULL;
    struct selva_string *excl = NULL;
    int err;

    selva_string_auto_finalize(&fin, input);

    err = parse_string_set(&fin, input, &list, "!",
                           (struct selva_string **[]){ &excl });
    pu_assert_equal("", err, 0);
    pu_assert_str_equal("excl parsed", selva_string_to_str(excl, NULL), "c\ne\nf\n");

    /* TODO Check list */

    return NULL;
}

static char * test_parse2(void)
{
    struct selva_string *input = selva_string_createf("a\n!b\n@c\n");
    struct SelvaObject *list_a = NULL;
    struct selva_string *list_b = NULL;
    struct selva_string *list_c = NULL;
    int err;

    selva_string_auto_finalize(&fin, input);

    err = parse_string_set(&fin, input, &list_a, "!@",
                           (struct selva_string **[]){ &list_b, &list_c });
    pu_assert_equal("", err, 0);
    pu_assert_str_equal("excl parsed", selva_string_to_str(list_b, NULL), "b\n");
    pu_assert_str_equal("excl parsed", selva_string_to_str(list_c, NULL), "c\n");

    /* TODO Check list */

    return NULL;
}

void all_tests(void)
{
    pu_def_test(test_parse1, PU_RUN);
    pu_def_test(test_parse2, PU_RUN);
}
