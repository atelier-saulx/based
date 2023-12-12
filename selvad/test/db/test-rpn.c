/*
 * Copyright (c) 2023 SAULX
 *
 * SPDX-License-Identifier: MIT
 */
#include <punit.h>
#include <stdlib.h>
#include <string.h>
#include "jemalloc.h"
#include "util/selva_string.h"
#include "selva_set.h"
#include "../../tunables.h"
#include "rpn.h"

static struct rpn_expression *expr;
static struct rpn_ctx *ctx;
static char **reg;
static const int nr_reg = 10;

void setup(void)
{
    reg = selva_calloc(nr_reg, sizeof(char *));
    ctx = rpn_init(nr_reg);
    expr = NULL;
}

void teardown(void)
{
    selva_free(reg);
    rpn_destroy(ctx);
    rpn_destroy_expression(expr);
}

PU_TEST(test_init_works)
{
    pu_assert_equal("nr_reg is set", ctx->nr_reg, nr_reg);

    return NULL;
}

PU_TEST(test_number_valid)
{
    enum rpn_error err;
    long long res;
    const char expr_str[] = "#1";

    expr = rpn_compile(expr_str);
    pu_assert("expr is created", expr);

    err = rpn_integer(ctx, expr, &res);

    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("result is valid", res, 1);

    return NULL;
}

PU_TEST(test_number_invalid)
{
    const char expr_str[] = "#r";

    expr = rpn_compile(expr_str);
    pu_assert("expr is not created", !expr);

    return NULL;
}

PU_TEST(test_operand_pool_overflow)
{
    const size_t nr_operands = RPN_SMALL_OPERAND_POOL_SIZE + 5;
    char expr_str[3 * nr_operands + 1];

    memset(expr_str, '\0', sizeof(expr_str));

    for (size_t i = 0; i < nr_operands; i++) {
        size_t op = i * 3;

        expr_str[op + 0] = '#';
        expr_str[op + 1] = '1';
        expr_str[op + 2] = ' ';
    }

    expr = rpn_compile(expr_str);
    pu_assert("expr is created", expr);

    return NULL;
}

PU_TEST(test_stack_overflow)
{
    char expr_str[2 * (RPN_MAX_D * 2) + 3];
    int res;
    enum rpn_error err;

    memset(expr_str, '\0', sizeof(expr_str));

    for (size_t i = 0; i < 2 * RPN_MAX_D; i++) {
        size_t op = i * 2;

        expr_str[op + 0] = 'L';
        expr_str[op + 1] = ' ';
    }
    expr_str[sizeof(expr_str) - 2] = 'L';

    expr = rpn_compile(expr_str);
    pu_assert("expr is created", expr);

    err = rpn_bool(ctx, expr, &res);

    pu_assert_equal("should get stack overflow", err, RPN_ERR_BADSTK);

    return NULL;
}

PU_TEST(test_add)
{
    enum rpn_error err;
    long long res;
    const char expr_str[] = "#1 #1 A";

    expr = rpn_compile(expr_str);
    pu_assert("expr is created", expr);

    err = rpn_integer(ctx, expr, &res);

    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("1 + 1", res, 2);

    return NULL;
}

PU_TEST(test_add_double)
{
    enum rpn_error err;
    double res;
    const char expr_str[] = "#1.5 #0.4 A";

    expr = rpn_compile(expr_str);
    pu_assert("expr is created", expr);

    err = rpn_double(ctx, expr, &res);

    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("1.5 + 0.4", res, 1.9);

    return NULL;
}

PU_TEST(test_mul)
{
    enum rpn_error err;
    long long res;
    const char expr_str[] = "#2 #2 D";

    expr = rpn_compile(expr_str);
    pu_assert("expr is created", expr);

    err = rpn_integer(ctx, expr, &res);

    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("2 * 2", res, 4);

    return NULL;
}

PU_TEST(test_rem)
{
    enum rpn_error err;
    long long res;
    const char expr_str[] = "#8 #42 E";

    expr = rpn_compile(expr_str);
    pu_assert("expr is created", expr);

    err = rpn_integer(ctx, expr, &res);

    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("42 % 8", res, 2);

    return NULL;
}

PU_TEST(test_necessarily_or)
{
    enum rpn_error err;
    long long res;
    const char expr_str[] = "@1 P @2 N";

    expr = rpn_compile(expr_str);
    pu_assert("expr is created", expr);

    err = rpn_set_reg(ctx, 1, "0", 1, 0);
    err = rpn_set_reg(ctx, 2, "0", 1, 0);
    pu_assert_equal("reg is set", err, RPN_ERR_OK);
    err = rpn_integer(ctx, expr, &res);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("necess(0) || 0 == false", res, 0);

    err = rpn_set_reg(ctx, 1, "0", 1, 0);
    err = rpn_set_reg(ctx, 2, "1", 1, 0);
    pu_assert_equal("reg is set", err, RPN_ERR_OK);
    err = rpn_integer(ctx, expr, &res);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("necess(0) || 1 == true", res, 0);

    err = rpn_set_reg(ctx, 1, "1", 1, 0);
    err = rpn_set_reg(ctx, 2, "0", 1, 0);
    pu_assert_equal("reg is set", err, RPN_ERR_OK);
    err = rpn_integer(ctx, expr, &res);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("necess(1) || 0 == true", res, 1);

    err = rpn_set_reg(ctx, 1, "1", 1, 0);
    err = rpn_set_reg(ctx, 2, "1", 1, 0);
    pu_assert_equal("reg is set", err, RPN_ERR_OK);
    err = rpn_integer(ctx, expr, &res);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("necess(1) || 1 == true", res, 1);

    return NULL;
}

PU_TEST(test_necessarily_and)
{
    enum rpn_error err;
    long long res;
    const char expr_str[] = "@1 P @2 M";

    expr = rpn_compile(expr_str);
    pu_assert("expr is created", expr);

    err = rpn_set_reg(ctx, 1, "0", 1, 0);
    err = rpn_set_reg(ctx, 2, "0", 1, 0);
    pu_assert_equal("reg is set", err, RPN_ERR_OK);
    err = rpn_integer(ctx, expr, &res);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("necess(0) && 0 == false", res, 0);

    err = rpn_set_reg(ctx, 1, "0", 1, 0);
    err = rpn_set_reg(ctx, 2, "1", 1, 0);
    pu_assert_equal("reg is set", err, RPN_ERR_OK);
    err = rpn_integer(ctx, expr, &res);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("necess(1) && 0 == false", res, 0);

    err = rpn_set_reg(ctx, 1, "1", 1, 0);
    err = rpn_set_reg(ctx, 2, "0", 1, 0);
    pu_assert_equal("reg is set", err, RPN_ERR_OK);
    err = rpn_integer(ctx, expr, &res);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("necess(0) && 1 == false", res, 0);

    err = rpn_set_reg(ctx, 1, "1", 1, 0);
    err = rpn_set_reg(ctx, 2, "1", 1, 0);
    pu_assert_equal("reg is set", err, RPN_ERR_OK);
    err = rpn_integer(ctx, expr, &res);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("necess(1) || 1 == true", res, 1);

    return NULL;
}

PU_TEST(test_possibly_or)
{
    enum rpn_error err;
    long long res;
    const char expr_str[] = "@1 Q @2 N";

    expr = rpn_compile(expr_str);
    pu_assert("expr is created", expr);

    err = rpn_set_reg(ctx, 1, "0", 1, 0);
    err = rpn_set_reg(ctx, 2, "0", 1, 0);
    pu_assert_equal("reg is set", err, RPN_ERR_OK);
    err = rpn_integer(ctx, expr, &res);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("possib(0) || 0 == false", res, 0);

    err = rpn_set_reg(ctx, 1, "0", 1, 0);
    err = rpn_set_reg(ctx, 2, "1", 1, 0);
    pu_assert_equal("reg is set", err, RPN_ERR_OK);
    err = rpn_integer(ctx, expr, &res);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("possib(0) || 1 == true", res, 1);

    err = rpn_set_reg(ctx, 1, "1", 1, 0);
    err = rpn_set_reg(ctx, 2, "0", 1, 0);
    pu_assert_equal("reg is set", err, RPN_ERR_OK);
    err = rpn_integer(ctx, expr, &res);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("possib(1) || 0 == true", res, 1);

    err = rpn_set_reg(ctx, 1, "1", 1, 0);
    err = rpn_set_reg(ctx, 2, "1", 1, 0);
    pu_assert_equal("reg is set", err, RPN_ERR_OK);
    err = rpn_integer(ctx, expr, &res);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("possib(1) || 1 == true", res, 1);

    return NULL;
}

PU_TEST(test_possibly_and)
{
    enum rpn_error err;
    long long res;
    const char expr_str[] = "@1 Q @2 M";

    expr = rpn_compile(expr_str);
    pu_assert("expr is created", expr);

    err = rpn_set_reg(ctx, 1, "0", 1, 0);
    err = rpn_set_reg(ctx, 2, "0", 1, 0);
    pu_assert_equal("reg is set", err, RPN_ERR_OK);
    err = rpn_integer(ctx, expr, &res);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("possib(0) && 0 == false", res, 0);

    err = rpn_set_reg(ctx, 1, "0", 1, 0);
    err = rpn_set_reg(ctx, 2, "1", 1, 0);
    pu_assert_equal("reg is set", err, RPN_ERR_OK);
    err = rpn_integer(ctx, expr, &res);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("possib(0) && 1 == true", res, 0);

    err = rpn_set_reg(ctx, 1, "1", 1, 0);
    err = rpn_set_reg(ctx, 2, "0", 1, 0);
    pu_assert_equal("reg is set", err, RPN_ERR_OK);
    err = rpn_integer(ctx, expr, &res);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("possib(1) && 0 == false", res, 1);

    err = rpn_set_reg(ctx, 1, "1", 1, 0);
    err = rpn_set_reg(ctx, 2, "1", 1, 0);
    pu_assert_equal("reg is set", err, RPN_ERR_OK);
    err = rpn_integer(ctx, expr, &res);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("possib(1) && 1 == true", res, 1);

    return NULL;
}

PU_TEST(test_ternary)
{
    enum rpn_error err;
    const char expr_str[] = "$3 $2 @1 T";
    struct selva_string *res = NULL;

    expr = rpn_compile(expr_str);
    pu_assert("expr is created", expr);

    for (int i = 0; i <= 1; i++) {
        char a[1] = "0";
        a[0] += i;
        char expected[2] = "C";
        expected[0] -= i;

        err = rpn_set_reg(ctx, 1, a, 1, 0);
        pu_assert_equal("reg is set", err, RPN_ERR_OK);
        err = rpn_set_reg(ctx, 2, "B", 2, 0);
        pu_assert_equal("reg is set", err, RPN_ERR_OK);
        err = rpn_set_reg(ctx, 3, "C", 2, 0);
        pu_assert_equal("reg is set", err, RPN_ERR_OK);
        err = rpn_string(ctx, expr, &res);
        pu_assert_equal("No error", err, RPN_ERR_OK);

        TO_STR(res);
        pu_assert_str_equal("Ternary result is valid", res_str, expected);
        selva_string_free(res);
    }

    return NULL;
}

PU_TEST(test_range)
{
    enum rpn_error err;
    long long res;
    const char expr_str[] = "#10 @1 #1 i";

    expr = rpn_compile(expr_str);
    pu_assert("expr is created", expr);

    err = rpn_set_reg(ctx, 1, "0", 1, 0);
    pu_assert_equal("reg is set", err, RPN_ERR_OK);
    err = rpn_integer(ctx, expr, &res);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("1 <= 0 <= 10 == false", res, 0);

    err = rpn_set_reg(ctx, 1, "1", 1, 0);
    pu_assert_equal("reg is set", err, RPN_ERR_OK);
    err = rpn_integer(ctx, expr, &res);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("1 <= 1 <= 10 == true", res, 1);

    err = rpn_set_reg(ctx, 1, "10", 2, 0);
    pu_assert_equal("reg is set", err, RPN_ERR_OK);
    err = rpn_integer(ctx, expr, &res);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("1 <= 10 <= 10 == true", res, 1);

    err = rpn_set_reg(ctx, 1, "11", 2, 0);
    pu_assert_equal("reg is set", err, RPN_ERR_OK);
    err = rpn_integer(ctx, expr, &res);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("1 <= 11 <= 10 == false", res, 0);

    return NULL;
}

PU_TEST(test_selvaset_inline)
{
    enum rpn_error err;
    const char expr_str[] = "{\"abc\",\"def\",\"verylongtextisalsoprettynice\",\"this is another one that is fairly long and with spaces\",\"nice\"}";
    struct SelvaSet set;

    expr = rpn_compile(expr_str);
    pu_assert("expr is created", expr);

    SelvaSet_Init(&set, SELVA_SET_TYPE_STRING);
    err = rpn_selvaset(ctx, expr, &set);
    pu_assert_equal("No error", err, RPN_ERR_OK);

    const char *expected[] = {
        "abc",
        "def",
        "verylongtextisalsoprettynice",
        "this is another one that is fairly long and with spaces",
        "nice",
    };

    for (size_t i = 0; i < num_elem(expected); i++) {
        struct selva_string *rms;

        rms = selva_string_create(expected[i], strlen(expected[i]), 0);
        fprintf(stderr, "Has %s\n", expected[i]);
        pu_assert_equal("string is found in the set", 1, SelvaSet_Has(&set, rms));
        selva_string_free(rms);
    }
    pu_assert_equal("Set size is correct", num_elem(expected), set.size);

    SelvaSet_Destroy(&set);

    return NULL;
}

PU_TEST(test_selvaset_union)
{
    enum rpn_error err;
    const char expr_str[] = "{\"a\",\"b\"} {\"c\",\"d\"} z";
    struct SelvaSet set;

    expr = rpn_compile(expr_str);
    pu_assert("expr is created", expr);

    SelvaSet_Init(&set, SELVA_SET_TYPE_STRING);
    err = rpn_selvaset(ctx, expr, &set);
    pu_assert_equal("No error", err, RPN_ERR_OK);

    const char *expected[] = { "a", "b", "c", "d" };

    for (size_t i = 0; i < num_elem(expected); i++) {
        struct selva_string *rms;

        rms = selva_string_create(expected[i], strlen(expected[i]), 0);
        pu_assert_equal("string is found in the set", 1, SelvaSet_Has(&set, rms));
        selva_string_free(rms);
    }
    pu_assert_equal("Set size is correct", num_elem(expected), set.size);

    SelvaSet_Destroy(&set);

    return NULL;
}

PU_TEST(test_selvaset_empty)
{
    enum rpn_error err;
    const char expr_str[] = "\"e\" {} a";
    int res;

    expr = rpn_compile(expr_str);
    pu_assert("expr is created", expr);

    err = rpn_bool(ctx, expr, &res);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("Not found", res, 0);

    return NULL;
}

PU_TEST(test_selvaset_empty_2)
{
    enum rpn_error err;
    const char expr_str[] = "{\"a\"} {\"b\"} #0 P T";
    int res;
    struct SelvaSet set;

    expr = rpn_compile(expr_str);
    pu_assert("expr is created", expr);

    err = rpn_bool(ctx, expr, &res);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("Resolves to false", res, 0);

    SelvaSet_Init(&set, SELVA_SET_TYPE_STRING);
    err = rpn_selvaset(ctx, expr, &set);
    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("Returned empty set", SelvaSet_Size(&set), 0);

    return NULL;
}

PU_TEST(test_selvaset_ill)
{
    const char expr_str1[] = "{\"abc\",\"def\",\"verylongtextisalsoprettynice\",\"this is another one that is fairly long and with spaces\",\"nice\"";
    const char expr_str2[] = "{\"abc\",\"def\",\"verylongtextisalsoprettynice\",\"this is another one that is fairly long and with spaces,\"nice\"}";
    const char expr_str3[] = "{\"abc\",\"def\",\"verylongtextisalsoprettynice\",\"this is another one that is fairly long and with spaces\", \"nice\"}";
    const char expr_str4[] = "{abc\",\"def\",\"verylongtextisalsoprettynice\",\"this is another one that is fairly long and with spaces\", \"nice\"}";
    const char expr_str5[] = "{abc\",\"def\",\"verylongtextisalsoprettynice\",\"this is another one that is fairly long and with spaces\", \"nice\",}";

    pu_assert_equal("Fails", NULL, rpn_compile(expr_str1));
    pu_assert_equal("Fails", NULL, rpn_compile(expr_str2));
    pu_assert_equal("Fails", NULL, rpn_compile(expr_str3));
    pu_assert_equal("Fails", NULL, rpn_compile(expr_str4));
    pu_assert_equal("Fails", NULL, rpn_compile(expr_str5));

    return NULL;
}

PU_TEST(test_cond_jump)
{
    static const char expr_str[][30] = {
        "#1 #1 A #1 >1  #1 A .1:X",
        "#1 #1 A #0 >1  #1 A .1:X",
        "#1 #1 A #1 >0  #1 A .1:X",
        "#1 #1 A #1 >3  #1 A .1:X",
        "#1 #1 A #1 >-3 #1 A .1:X",
        "#1 R >1 .1:X",
        "#1 R >1 X .1:X",
        "#1 R >1 X .1:R >2 .2:X",
        "#1 R >1 X .1:R >1 .1:X",
    };
    int expected[] = {
        2,
        3,
        -1, /* Invalid label. */
        -1, /* Invalid label. */
        -1, /* Negative numbers should fail to compile. */
        1,
        1,
        1,
        -1, /* Label reuse. */
    };

    for (int i = 0; i < num_elem(expected); i++) {
        long long res;
        enum rpn_error err;

        printf("Testing i = %d\n", i);
        expr = rpn_compile(expr_str[i]);
        if (expected[i] == -1) {
            pu_assert_null("Expected compile to fail", expr);
            continue;
        } else {
            pu_assert_not_null("Expected to compile", expr);
        }

        err = rpn_integer(ctx, expr, &res);
        rpn_destroy_expression(expr);
        expr = NULL;

        if (expected[i] == -2) {
            pu_assert_equal("Expected execution to fail", err, RPN_ERR_ILLOPN);
        } else {
            pu_assert_equal("No error", err, RPN_ERR_OK);
        }
        pu_assert_equal(expr_str[i], res, expected[i]);
    }

    return NULL;
}

PU_TEST(test_dup)
{
    enum rpn_error err;
    long long res;
    const char expr_str[] = "#2 R D";

    expr = rpn_compile(expr_str);
    pu_assert("expr is created", expr);

    err = rpn_integer(ctx, expr, &res);

    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("2 * 2", res, 4);

    return NULL;
}

PU_TEST(test_swap)
{
    enum rpn_error err;
    long long res;
    const char expr_str[] = "#4 #2 S C";

    expr = rpn_compile(expr_str);
    pu_assert("expr is created", expr);

    err = rpn_integer(ctx, expr, &res);

    pu_assert_equal("No error", err, RPN_ERR_OK);
    pu_assert_equal("4 / 2", res, 2);

    return NULL;
}
