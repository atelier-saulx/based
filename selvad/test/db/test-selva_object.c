/*
 * Copyright (c) 2023-2024 SAULX
 *
 * SPDX-License-Identifier: MIT
 */

#include <punit.h>
#include <stdlib.h>
#include <string.h>
#include "util/svector.h"
#include "util/selva_string.h"
#include "selva_error.h"
#include "selva_db.h"
#include "selva_object.h"

static struct SelvaObject *root_obj;

void setup(void)
{
    root_obj = SelvaObject_New();
    if (!root_obj) {
        abort();
    }
}

void teardown(void)
{
    if (root_obj) {
        SelvaObject_Destroy(root_obj);
    }
    root_obj = NULL;
}

PU_TEST(setget_double)
{
    struct selva_string *key_name = selva_string_create("x", 1, 0);
    double v = 0.0;
    int err;

    err = SelvaObject_SetDouble(root_obj, key_name, 1.0);
    pu_assert_err_equal("no error", err, 0);
    err = SelvaObject_GetDouble(root_obj, key_name, &v);
    pu_assert_err_equal("no error", err, 0);

    pu_assert_equal("output value is as expected", v, 1.0);

    selva_string_free(key_name);
    return NULL;
}

PU_TEST(setget_longlong)
{
    struct selva_string *key_name = selva_string_create("x", 1, 0);
    long long v = 0;
    int err;

    err = SelvaObject_SetLongLong(root_obj, key_name, 1);
    pu_assert_err_equal("no error", err, 0);
    err = SelvaObject_GetLongLong(root_obj, key_name, &v);
    pu_assert_err_equal("no error", err, 0);

    pu_assert_equal("output value is as expected", v, 1);

    selva_string_free(key_name);
    return NULL;
}

PU_TEST(setget_string)
{
    struct selva_string *key_name = selva_string_create("x", 1, 0);
    struct selva_string *orig = selva_string_create("hello", 5, 0);
    struct selva_string *value;
    const char *s1;
    const char *s2;
    int err;

    err = SelvaObject_SetString(root_obj, key_name, orig);
    pu_assert_err_equal("no error", err, 0);
    err = SelvaObject_GetString(root_obj, key_name, &value);
    pu_assert_err_equal("no error", err, 0);

    s1 = selva_string_to_str(orig, NULL);
    s2 = selva_string_to_str(value, NULL);
    pu_assert_str_equal("output value is as expected", s1, s2);

    selva_string_free(key_name);
    return NULL;
}

PU_TEST(delete_key_1)
{
    /*
     * { x: 1 } => null
     */

    struct selva_string *key_name = selva_string_create("x", 1, 0);
    long long v = 0;
    int err;

    err = SelvaObject_SetLongLong(root_obj, key_name, 1);
    pu_assert_err_equal("no error", err, 0);
    err = SelvaObject_DelKey(root_obj, key_name);
    pu_assert_err_equal("no error", err, 0);
    err = SelvaObject_GetLongLong(root_obj, key_name, &v);
    pu_assert_err_equal("no entry", err, SELVA_ENOENT);

    selva_string_free(key_name);
    return NULL;
}

PU_TEST(delete_key_2)
{
    /*
     * { x: "hello", y: 2 } => { y: 2 }
     */

    struct selva_string *key_name_1 = selva_string_create("x", 1, 0);
    struct selva_string *key_name_2 = selva_string_create("y", 1, 0);
    struct selva_string *orig = selva_string_create("hello", 5, 0);
    struct selva_string *s;
    long long v = 0;
    int err;

    err = SelvaObject_SetString(root_obj, key_name_1, orig);
    pu_assert_err_equal("no error", err, 0);
    err = SelvaObject_SetLongLong(root_obj, key_name_2, 2);
    pu_assert_err_equal("no error", err, 0);

    err = SelvaObject_DelKey(root_obj, key_name_1);
    pu_assert_err_equal("no error", err, 0);

    err = SelvaObject_GetString(root_obj, key_name_1, &s);
    pu_assert_err_equal("no entry", err, SELVA_ENOENT);

    err = SelvaObject_GetLongLong(root_obj, key_name_2, &v);
    pu_assert_err_equal("no error", err, 0);
    pu_assert_equal("value is as expected", v, 2);

    selva_string_free(key_name_1);
    selva_string_free(key_name_2);
    return NULL;
}

PU_TEST(nested_object)
{
    struct selva_string *key_name = selva_string_create("a.b", 3, 0);
    struct selva_string *wrong_key_name1 = selva_string_create("a.b.c", 5, 0);
    struct selva_string *wrong_key_name2 = selva_string_create("a", 1, 0);
    struct selva_string *orig = selva_string_create("hello", 5, 0);
    struct selva_string *value;
    const char *s1 = selva_string_to_str(orig, NULL);
    const char *s2;
    int err;

    err = SelvaObject_SetString(root_obj, key_name, orig);
    pu_assert_err_equal("no error", err, 0);

    err = SelvaObject_GetString(root_obj, key_name, &value);
    pu_assert_err_equal("no error", err, 0);
    s2 = selva_string_to_str(value, NULL);
    pu_assert_str_equal("output value is as expected", s1, s2);

    err = SelvaObject_GetString(root_obj, wrong_key_name1, &value);
    pu_assert_err_equal("no entry", err, SELVA_ENOENT);

    err = SelvaObject_GetString(root_obj, wrong_key_name2, &value);
    pu_assert_err_equal("no entry", err, SELVA_EINTYPE);

    selva_string_free(key_name);
    selva_string_free(wrong_key_name1);
    selva_string_free(wrong_key_name2);
    return NULL;
}

PU_TEST(replace_string_with_object)
{
    struct selva_string *key_name_1 = selva_string_create("a", 1, 0);
    struct selva_string *key_name_2 = selva_string_create("a.b", 3, 0);
    struct selva_string *key_name_3 = selva_string_create("a.b.c", 5, 0);
    struct selva_string *orig_1 = selva_string_create("hello", 5, 0);
    struct selva_string *orig_2 = selva_string_create("hallo", 5, 0);
    struct selva_string *orig_3 = selva_string_create("ciao", 4, 0);
    struct selva_string *value;
    const char *s1;
    const char *s2;
    int err;

    err = SelvaObject_SetString(root_obj, key_name_1, orig_1);
    pu_assert_err_equal("no error", err, 0);
    err = SelvaObject_GetString(root_obj, key_name_1, &value);
    pu_assert_err_equal("no error", err, 0);
    s1 = selva_string_to_str(orig_1, NULL);
    s2 = selva_string_to_str(value, NULL);
    pu_assert_str_equal("output value is as expected", s1, s2);

    err = SelvaObject_SetString(root_obj, key_name_2, orig_2);
    pu_assert_err_equal("no error", err, 0);
    value = NULL;
    err = SelvaObject_GetString(root_obj, key_name_1, &value);
    pu_assert_err_equal("type error", err, SELVA_EINTYPE);
    err = SelvaObject_GetString(root_obj, key_name_2, &value);
    pu_assert_err_equal("no error", err, 0);
    s1 = selva_string_to_str(orig_2, NULL);
    s2 = selva_string_to_str(value, NULL);
    pu_assert_str_equal("output value is as expected", s1, s2);

    err = SelvaObject_SetString(root_obj, key_name_3, orig_3);
    pu_assert_err_equal("no error", err, 0);
    err = SelvaObject_GetString(root_obj, key_name_1, &value);
    pu_assert_err_equal("type error", err, SELVA_EINTYPE);
    err = SelvaObject_GetString(root_obj, key_name_2, &value);
    pu_assert_err_equal("type error", err, SELVA_EINTYPE);
    err = SelvaObject_GetString(root_obj, key_name_3, &value);
    pu_assert_err_equal("no error", err, 0);
    s1 = selva_string_to_str(orig_3, NULL);
    s2 = selva_string_to_str(value, NULL);
    pu_assert_str_equal("output value is as expected", s1, s2);

    selva_string_free(key_name_1);
    selva_string_free(key_name_2);
    selva_string_free(key_name_3);
    return NULL;
}

PU_TEST(replace_object_with_string)
{
    struct selva_string *key_name_1 = selva_string_create("a.b.c", 5, 0);
    struct selva_string *key_name_2 = selva_string_create("a.b", 3, 0);
    struct selva_string *key_name_3 = selva_string_create("a", 1, 0);
    struct selva_string *orig_1 = selva_string_create("ciao", 4, 0);
    struct selva_string *orig_2 = selva_string_create("hallo", 5, 0);
    struct selva_string *orig_3 = selva_string_create("hello", 5, 0);
    struct selva_string *value;
    const char *s1;
    const char *s2;
    int err;

    err = SelvaObject_SetString(root_obj, key_name_1, orig_1);
    pu_assert_err_equal("no error", err, 0);
    err = SelvaObject_GetString(root_obj, key_name_1, &value);
    pu_assert_err_equal("no error", err, 0);
    s1 = selva_string_to_str(orig_1, NULL);
    s2 = selva_string_to_str(value, NULL);
    pu_assert_str_equal("output value is as expected", s1, s2);
    err = SelvaObject_GetString(root_obj, key_name_2, &value);
    pu_assert_err_equal("type error", err, SELVA_EINTYPE);
    err = SelvaObject_GetString(root_obj, key_name_3, &value);
    pu_assert_err_equal("type error", err, SELVA_EINTYPE);

    err = SelvaObject_SetString(root_obj, key_name_2, orig_2);
    pu_assert_err_equal("no error", err, 0);
    err = SelvaObject_GetString(root_obj, key_name_2, &value);
    pu_assert_err_equal("no error", err, 0);
    s1 = selva_string_to_str(orig_2, NULL);
    s2 = selva_string_to_str(value, NULL);
    pu_assert_str_equal("output value is as expected", s1, s2);
    err = SelvaObject_GetString(root_obj, key_name_1, &value);
    pu_assert_err_equal("type error", err, SELVA_ENOENT);
    err = SelvaObject_GetString(root_obj, key_name_3, &value);
    pu_assert_err_equal("type error", err, SELVA_EINTYPE);

    err = SelvaObject_SetString(root_obj, key_name_3, orig_3);
    pu_assert_err_equal("no error", err, 0);
    err = SelvaObject_GetString(root_obj, key_name_3, &value);
    pu_assert_err_equal("no error", err, 0);
    s1 = selva_string_to_str(orig_3, NULL);
    s2 = selva_string_to_str(value, NULL);
    pu_assert_str_equal("output value is as expected", s1, s2);
    err = SelvaObject_GetString(root_obj, key_name_1, &value);
    pu_assert_err_equal("type error", err, SELVA_ENOENT);
    err = SelvaObject_GetString(root_obj, key_name_2, &value);
    pu_assert_err_equal("type error", err, SELVA_ENOENT);

    selva_string_free(key_name_1);
    selva_string_free(key_name_2);
    selva_string_free(key_name_3);
    return NULL;
}

PU_TEST(delete_object)
{
    /*
     * Create:
     * {
     *   x: {
     *     a: "a",
     *     b: "b",
     *   },
     *   y: {
     *     c: "c",
     *     d: "d",
     *   }
     * }
     *
     * Delete:
     * x
     *
     * Expected result 1:
     * {
     *   y: {
     *     c: "c",
     *     d: "d",
     *   }
     * }
     */

    struct selva_string *key_name_x = selva_string_create("x", 1, 0);
    struct selva_string *key_name_1 = selva_string_create("x.a", 3, 0);
    struct selva_string *key_name_2 = selva_string_create("x.b", 3, 0);
    struct selva_string *key_name_3 = selva_string_create("y.c", 3, 0);
    struct selva_string *key_name_4 = selva_string_create("y.d", 3, 0);
    struct selva_string *orig_1 = selva_string_create("a", 1, 0);
    struct selva_string *orig_2 = selva_string_create("b", 1, 0);
    struct selva_string *orig_3 = selva_string_create("c", 1, 0);
    struct selva_string *orig_4 = selva_string_create("d", 1, 0);
    struct selva_string *value;
    const char *s1;
    const char *s2;
    int err;

    (void)SelvaObject_SetString(root_obj, key_name_1, orig_1);
    (void)SelvaObject_SetString(root_obj, key_name_2, orig_2);
    (void)SelvaObject_SetString(root_obj, key_name_3, orig_3);
    (void)SelvaObject_SetString(root_obj, key_name_4, orig_4);

    /* Delete */
    err = SelvaObject_DelKey(root_obj, key_name_x);
    pu_assert_err_equal("no error on del", err, 0);
    err = SelvaObject_DelKey(root_obj, key_name_x);
    pu_assert_err_equal("error on double del", err, SELVA_ENOENT);

    /* Assert */
    err = SelvaObject_GetString(root_obj, key_name_x, &value);
    pu_assert_err_equal("no entry", err, SELVA_ENOENT);
    err = SelvaObject_GetString(root_obj, key_name_1, &value);
    pu_assert_err_equal("no entry", err, SELVA_ENOENT);
    err = SelvaObject_GetString(root_obj, key_name_2, &value);
    pu_assert_err_equal("no entry", err, SELVA_ENOENT);
    err = SelvaObject_GetString(root_obj, key_name_3, &value);
    pu_assert_err_equal("no error", err, 0);
    s1 = selva_string_to_str(orig_3, NULL);
    s2 = selva_string_to_str(value, NULL);
    pu_assert_str_equal("output value is as expected", s1, s2);
    err = SelvaObject_GetString(root_obj, key_name_4, &value);
    pu_assert_err_equal("no error", err, 0);
    s1 = selva_string_to_str(orig_4, NULL);
    s2 = selva_string_to_str(value, NULL);
    pu_assert_str_equal("output value is as expected", s1, s2);

    selva_string_free(key_name_x);
    selva_string_free(key_name_1);
    selva_string_free(key_name_2);
    selva_string_free(key_name_3);
    selva_string_free(key_name_4);
    return NULL;
}

PU_TEST(delete_nested_key)
{
    /*
     * Create:
     * {
     *   x: {
     *     a: "a",
     *     b: "b",
     *   },
     *   y: {
     *     c: "c",
     *     d: "d",
     *   }
     * }
     *
     * Delete:
     * x.a
     *
     * Expected result 1:
     * {
     *   x: {
     *     b: "b",
     *   },
     *   y: {
     *     c: "c",
     *     d: "d",
     *   }
     * }
     *
     * Delete:
     * x.b
     *
     * Expected result 2:
     * {
     *   x: null,
     *   y: {
     *     c: "c",
     *     d: "d",
     *   }
     * }
     *
     * Delete:
     * x
     *
     * Expected result 3:
     * {
     *   y: {
     *     c: "c",
     *     d: "d",
     *   }
     * }
     */

    struct selva_string *key_name_x = selva_string_create("x", 1, 0);
    struct selva_string *key_name_1 = selva_string_create("x.a", 3, 0);
    struct selva_string *key_name_2 = selva_string_create("x.b", 3, 0);
    struct selva_string *key_name_3 = selva_string_create("y.c", 3, 0);
    struct selva_string *key_name_4 = selva_string_create("y.d", 3, 0);
    struct selva_string *orig_1 = selva_string_create("a", 1, 0);
    struct selva_string *orig_2 = selva_string_create("b", 1, 0);
    struct selva_string *orig_3 = selva_string_create("c", 1, 0);
    struct selva_string *orig_4 = selva_string_create("d", 1, 0);
    struct selva_string *value;
    const char *s1;
    const char *s2;
    int err;

    (void)SelvaObject_SetString(root_obj, key_name_1, orig_1);
    (void)SelvaObject_SetString(root_obj, key_name_2, orig_2);
    (void)SelvaObject_SetString(root_obj, key_name_3, orig_3);
    (void)SelvaObject_SetString(root_obj, key_name_4, orig_4);

    /* Delete 1 */
    err = SelvaObject_DelKey(root_obj, key_name_1);
    pu_assert_err_equal("no error on del", err, 0);
    err = SelvaObject_DelKey(root_obj, key_name_1);
    pu_assert_err_equal("error on double del", err, SELVA_ENOENT);

    /* Assert 1 */
    err = SelvaObject_GetString(root_obj, key_name_1, &value);
    pu_assert_err_equal("no entry", err, SELVA_ENOENT);
    err = SelvaObject_GetString(root_obj, key_name_2, &value);
    pu_assert_err_equal("no error", err, 0);
    s1 = selva_string_to_str(orig_2, NULL);
    s2 = selva_string_to_str(value, NULL);
    pu_assert_str_equal("output value is as expected", s1, s2);
    err = SelvaObject_GetString(root_obj, key_name_3, &value);
    pu_assert_err_equal("no error", err, 0);
    s1 = selva_string_to_str(orig_3, NULL);
    s2 = selva_string_to_str(value, NULL);
    pu_assert_str_equal("output value is as expected", s1, s2);
    err = SelvaObject_GetString(root_obj, key_name_4, &value);
    pu_assert_err_equal("no error", err, 0);
    s1 = selva_string_to_str(orig_4, NULL);
    s2 = selva_string_to_str(value, NULL);
    pu_assert_str_equal("output value is as expected", s1, s2);

    /* Delete 2 */
    err = SelvaObject_DelKey(root_obj, key_name_2);
    pu_assert_err_equal("no error on del", err, 0);
    err = SelvaObject_DelKey(root_obj, key_name_2);
    pu_assert_err_equal("error on double del", err, SELVA_ENOENT);

    /* Assert 2 */
    err = SelvaObject_GetString(root_obj, key_name_1, &value);
    pu_assert_err_equal("no entry", err, SELVA_ENOENT);
    err = SelvaObject_GetString(root_obj, key_name_2, &value);
    pu_assert_err_equal("no entry", err, SELVA_ENOENT);
    err = SelvaObject_GetString(root_obj, key_name_3, &value);
    pu_assert_err_equal("no error", err, 0);
    s1 = selva_string_to_str(orig_3, NULL);
    s2 = selva_string_to_str(value, NULL);
    pu_assert_str_equal("output value is as expected", s1, s2);
    err = SelvaObject_GetString(root_obj, key_name_4, &value);
    pu_assert_err_equal("no error", err, 0);
    s1 = selva_string_to_str(orig_4, NULL);
    s2 = selva_string_to_str(value, NULL);
    pu_assert_str_equal("output value is as expected", s1, s2);

    /* Delete 2 */
    err = SelvaObject_DelKey(root_obj, key_name_x);
    pu_assert_err_equal("no error on del", err, 0);
    err = SelvaObject_DelKey(root_obj, key_name_x);
    pu_assert_err_equal("error on double del", err, SELVA_ENOENT);

    /* Assert 3 */
    err = SelvaObject_GetString(root_obj, key_name_3, &value);
    pu_assert_err_equal("no error", err, 0);
    s1 = selva_string_to_str(orig_3, NULL);
    s2 = selva_string_to_str(value, NULL);
    pu_assert_str_equal("output value is as expected", s1, s2);
    err = SelvaObject_GetString(root_obj, key_name_4, &value);
    pu_assert_err_equal("no error", err, 0);
    s1 = selva_string_to_str(orig_4, NULL);
    s2 = selva_string_to_str(value, NULL);
    pu_assert_str_equal("output value is as expected", s1, s2);

    selva_string_free(key_name_x);
    selva_string_free(key_name_1);
    selva_string_free(key_name_2);
    selva_string_free(key_name_3);
    selva_string_free(key_name_4);
    return NULL;
}

PU_TEST(string_array)
{
    int err;
    struct selva_string *key_name = selva_string_create("x", 1, 0);
    struct selva_string *e1 = selva_string_create("1", 1, 0);
    struct selva_string *e2 = selva_string_create("2", 1, 0);
    struct selva_string *e3 = selva_string_create("3", 1, 0);
    struct selva_string *e4 = selva_string_create("4", 1, 0);

    err = SelvaObject_InsertArray(root_obj, key_name, SELVA_OBJECT_STRING, e1);
    pu_assert_err_equal("no error", err, 0);
    err = SelvaObject_InsertArray(root_obj, key_name, SELVA_OBJECT_STRING, e2);
    pu_assert_err_equal("no error", err, 0);
    err = SelvaObject_InsertArray(root_obj, key_name, SELVA_OBJECT_STRING, e3);
    pu_assert_err_equal("no error", err, 0);
    err = SelvaObject_InsertArray(root_obj, key_name, SELVA_OBJECT_STRING, e4);
    pu_assert_err_equal("no error", err, 0);

    enum SelvaObjectType subtype;
    SVector *arr;

    err = SelvaObject_GetArray(root_obj, key_name, &subtype, &arr);
    pu_assert_err_equal("no error", err, 0);
    pu_assert_equal("correct subtype", subtype, SELVA_OBJECT_STRING);
    pu_assert("The SVector pointer was set", arr != NULL);

    pu_assert_ptr_equal("e1", SVector_GetIndex(arr, 0), e1);
    pu_assert_ptr_equal("e2", SVector_GetIndex(arr, 1), e2);
    pu_assert_ptr_equal("e3", SVector_GetIndex(arr, 2), e3);
    pu_assert_ptr_equal("e4", SVector_GetIndex(arr, 3), e4);

    selva_string_free(key_name);
    return NULL;
}

static int freed;

static void ptr_free(void *p __unused) {
    freed = 1;
}

static size_t ptr_len(void *p __unused) {
    return 42;
}

PU_TEST(pointer_values)
{
    int err;
    struct SelvaObjectPointerOpts opts = {
        .ptr_type_id = 1,
        .ptr_free = ptr_free,
        .ptr_len = ptr_len,
    };
    struct data {
        char *text;
        int value;
    } d = {
        .text = "hello",
        .value = 10,
    };

    freed = 0;

    err = SelvaObject_SetPointerStr(root_obj, "mykey", 5, &d, &opts);
    pu_assert_err_equal("no error when setting a pointer", err, 0);

    ssize_t len = SelvaObject_LenStr(root_obj, "mykey", 5);
    pu_assert_equal("got correct len", len, 42);

    void *p;
    struct data *dp;
    err = SelvaObject_GetPointerStr(root_obj, "mykey", 5, &p);
    dp = (struct data *)p;
    pu_assert_err_equal("no error when getting a pointer", err, 0);
    pu_assert_ptr_equal("got a pointer to the same data", dp, &d);

    err = SelvaObject_DelKeyStr(root_obj, "mykey", 5);
    pu_assert_err_equal("no error when deleting", err, 0);
    pu_assert_equal("ptr_free() was called", freed, 1);

    return NULL;
}

PU_SKIP(set_invalid_array_key_1)
{
    const char key_name_str[] = "x]";
    const size_t key_name_len = sizeof(key_name_str) - 1;
    int err;

    err = SelvaObject_SetDoubleStr(root_obj, key_name_str, key_name_len, 1.0);
    pu_assert_err_equal("fail", err, SELVA_EINVAL);

    return NULL;
}

PU_SKIP(set_invalid_array_key_2)
{
    const char key_name_str[] = "x.y]";
    const size_t key_name_len = sizeof(key_name_str) - 1;
    int err;

    err = SelvaObject_SetDoubleStr(root_obj, key_name_str, key_name_len, 1.0);
    pu_assert_err_equal("fail", err, SELVA_EINVAL);

    return NULL;
}
