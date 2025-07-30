/*
 * Copyright (c) 2022-2025 SAULX
 * SPDX-License-Identifier: MIT
 */

#include <stddef.h>
#include <stdio.h>
#include "selva/selva_string.h"

void setup(void)
{
    selva_string_init_tls();
}

void teardown(void)
{
    selva_string_deinit_tls();
}

PU_TEST(test_create)
{
    struct selva_string *s;
    const char *str;
    size_t len;

    s = selva_string_create("hello world", 11, 0);
    pu_assert("a pointer is returned", s);

    str = selva_string_to_str(s, &len);
    pu_assert_str_equal("the string was set", str, "hello world");
    pu_assert_equal("length was returned correctly", len, 11);

    selva_string_free(s);

    return nullptr;
}

PU_TEST(test_createf)
{
    struct selva_string *s;
    const char *str;
    size_t len;

    s = selva_string_createf("hello %s: %d", "world", 10);

    str = selva_string_to_str(s, &len);
    pu_assert_str_equal("the string was set", str, "hello world: 10");
    pu_assert_equal("length was returned correctly", len, 16); /* TODO Not sure if we want to have it this way in the future. */

    selva_string_free(s);

    return nullptr;
}

PU_TEST(test_createz)
{
    static char uncompressed[1048576];
    struct selva_string *s1;
    struct selva_string *s2;

    memset(uncompressed, 'u', sizeof(uncompressed));

    s1 = selva_string_create(uncompressed, sizeof(uncompressed), 0);
    s2 = selva_string_createz(uncompressed, sizeof(uncompressed), 0);

    pu_assert_equal("compressed flag is set", selva_string_get_flags(s2), SELVA_STRING_COMPRESS);
    pu_assert("cratio looks good", selva_string_getz_cratio(s2) > 1);
    pu_assert_equal("cmp", selva_string_cmp(s1, s2), 0);

    return nullptr;
}

PU_TEST(test_dup)
{
    struct selva_string *s1;
    struct selva_string *s2;
    const char *str;
    size_t len;

    s1 = selva_string_create("hello world", 11, 0);
    pu_assert("created", s1);
    s2 = selva_string_dup(s1, 0);
    pu_assert("cloned", s2);
    str = selva_string_to_str(s2, &len);
    pu_assert_buf_equal("cloned string equals the original", str, "hello world", len);

    selva_string_free(s1);
    selva_string_free(s2);

    return nullptr;
}

PU_TEST(test_truncate)
{
    struct selva_string *s;
    const char *str;
    size_t len;

    s = selva_string_create("hello world", 11, SELVA_STRING_MUTABLE);
    pu_assert("a pointer is returned", s);
    selva_string_truncate(s, 5);
    str = selva_string_to_str(s, &len);
    pu_assert_equal("len exp", len, 5);
    pu_assert_buf_equal("string was truncated", str, "hello", 5);

    selva_string_free(s);

    return nullptr;
}

PU_TEST(test_append)
{
    struct selva_string *s;
    const char *str;
    size_t len;

    s = selva_string_create("hello", 5, SELVA_STRING_MUTABLE);
    pu_assert("a pointer is returned", s);
    selva_string_append(s, " world", 6);
    str = selva_string_to_str(s, &len);
    pu_assert_buf_equal("string was appended", str, "hello world", len);

    selva_string_free(s);

    return nullptr;
}

PU_TEST(test_replace)
{
    struct selva_string *s;
    const char *str;
    size_t len;

    s = selva_string_create("uvw", 3, SELVA_STRING_MUTABLE);
    pu_assert("a pointer is returned", s);
    selva_string_replace(s, "xyz", 3);
    str = selva_string_to_str(s, &len);
    pu_assert_buf_equal("string was replaced", str, "xyz", len);

    selva_string_free(s);

    return nullptr;
}

PU_TEST(test_crc)
{
    struct selva_string *s;
    const char *str;
    size_t len;

    s = selva_string_create("hello", 5, SELVA_STRING_MUTABLE | SELVA_STRING_CRC);
    pu_assert("a pointer is returned", s);
    pu_assert_equal("CRC verifies", selva_string_verify_crc(s), 1);
    selva_string_append(s, " world", 6);
    pu_assert_equal("CRC verifies", selva_string_verify_crc(s), 1);
    str = selva_string_to_str(s, &len);

    ((char *)str)[1] = 'a';
    pu_assert_equal("CRC fails", selva_string_verify_crc(s), 0);
    ((char *)str)[1] = 'e';
    pu_assert_equal("CRC fails", selva_string_verify_crc(s), 1);

    selva_string_free(s);

    return nullptr;
}

PU_TEST(test_cmp)
{
    struct selva_string *s1;
    struct selva_string *s2;
    struct selva_string *s3;

    s1 = selva_string_create("abraham", 7, 0);
    s2 = selva_string_create("isaac", 5, 0);
    s3 = selva_string_create("hagar", 5, 0);

    pu_assert_equal("cmp works", selva_string_cmp(s1, s1), 0);
    pu_assert_equal("cmp works", selva_string_cmp(s1, s2), -8);
    pu_assert_equal("cmp works", selva_string_cmp(s1, s3), -7);
    pu_assert_equal("cmp works", selva_string_cmp(s2, s3), 1);

    selva_string_free(s1);
    selva_string_free(s2);
    selva_string_free(s3);

    return nullptr;
}
