/*
 * Copyright (c) 2022-2023, 2025 SAULX
 * SPDX-License-Identifier: MIT
 */

#include <stddef.h>
#include <stdint.h>
#include "cstrings.h"

/*
 * This is exactly the same matcher used in
 * module/subscriptions.c
 */
static int field_matcher(const char *list, const char *field)
{
    const char *sep = ".";
    int match;
    char *p;

    match = stringlist_search(list, field, strlen(field), '\0');
    if (!match && (p = strstr(field, sep))) {
        do {
            const size_t len = (ptrdiff_t)p++ - (ptrdiff_t)field;

            match = stringlist_search(list, field, len, '\0');
        } while (!match && p && (p = strstr(p, sep)));
    }

    return match;
}

/*
 * FIXME mysterious stall with sztok.
 */
#if 0
PU_TEST(test_sztok_one)
{
    const char str[] = "hello";

    const char *s;
    size_t j = 0;
    while ((s = sztok(str, sizeof(str), &j))) {
        pu_assert_str_equal("", s, "hello");
    }

    return nullptr;
}

PU_TEST(test_sztok_two)
{
    const char str[] = "hello\0world";

    const char *s;
    size_t j = 0, k = 0;
    while ((s = sztok(str, sizeof(str), &j))) {
        if (k++ == 0) {
            pu_assert_str_equal("", s, "hello");
        } else {
            pu_assert_str_equal("", s, "world");
        }
    }

    pu_assert_equal("iterations", k, 2);

    return nullptr;
}

PU_TEST(test_sztok_with_strlen)
{
    const char *str = "hello";

    const char *s;
    size_t j = 0, k = 0;
    while ((s = sztok(str, strlen(str), &j))) {
        pu_assert_str_equal("", s, "hello");
        k++;
    }

    pu_assert_equal("iterations", k, 1);

    return nullptr;
}

/*
 * This could be a bit dangerous use case but it might happen.
 * Safe with selva_string.
 */
PU_TEST(test_sztok_two_minus)
{
    const char str[] = "hello\0world";

    const char *s;
    size_t j = 0, k = 0;
    while ((s = sztok(str, sizeof(str) - 1, &j))) {
        if (k++ == 0) {
            pu_assert_str_equal("", s, "hello");
        } else {
            pu_assert_str_equal("", s, "world");
        }
    }

    pu_assert_equal("iterations", k, 2);

    return nullptr;
}
#endif

PU_TEST(test_invalid_cases)
{
    const char *field = "title";
    int match;

    match = field_matcher("", field);
    pu_assert_equal("should not match", match, 0);

    match = stringlist_search("title", "", 0, '\0');
    pu_assert_equal("should not match", match, 0);

    match = stringlist_search("title", "\0", 1, '\0');
    pu_assert_equal("should not match", match, 0);

    return nullptr;
}

PU_TEST(test_simple_match)
{
    const char *list = "title";
    const char *field = "title";
    int match;

    match = field_matcher(list, field);
    pu_assert_equal("should just match", match, 1);

    return nullptr;
}

PU_TEST(test_simple_no_match)
{
    const char *list = "title";
    const char *field = "titlo";
    int match;

    match = field_matcher(list, field);
    pu_assert_equal("should not match", match, 0);

    return nullptr;
}

PU_TEST(test_simple_match_in_list)
{
    const char *list = "abc\ntitle\ndef";
    const char *field = "title";
    int match;

    match = field_matcher(list, field);
    pu_assert_equal("should match in the middle of the list", match, 1);

    return nullptr;
}

PU_TEST(test_simple_match_in_list_last)
{
    const char *list = "abc\ntitle\ndef";
    const char *field = "def";
    int match;

    match = field_matcher(list, field);
    pu_assert_equal("should match in the middle of the list", match, 1);

    return nullptr;
}

PU_TEST(test_sub_match)
{
    const char *list = "title";
    const char *field = "title.en";
    int match;

    match = field_matcher(list, field);
    pu_assert_equal("should just match", match, 1);

    return nullptr;
}

PU_TEST(test_sub_list_match)
{
    const char *list = "image\ntitle";
    const char *field = "title.en";
    int match;

    match = field_matcher(list, field);
    pu_assert_equal("should just match", match, 1);

    return nullptr;
}

PU_TEST(test_sub_list_no_match)
{
    const char *list = "image\ntitle.en";
    const char *field = "title.ru";
    int match;

    match = field_matcher(list, field);
    pu_assert_equal("should not match", match, 0);

    return nullptr;
}

PU_TEST(test_sub_list_no_match_inverse1)
{
    const char *list = "image\ntitle.en";
    const char *field = "title";
    int match;

    match = field_matcher(list, field);
    pu_assert_equal("should not match", match, 0);

    return nullptr;
}

PU_TEST(test_sub_list_no_match_inverse2)
{
    const char *list = "image\ntitle.en";
    const char *field = "title.ru";
    int match;

    match = field_matcher(list, field);
    pu_assert_equal("should not match", match, 0);

    return nullptr;
}

PU_TEST(test_broken_list1)
{
    const char *list = "image\ntitle\n";
    const char *field = "title.en";
    int match;

    match = field_matcher(list, field);
    pu_assert_equal("should match", match, 1);

    return nullptr;
}

PU_SKIP(test_broken_list2)
{
    const char *list = "pic\n\ntitle.en";
    const char *field = "title.en";
    int match;

    match = field_matcher(list, field);
    pu_assert_equal("should match", match, 1);

    return nullptr;
}

PU_TEST(test_empty_field)
{
    const char *list = "abc\ntitle\ndef";
    const char *field = "";
    int match;

    match = field_matcher(list, field);
    pu_assert_equal("no match", match, 0);

    return nullptr;
}

PU_TEST(test_long_string)
{
    const char *list = "abc\ntitle\ndef";
    const char field[] = "titlee";
    int match;

    match = stringlist_search(list, field, sizeof(field) - 3, '\0');
    pu_assert_equal("no match", match, 0);

    match = stringlist_search(list, field, sizeof(field) - 2, '\0');
    pu_assert_equal("match", match, 1);

    match = stringlist_search(list, field, sizeof(field) - 1, '\0');
    pu_assert_equal("no match", match, 0);

    return nullptr;
}

PU_TEST(test_strntol)
{
    const char *end;

    pu_assert_equal("", strntol("10", 2, nullptr), 10);
    pu_assert_equal("", strntol("-10", 3, nullptr), -10);

    strntol(" x10", 4, &end);
    pu_assert_nullptr("", end);

    return nullptr;
}
