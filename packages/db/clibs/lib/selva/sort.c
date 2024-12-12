/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <string.h>
#include "jemalloc.h"
#include "tree.h"
#include "selva/selva_lang.h"
#include "selva/sort.h"

struct SelvaSortItem {
    RB_ENTRY(SelvaSortItem) _entry;
    const void *p;
    union {
        size_t data_len;
        int64_t i64;
        double d;
    };
    char data[];
};

struct SelvaSortCtx {
    enum SelvaSortOrder order;
    union {
        RB_HEAD(SelvaSortTreeNone, SelvaSortItem) out_none;
        RB_HEAD(SelvaSortTreeAscI64, SelvaSortItem) out_ai64;
        RB_HEAD(SelvaSortTreeDescI64, SelvaSortItem) out_di64;
        RB_HEAD(SelvaSortTreeAscDouble, SelvaSortItem) out_ad;
        RB_HEAD(SelvaSortTreeDescDouble, SelvaSortItem) out_dd;
        RB_HEAD(SelvaSortTreeAscBuffer, SelvaSortItem) out_ab;
        RB_HEAD(SelvaSortTreeDescBuffer, SelvaSortItem) out_db;
        RB_HEAD(SelvaSortTreeAscText, SelvaSortItem) out_at;
        RB_HEAD(SelvaSortTreeDescText, SelvaSortItem) out_dt;
    };
    struct {
        struct SelvaSortItem *next;
    } iterator;
    enum selva_lang_code lang;
    enum selva_langs_trans trans;
    locale_t loc;
    wctrans_t loc_trans;
};

typedef int (*orderFunc)(const void * restrict a, const void * restrict b);

static int selva_sort_cmp_none(const struct SelvaSortItem * restrict a, const struct SelvaSortItem * restrict b)
{
    ptrdiff_t x = (ptrdiff_t)a->p;
    ptrdiff_t y = (ptrdiff_t)b->p;

    return x < y ? -1 : x > y ? 1 : 0;
}

static int selva_sort_cmp_asc_i64(const struct SelvaSortItem * restrict a, const struct SelvaSortItem * restrict b)
{
    int64_t x = a->i64;
    int64_t y = b->i64;

    return x < y ? -1 : x > y ? 1 : selva_sort_cmp_none(a, b);
}

static int selva_sort_cmp_desc_i64(const struct SelvaSortItem * restrict a, const struct SelvaSortItem * restrict b)
{
    return selva_sort_cmp_asc_i64(b, a);
}

static int selva_sort_cmp_asc_d(const struct SelvaSortItem * restrict a, const struct SelvaSortItem * restrict b)
{
    double x = a->d;
    double y = b->d;

    return x < y ? -1 : x > y ? 1 : selva_sort_cmp_none(a, b);
}

static int selva_sort_cmp_desc_d(const struct SelvaSortItem * restrict a, const struct SelvaSortItem * restrict b)
{
    return selva_sort_cmp_asc_d(b, a);
}

static int selva_sort_cmp_asc_buffer(const struct SelvaSortItem * restrict a, const struct SelvaSortItem * restrict b)
{
    int r;

    r = memcmp(a->data, b->data, min(a->data_len, b->data_len));
    if (r != 0) {
        return r;
    } else {
        size_t x = a->data_len;
        size_t y = b->data_len;

        return x < y ? -1 : x > y ? 1 : selva_sort_cmp_none(a, b);
    }
}

static int selva_sort_cmp_desc_buffer(const struct SelvaSortItem * restrict a, const struct SelvaSortItem * restrict b)
{
    return selva_sort_cmp_asc_buffer(b, a);
}

static int selva_sort_cmp_asc_text(const struct SelvaSortItem * restrict a, const struct SelvaSortItem * restrict b)
{
    const char *a_str = a->data;
    const char *b_str = b->data;
    int res = 0;

    res = strcmp(a_str, b_str);

    return (res != 0) ? res : selva_sort_cmp_none(a, b);
}

static int selva_sort_cmp_desc_text(const void * restrict a, const void * restrict b)
{
    return selva_sort_cmp_asc_text(b, a);
}

RB_GENERATE_STATIC(SelvaSortTreeNone, SelvaSortItem, _entry, selva_sort_cmp_none)
RB_GENERATE_STATIC(SelvaSortTreeAscI64, SelvaSortItem, _entry, selva_sort_cmp_asc_i64)
RB_GENERATE_STATIC(SelvaSortTreeDescI64, SelvaSortItem, _entry, selva_sort_cmp_desc_i64)
RB_GENERATE_STATIC(SelvaSortTreeAscDouble, SelvaSortItem, _entry, selva_sort_cmp_asc_d)
RB_GENERATE_STATIC(SelvaSortTreeDescDouble, SelvaSortItem, _entry, selva_sort_cmp_desc_d)
RB_GENERATE_STATIC(SelvaSortTreeAscBuffer, SelvaSortItem, _entry, selva_sort_cmp_asc_buffer)
RB_GENERATE_STATIC(SelvaSortTreeDescBuffer, SelvaSortItem, _entry, selva_sort_cmp_desc_buffer)
RB_GENERATE_STATIC(SelvaSortTreeAscText, SelvaSortItem, _entry, selva_sort_cmp_asc_text)
RB_GENERATE_STATIC(SelvaSortTreeDescText, SelvaSortItem, _entry, selva_sort_cmp_desc_text)

struct SelvaSortCtx *selva_sort_init(enum SelvaSortOrder order)
{
    struct SelvaSortCtx *ctx = selva_malloc(sizeof(*ctx));

    ctx->order = order;
    RB_INIT(&ctx->out_none);
    ctx->lang = selva_lang_none;
    ctx->trans = SELVA_LANGS_TRANS_NONE;

    return ctx;
}

void selva_sort_set_lang(struct SelvaSortCtx *ctx, enum selva_lang_code lang, enum selva_langs_trans trans)
{
    ctx->lang = lang;
    ctx->trans = trans;
    ctx->loc = selva_lang_getlocale2(lang);
    ctx->loc_trans = selva_lang_wctrans(lang, trans);
}

void selva_sort_destroy(struct SelvaSortCtx *ctx)
{
    struct SelvaSortTreeNone *head = &ctx->out_none;
    struct SelvaSortItem *item;
    struct SelvaSortItem *tmp;

    RB_FOREACH_SAFE(item, SelvaSortTreeNone, head, tmp) {
        selva_free(item);
    }

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

static struct SelvaSortItem *create_item_text(struct SelvaSortCtx *ctx, const char *str, size_t len, const void *p)
{
    struct SelvaSortItem *item;

    if (likely(len > 0)) {
        if (ctx->trans != SELVA_LANGS_TRANS_NONE) {
            str = selva_mbstrans(ctx->loc, str, len, ctx->loc_trans);
        }

        size_t data_len = strxfrm_l(NULL, str, 0, ctx->loc);

        item = selva_malloc(sizeof_wflex(struct SelvaSortItem, data, data_len + 1));
        strxfrm_l(item->data, str, len, ctx->loc);
        item->data_len = data_len;

        if (ctx->trans != SELVA_LANGS_TRANS_NONE) {
            selva_free((char *)str);
        }
    } else {
        item = selva_malloc(sizeof_wflex(struct SelvaSortItem, data, 1));
        item->data_len = 0;
    }

    item->p = p;

    return item;
}

void selva_sort_insert(struct SelvaSortCtx *ctx, const void *p)
{
    (void)RB_INSERT(SelvaSortTreeNone, &ctx->out_none, create_item_empty(p));
}

void selva_sort_insert_i64(struct SelvaSortCtx *ctx, int64_t v, const void *p)
{
    struct SelvaSortItem *item = create_item_i64(v, p);

    switch (ctx->order) {
    case SELVA_SORT_ORDER_I64_ASC:
        (void)RB_INSERT(SelvaSortTreeAscI64, &ctx->out_ai64, item);
        break;
    case SELVA_SORT_ORDER_I64_DESC:
        (void)RB_INSERT(SelvaSortTreeDescI64, &ctx->out_di64, item);
        break;
    default:
        abort();
    }
}

void selva_sort_insert_double(struct SelvaSortCtx *ctx, double d, const void *p)
{
    struct SelvaSortItem *item = create_item_d(d, p);

    switch (ctx->order) {
    case SELVA_SORT_ORDER_DOUBLE_ASC:
        (void)RB_INSERT(SelvaSortTreeAscDouble, &ctx->out_ad, item);
        break;
    case SELVA_SORT_ORDER_DOUBLE_DESC:
        (void)RB_INSERT(SelvaSortTreeDescDouble, &ctx->out_dd, item);
        break;
    default:
        abort();
    }
}

void selva_sort_insert_buf(struct SelvaSortCtx *ctx, const void *buf, size_t len, const void *p)
{
    struct SelvaSortItem *item = create_item_buffer(buf, len, p);

    switch (ctx->order) {
    case SELVA_SORT_ORDER_BUFFER_ASC:
        (void)RB_INSERT(SelvaSortTreeAscBuffer, &ctx->out_ab, item);
        break;
    case SELVA_SORT_ORDER_BUFFER_DESC:
        (void)RB_INSERT(SelvaSortTreeDescBuffer, &ctx->out_db, item);
        break;
    default:
        abort();
    }
}

void selva_sort_insert_text(struct SelvaSortCtx *ctx, const char *str, size_t len, const void *p)
{
    struct SelvaSortItem *item = create_item_text(ctx, str, len, p);

    switch (ctx->order) {
    case SELVA_SORT_ORDER_TEXT_ASC:
        (void)RB_INSERT(SelvaSortTreeAscText, &ctx->out_at, item);
        break;
    case SELVA_SORT_ORDER_TEXT_DESC:
        (void)RB_INSERT(SelvaSortTreeDescText, &ctx->out_dt, item);
        break;
    default:
        abort();
    }
}

static inline struct SelvaSortItem *find_none(struct SelvaSortCtx *ctx, const void *p)
{
    struct SelvaSortItem find = {
        .p  = p,
    };

    return RB_FIND(SelvaSortTreeNone, &ctx->out_none, &find);
}

static inline struct SelvaSortItem *find_i64(struct SelvaSortCtx *ctx, int64_t v, const void *p)
{
    struct SelvaSortItem find = {
        .p  = p,
        .i64 = v,
    };

    switch (ctx->order) {
    case SELVA_SORT_ORDER_I64_ASC:
        return RB_FIND(SelvaSortTreeAscI64, &ctx->out_ai64, &find);
    case SELVA_SORT_ORDER_I64_DESC:
        return RB_FIND(SelvaSortTreeDescI64, &ctx->out_di64, &find);
    default:
        abort();
    }
}

static inline struct SelvaSortItem *find_double(struct SelvaSortCtx *ctx, double d, const void *p)
{
    struct SelvaSortItem find = {
        .p = p,
        .d = d,
    };

    switch (ctx->order) {
    case SELVA_SORT_ORDER_DOUBLE_ASC:
        return RB_FIND(SelvaSortTreeAscDouble, &ctx->out_ad, &find);
    case SELVA_SORT_ORDER_DOUBLE_DESC:
        return RB_FIND(SelvaSortTreeDescDouble, &ctx->out_dd, &find);
    default:
        abort();
    }
}

static inline struct SelvaSortItem *find_buffer(struct SelvaSortCtx *ctx, const void *buf, size_t len, const void *p)
{
    struct SelvaSortItem *find = create_item_buffer(buf, len, p);
    struct SelvaSortItem *item;

    switch (ctx->order) {
    case SELVA_SORT_ORDER_BUFFER_ASC:
        item = RB_FIND(SelvaSortTreeAscBuffer, &ctx->out_ab, find);
        break;
    case SELVA_SORT_ORDER_BUFFER_DESC:
        item = RB_FIND(SelvaSortTreeDescBuffer, &ctx->out_db, find);
        break;
    default:
        abort();
    }

    selva_free(find);
    return item;
}

static inline struct SelvaSortItem *find_text(struct SelvaSortCtx *ctx, const char *str, size_t len, const void *p)
{
    struct SelvaSortItem *find = create_item_text(ctx, str, len, p);
    struct SelvaSortItem *item;

    switch (ctx->order) {
    case SELVA_SORT_ORDER_TEXT_ASC:
        item = RB_FIND(SelvaSortTreeAscText, &ctx->out_at, find);
        break;
    case SELVA_SORT_ORDER_TEXT_DESC:
        item = RB_FIND(SelvaSortTreeDescText, &ctx->out_dt, find);
        break;
    default:
        abort();
    }

    selva_free(find);
    return item;
}

void selva_sort_remove(struct SelvaSortCtx *ctx, const void *p)
{
    struct SelvaSortItem *item = find_none(ctx, p);

    assert(ctx->order == SELVA_SORT_ORDER_NONE);

    if (item) {
        (void)RB_REMOVE(SelvaSortTreeNone, &ctx->out_none, item);
    }
}

void selva_sort_remove_i64(struct SelvaSortCtx *ctx, int64_t v, const void *p)
{
    struct SelvaSortItem *item = find_i64(ctx, v, p);

    switch (ctx->order) {
    case SELVA_SORT_ORDER_I64_ASC:
        (void)RB_REMOVE(SelvaSortTreeAscI64, &ctx->out_ai64, item);
        break;
    case SELVA_SORT_ORDER_I64_DESC:
        (void)RB_REMOVE(SelvaSortTreeDescI64, &ctx->out_di64, item);
        break;
    default:
        abort();
    }

    selva_free(item);
}

void selva_sort_remove_double(struct SelvaSortCtx *ctx, int64_t d, const void *p)
{
    struct SelvaSortItem *item = find_double(ctx, d, p);

    switch (ctx->order) {
    case SELVA_SORT_ORDER_DOUBLE_ASC:
        (void)RB_REMOVE(SelvaSortTreeAscDouble, &ctx->out_ad, item);
        break;
    case SELVA_SORT_ORDER_DOUBLE_DESC:
        (void)RB_REMOVE(SelvaSortTreeDescDouble, &ctx->out_dd, item);
        break;
    default:
        abort();
    }

    selva_free(item);
}

void selva_sort_remove_buf(struct SelvaSortCtx *ctx, const void *buf, size_t len, const void *p)
{
    struct SelvaSortItem *item = find_buffer(ctx, buf, len, p);

    switch (ctx->order) {
    case SELVA_SORT_ORDER_BUFFER_ASC:
        (void)RB_REMOVE(SelvaSortTreeAscBuffer, &ctx->out_ab, item);
        break;
    case SELVA_SORT_ORDER_BUFFER_DESC:
        (void)RB_REMOVE(SelvaSortTreeDescBuffer, &ctx->out_db, item);
        break;
    default:
        abort();
    }

    selva_free(item);
}

void selva_sort_remove_text(struct SelvaSortCtx *ctx, const char *str, size_t len, const void *p)
{
    struct SelvaSortItem *item = find_text(ctx, str, len, p);

    switch (ctx->order) {
    case SELVA_SORT_ORDER_TEXT_ASC:
        (void)RB_REMOVE(SelvaSortTreeAscText, &ctx->out_at, item);
        break;
    case SELVA_SORT_ORDER_TEXT_DESC:
        (void)RB_REMOVE(SelvaSortTreeDescText, &ctx->out_dt, item);
        break;
    default:
        abort();
    }

    selva_free(item);
}

void selva_sort_foreach_begin(struct SelvaSortCtx *ctx)
{
    struct SelvaSortTreeNone *head = &ctx->out_none;

    if (!RB_EMPTY(head)) {
        ctx->iterator.next = RB_MIN(SelvaSortTreeNone, head);
    }
}

void *selva_sort_foreach(struct SelvaSortCtx *ctx)
{
    struct SelvaSortItem *cur = ctx->iterator.next;

    if (!cur) {
        return nullptr;
    }

    ctx->iterator.next = RB_NEXT(SelvaSortTreeNone, ctx->out_none, cur);

    return (void *)cur->p;
}

void *selva_sort_foreach_i64(struct SelvaSortCtx *ctx, int64_t *v)
{
    struct SelvaSortItem *cur = ctx->iterator.next;

    if (!cur) {
        return nullptr;
    }

    /* It should be ok to use Asc also for Desc. */
    ctx->iterator.next = RB_NEXT(SelvaSortTreeAscI64, ctx->out_ai64, cur);

    *v = cur->i64;
    return (void *)cur->p;
}

void *selva_sort_foreach_double(struct SelvaSortCtx *ctx, double *d)
{
    struct SelvaSortItem *cur = ctx->iterator.next;

    if (!cur) {
        return nullptr;
    }

    /* It should be ok to use Asc also for Desc. */
    ctx->iterator.next = RB_NEXT(SelvaSortTreeAscDouble, ctx->out_ad, cur);

    *d = cur->d;
    return (void *)cur->p;
}

bool selva_sort_foreach_done(const struct SelvaSortCtx *ctx)
{
    return !ctx->iterator.next;
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
    struct SelvaSortCtx *sort = selva_sort_init(SELVA_SORT_ORDER_I64_ASC);
    struct timespec ts_start, ts_end;
    unsigned seed = 100;

    ts_monotime(&ts_start);
    for (int64_t i = 0; i < 100'000; i++) {
        seed = (214013 * seed + 2531011);
        unsigned x = (seed >> 16) & 0x7FFF;
        selva_sort_insert_i64(sort, x, (void *)i);
    }
    ts_monotime(&ts_end);
    print_time("inserts", &ts_start, &ts_end);

    ts_monotime(&ts_start);
    selva_sort_foreach_begin(sort);
    while (!selva_sort_foreach_done(sort)) {
        __unused const void *item = selva_sort_foreach(sort);
    }
    ts_monotime(&ts_end);
    print_time("foreach", &ts_start, &ts_end);

    selva_sort_destroy(sort);
}
#endif
