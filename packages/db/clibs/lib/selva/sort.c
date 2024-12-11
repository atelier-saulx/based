/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <string.h>
#include "jemalloc.h"
#include "util/funmap.h"
#include "util/svector.h"
#include "selva/selva_lang.h"
#include "selva/sort.h"

struct SelvaSortCtx {
    struct SVector out;
    struct SVectorIterator it;
    enum selva_lang_code lang;
    locale_t loc;
};

struct SelvaSortItem {
    const void *p;
    size_t data_len;
    union {
        int64_t i64;
        double d;
    };
    char data[];
};

typedef int (*orderFunc)(const void ** restrict a_raw, const void ** restrict b_raw);

static int selva_sort_cmp_none(const void ** restrict a_raw __unused, const void ** restrict b_raw __unused)
{
    const struct SelvaSortItem *a = *(const struct SelvaSortItem **)a_raw;
    const struct SelvaSortItem *b = *(const struct SelvaSortItem **)b_raw;
    ptrdiff_t x = (ptrdiff_t)a->p;
    ptrdiff_t y = (ptrdiff_t)b->p;

    return x < y ? -1 : x > y ? 1 : 0;
}

static int selva_sort_cmp_asc_i64(const void ** restrict a_raw, const void ** restrict b_raw)
{
    const struct SelvaSortItem *a = *(const struct SelvaSortItem **)a_raw;
    const struct SelvaSortItem *b = *(const struct SelvaSortItem **)b_raw;
    int64_t x = a->i64;
    int64_t y = b->i64;

    return x < y ? -1 : x > y ? 1 : selva_sort_cmp_none(a_raw, b_raw);
}

static int selva_sort_cmp_desc_i64(const void ** restrict a_raw, const void ** restrict b_raw)
{
    return selva_sort_cmp_asc_i64(b_raw, a_raw);
}

static int selva_sort_cmp_asc_d(const void ** restrict a_raw, const void ** restrict b_raw)
{
    const struct SelvaSortItem *a = *(const struct SelvaSortItem **)a_raw;
    const struct SelvaSortItem *b = *(const struct SelvaSortItem **)b_raw;
    double x = a->d;
    double y = b->d;

    return x < y ? -1 : x > y ? 1 : selva_sort_cmp_none(a_raw, b_raw);
}

static int selva_sort_cmp_desc_d(const void ** restrict a_raw, const void ** restrict b_raw)
{
    return selva_sort_cmp_asc_d(b_raw, a_raw);
}

static int selva_sort_cmp_asc_buffer(const void ** restrict a_raw, const void ** restrict b_raw)
{
    const struct SelvaSortItem *a = *(const struct SelvaSortItem **)a_raw;
    const struct SelvaSortItem *b = *(const struct SelvaSortItem **)b_raw;
    int r;

    r = memcmp(a->data, b->data, min(a->data_len, b->data_len));
    if (r != 0) {
        return r;
    } else {
        size_t x = a->data_len;
        size_t y = b->data_len;

        return x < y ? -1 : x > y ? 1 : selva_sort_cmp_none(a_raw, b_raw);
    }
}

static int selva_sort_cmp_desc_buffer(const void ** restrict a_raw, const void ** restrict b_raw)
{
    return selva_sort_cmp_asc_buffer(b_raw, a_raw);
}

static int selva_sort_cmp_asc_text(const void ** restrict a_raw, const void ** restrict b_raw)
{
    const struct SelvaSortItem *a = *(const struct SelvaSortItem **)a_raw;
    const struct SelvaSortItem *b = *(const struct SelvaSortItem **)b_raw;
    const char *a_str = a->data;
    const char *b_str = b->data;
    int res = 0;

    res = strcmp(a_str, b_str);

    return (res != 0) ? res : selva_sort_cmp_none(a_raw, b_raw);
}

static int selva_sort_cmp_desc_text(const void ** restrict a_raw, const void ** restrict b_raw)
{
    return selva_sort_cmp_asc_text(b_raw, a_raw);
}

static orderFunc order_functions[] = {
    [SELVA_SORT_ORDER_NONE] = selva_sort_cmp_none,
    [SELVA_SORT_ORDER_I64_ASC] = selva_sort_cmp_asc_i64,
    [SELVA_SORT_ORDER_I64_DESC] = selva_sort_cmp_desc_i64,
    [SELVA_SORT_ORDER_DOUBLE_ASC] = selva_sort_cmp_asc_d,
    [SELVA_SORT_ORDER_DOUBLE_DESC] = selva_sort_cmp_desc_d,
    [SELVA_SORT_ORDER_BUFFER_ASC] = selva_sort_cmp_asc_buffer,
    [SELVA_SORT_ORDER_BUFFER_DESC] = selva_sort_cmp_desc_buffer,
    [SELVA_SORT_ORDER_TEXT_ASC] = selva_sort_cmp_asc_text,
    [SELVA_SORT_ORDER_TEXT_DESC] = selva_sort_cmp_desc_text,
};

GENERATE_STATIC_FUNMAP(get_cmp_fun, order_functions, enum SelvaSortOrder, SELVA_SORT_ORDER_NONE);

struct SelvaSortCtx *selva_sort_init(enum SelvaSortOrder order, size_t initial_len)
{
    struct SelvaSortCtx *ctx = selva_malloc(sizeof(*ctx));

    SVector_Init(&ctx->out, initial_len, get_cmp_fun(order));
    ctx->lang = selva_lang_none;
    ctx->loc = 0;

    return ctx;
}

void selva_sort_set_lang(struct SelvaSortCtx *ctx, enum selva_lang_code lang)
{
    ctx->lang = lang;
    ctx->loc = selva_lang_getlocale2(lang);
}

void selva_sort_destroy(struct SelvaSortCtx *ctx)
{
    struct SVectorIterator it;
    struct SelvaSortItem *item;

    SVector_ForeachBegin(&it, &ctx->out);
    while ((item = SVector_Foreach(&it))) {
        selva_free(item);
    }

    SVector_Destroy(&ctx->out);
    selva_free(ctx);
}

static struct SelvaSortItem *create_item_empty(const void *p)
{
    struct SelvaSortItem *item = selva_calloc(1, sizeof(*item));

    item->p = p;

    return item;
}

static struct SelvaSortItem *create_item_i64(int64_t v, const void *p)
{
    struct SelvaSortItem *item = selva_calloc(1, sizeof(*item));

    item->i64 = v;
    item->p = p;

    return item;
}

static struct SelvaSortItem *create_item_d(double d, const void *p)
{
    struct SelvaSortItem *item = selva_calloc(1, sizeof(*item));

    item->d = d;
    item->p = p;

    return item;
}

static struct SelvaSortItem *create_item_buffer(const void *buf, size_t len, const void *p)
{
    struct SelvaSortItem *item = selva_malloc(sizeof_wflex(struct SelvaSortItem, data, len));

    item->data_len = len;
    memcpy(item->data, buf, len);
    item->p = p;

    return item;
}

static struct SelvaSortItem *create_item_text(locale_t loc, const char *str, size_t len, const void *p)
{
    struct SelvaSortItem *item;

    if (likely(len > 0)) {
        size_t data_len = strxfrm_l(NULL, str, 0, loc);

        item = selva_malloc(sizeof_wflex(struct SelvaSortItem, data, data_len + 1));
        strxfrm_l(item->data, str, len, loc);
        item->data_len = data_len;
    } else {
        item = selva_malloc(sizeof_wflex(struct SelvaSortItem, data, 1));
        item->data_len = 0;
    }

    item->p = p;

    return item;
}

void selva_sort_insert(struct SelvaSortCtx *ctx, const void *p)
{
    (void)SVector_Insert(&ctx->out, create_item_empty(p));
}

void selva_sort_insert_i64(struct SelvaSortCtx *ctx, int64_t v, const void *p)
{
    (void)SVector_Insert(&ctx->out, create_item_i64(v, p));
}

void selva_sort_insert_double(struct SelvaSortCtx *ctx, double d, const void *p)
{
    (void)SVector_Insert(&ctx->out, create_item_d(d, p));
}

void selva_sort_insert_buf(struct SelvaSortCtx *ctx, const void *buf, size_t len, const void *p)
{
    (void)SVector_Insert(&ctx->out, create_item_buffer(buf, len, p));
}

void selva_sort_insert_text(struct SelvaSortCtx *ctx, const char *str, size_t len, const void *p)
{
    (void)SVector_Insert(&ctx->out, create_item_text(ctx->loc, str, len, p));
}

void selva_sort_remove_i64(struct SelvaSortCtx *ctx, int64_t v, const void *p)
{
    struct SelvaSortItem find = {
        .p = p,
        .i64 = v,
    };

    selva_free(SVector_Remove(&ctx->out, &find));
}

void selva_sort_remove_double(struct SelvaSortCtx *ctx, int64_t d, const void *p)
{
    struct SelvaSortItem find = {
        .p = p,
        .d = d,
    };

    selva_free(SVector_Remove(&ctx->out, &find));
}

void selva_sort_remove_buf(struct SelvaSortCtx *ctx, const void *buf, size_t len, const void *p)
{
    struct SelvaSortItem *find = create_item_buffer(buf, len, p);

    selva_free(SVector_Remove(&ctx->out, find));
    selva_free(find);
}

void selva_sort_remove_text(struct SelvaSortCtx *ctx, const char *str, size_t len, const void *p)
{
    struct SelvaSortItem *find = create_item_text(ctx->loc, str, len, p);

    selva_free(SVector_Remove(&ctx->out, find));
    selva_free(find);
}

void selva_sort_foreach_begin(struct SelvaSortCtx *ctx)
{
    SVector_ForeachBegin(&ctx->it, &ctx->out);
}

void *selva_sort_foreach(struct SelvaSortCtx *ctx)
{
    struct SelvaSortItem *item = SVector_Foreach(&ctx->it);

    return (void *)item->p;
}

void *selva_sort_foreach_i64(struct SelvaSortCtx *ctx, int64_t *v)
{
    struct SelvaSortItem *item = SVector_Foreach(&ctx->it);

    *v = item->i64;
    return (void *)item->p;
}

void *selva_sort_foreach_double(struct SelvaSortCtx *ctx, double *d)
{
    struct SelvaSortItem *item = SVector_Foreach(&ctx->it);

    *d = item->d;
    return (void *)item->p;
}

bool selva_sort_foreach_done(const struct SelvaSortCtx *ctx)
{
    return SVector_Done(&ctx->it);
}

#if 0
#include <stdio.h>
#include <unistd.h>
#include "util/ctime.h"
#include "util/timestamp.h"

static void print_time(char *msg, struct timespec * restrict ts_start, struct timespec * restrict ts_end)
{
    struct timespec ts_diff;
    double t;
    const char *t_unit;

    timespec_sub(&ts_diff, ts_end, ts_start);
    t = timespec2ms(&ts_diff);

    if (t < 1e3) {
        t_unit = "ms";
    } else if (t < 60e3) {
        t /= 1e3;
        t_unit = "s";
    } else if (t < 3.6e6) {
        t /= 60e3;
        t_unit = "min";
    } else {
        t /= 3.6e6;
        t_unit = "h";
    }

    fprintf(stderr, "%s: %.2f %s\n", msg, t, t_unit);
}

__constructor
static void test(void)
{
    struct SelvaSortCtx *sort = selva_sort_init(SELVA_SORT_ORDER_I64_ASC, 1000);
    struct timespec ts_start, ts_end;

    ts_monotime(&ts_start);
    //for (int64_t i = 0; i < 100000000; i++) {
    for (int64_t i = 0; i < 1000; i++) {
        selva_sort_insert_i64(sort, i, (void *)i);
    }
    ts_monotime(&ts_end);
    print_time("inserts", &ts_start, &ts_end);

    ts_monotime(&ts_start);
    selva_sort_foreach_begin(sort);
    while (!selva_sort_foreach_done(sort)) {
        void *item = selva_sort_foreach(sort);
    }
    ts_monotime(&ts_end);
    print_time("foreach", &ts_start, &ts_end);

    selva_sort_destroy(sort);
}
#endif
