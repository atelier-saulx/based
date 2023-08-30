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

#define assert_list(list, idx, expected) do { \
    struct selva_string *s = NULL; \
    int err; \
    err = SelvaObject_GetStringStr((list), (idx), strlen(idx), &s); \
    pu_assert_equal("no error", err, 0); \
    pu_assert_not_null("string returned", s); \
    pu_assert_str_equal("string found", selva_string_to_str(s, NULL), (expected)); \
} while (0)

static char * test_parse1(void)
{
    struct selva_string *input = selva_string_createf("a|b\n!c\nd|!e\n\n!f|g\n!id");
    struct SelvaObject *list = NULL;
    struct selva_string *excl = NULL;
    int err;

    selva_string_auto_finalize(&fin, input);

    err = parse_string_set(&fin, input, &list, "!",
                           (struct selva_string **[]){ &excl });
    pu_assert_equal("", err, 0);
    pu_assert_str_equal("excl parsed", selva_string_to_str(excl, NULL), "c\nf|g\n");

    assert_list(list, "0[0]", "a");
    assert_list(list, "0[1]", "b");
    assert_list(list, "1[0]", "d");
    assert_list(list, "1[1]", "!e");

    return NULL;
}

static char * test_parse2(void)
{
    struct selva_string *input = selva_string_createf("a\n!b\n%%c\n&e\n");
    struct SelvaObject *list_a = NULL;
    struct selva_string *list_b = NULL;
    struct selva_string *list_c = NULL;
    struct selva_string *list_d = NULL;
    struct selva_string *list_e = NULL;
    int err;

    selva_string_auto_finalize(&fin, input);

    err = parse_string_set(&fin, input, &list_a, "!%^&",
                           (struct selva_string **[]){ &list_b, &list_c, &list_d, &list_e });
    pu_assert_equal("", err, 0);
    pu_assert_not_null("", list_b);
    pu_assert_str_equal("b parsed", selva_string_to_str(list_b, NULL), "b\n");
    pu_assert_not_null("", list_c);
    pu_assert_str_equal("c parsed", selva_string_to_str(list_c, NULL), "c\n");
    pu_assert_null("no list d", list_d);
    pu_assert_not_null("", list_e);
    pu_assert_str_equal("e parsed", selva_string_to_str(list_e, NULL), "e\n");

    assert_list(list_a, "0[0]", "a");

    return NULL;
}

static char *test_parse3(void)
{
    struct selva_string *input = selva_string_createf("best@name|id\ndesc\ninvalid@\n@otherinvalid\n");
    struct SelvaObject *list = NULL;
    struct selva_string *excl = NULL;
    int err;

    err = parse_string_set(&fin, input, &list, "&",
                           (struct selva_string **[]){ &excl });
    pu_assert_equal("", err, 0);
    pu_assert_null("", excl);

    assert_list(list, "best@[0]", "name");
    assert_list(list, "best@[1]", "id");
    assert_list(list, "1[0]", "desc");

    return NULL;
}

void all_tests(void)
{
    pu_def_test(test_parse1, PU_RUN);
    pu_def_test(test_parse2, PU_RUN);
    pu_def_test(test_parse3, PU_RUN);
}
