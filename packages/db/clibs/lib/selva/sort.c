/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <string.h>
#include "jemalloc.h"
#include "tree.h"
#include "util/mempool.h"
#include "selva/selva_lang.h"
#include "selva_error.h"
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
    struct mempool mempool;
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

static bool use_mempool(enum SelvaSortOrder order)
{
    return (order == SELVA_SORT_ORDER_NONE ||
            order == SELVA_SORT_ORDER_I64_ASC ||
            order == SELVA_SORT_ORDER_I64_DESC ||
            order == SELVA_SORT_ORDER_DOUBLE_ASC ||
            order == SELVA_SORT_ORDER_DOUBLE_DESC);
}

struct SelvaSortCtx *selva_sort_init(enum SelvaSortOrder order)
{
    struct SelvaSortCtx *ctx = selva_malloc(sizeof(*ctx));

    ctx->order = order;
    RB_INIT(&ctx->out_none);
    ctx->lang = selva_lang_none;
    ctx->trans = SELVA_LANGS_TRANS_NONE;

    if (use_mempool(order)) {
        mempool_init(&ctx->mempool, 4'194'304, sizeof(struct SelvaSortItem), alignof(struct SelvaSortItem));
    }

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
    bool pool = use_mempool(ctx->order);

    RB_FOREACH_SAFE(item, SelvaSortTreeNone, head, tmp) {
        if (pool) {
            mempool_return(&ctx->mempool, item);
        } else {
            selva_free(item);
        }
    }

    if (use_mempool(ctx->order)) {
        mempool_destroy(&ctx->mempool);
    }
    selva_free(ctx);
}

static struct SelvaSortItem *create_item_empty(struct SelvaSortCtx *ctx, const void *p)
{
    struct SelvaSortItem *item = mempool_get(&ctx->mempool);

    item->p = p;

    return item;
}

static struct SelvaSortItem *create_item_i64(struct SelvaSortCtx *ctx, int64_t v, const void *p)
{
    struct SelvaSortItem *item = mempool_get(&ctx->mempool);

    item->i64 = v;
    item->p = p;

    return item;
}

static struct SelvaSortItem *create_item_d(struct SelvaSortCtx *ctx, double d, const void *p)
{
    struct SelvaSortItem *item = mempool_get(&ctx->mempool);

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
    (void)RB_INSERT(SelvaSortTreeNone, &ctx->out_none, create_item_empty(ctx, p));
}

void selva_sort_insert_i64(struct SelvaSortCtx *ctx, int64_t v, const void *p)
{
    struct SelvaSortItem *item = create_item_i64(ctx, v, p);

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
    struct SelvaSortItem *item = create_item_d(ctx, d, p);

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
        mempool_return(&ctx->mempool, item);
    }

}

void selva_sort_remove_i64(struct SelvaSortCtx *ctx, int64_t v, const void *p)
{
    struct SelvaSortItem *item = find_i64(ctx, v, p);
    if (item) {
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

        mempool_return(&ctx->mempool, item);
    }
}

void selva_sort_remove_double(struct SelvaSortCtx *ctx, int64_t d, const void *p)
{
    struct SelvaSortItem *item = find_double(ctx, d, p);

    if (item) {
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

        mempool_return(&ctx->mempool, item);
    }
}

void selva_sort_remove_buf(struct SelvaSortCtx *ctx, const void *buf, size_t len, const void *p)
{
    struct SelvaSortItem *item = find_buffer(ctx, buf, len, p);

    if (item) {
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
}

void selva_sort_remove_text(struct SelvaSortCtx *ctx, const char *str, size_t len, const void *p)
{
    struct SelvaSortItem *item = find_text(ctx, str, len, p);

    if (item) {
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
}

void selva_sort_foreach_begin(struct SelvaSortCtx *ctx)
{
    struct SelvaSortTreeNone *head = &ctx->out_none;

    if (!RB_EMPTY(head)) {
        ctx->iterator.next = RB_MIN(SelvaSortTreeNone, head);
    }
}
void selva_sort_foreach_begin_reverse(struct SelvaSortCtx *ctx)
{
    struct SelvaSortTreeNone *head = &ctx->out_none;

    if (!RB_EMPTY(head)) {
        ctx->iterator.next = RB_MAX(SelvaSortTreeNone, head);
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

void *selva_sort_foreach_reverse(struct SelvaSortCtx *ctx)
{
    struct SelvaSortItem *cur = ctx->iterator.next;

    if (!cur) {
        return nullptr;
    }

    ctx->iterator.next = RB_PREV(SelvaSortTreeNone, ctx->out_none, cur);

    return (void *)cur->p;
}

#define SELVA_SORT_FOREACH(name, RB_DIR, vt) \
    void *selva_sort_foreach_##name(struct SelvaSortCtx *ctx, typeof_field(struct SelvaSortItem, vt) *v) \
    { \
        struct SelvaSortItem *cur = ctx->iterator.next; \
        if (!cur) return nullptr; \
        ctx->iterator.next = RB_DIR(SelvaSortTreeNone, ctx->out_none, cur); \
        memcpy(v, &cur->vt, sizeof(cur->vt)); \
        return (void *)cur->p; \
    }

SELVA_SORT_FOREACH(i64, RB_NEXT, i64)
SELVA_SORT_FOREACH(i64_reverse, RB_PREV, i64)
SELVA_SORT_FOREACH(double, RB_NEXT, d)
SELVA_SORT_FOREACH(double_reverse, RB_PREV, d)

bool selva_sort_foreach_done(const struct SelvaSortCtx *ctx)
{
    return !ctx->iterator.next;
}

static void reinsert_items(struct SelvaSortCtx *ctx)
{
    struct mempool *mempool = &ctx->mempool;
    struct mempool_slab_info slab_nfo = mempool_slab_info(mempool);
    const enum SelvaSortOrder order = ctx->order;

    MEMPOOL_FOREACH_SLAB_BEGIN(&ctx->mempool) {
        MEMPOOL_FOREACH_CHUNK_BEGIN(slab_nfo, slab) {
            const bool inuse = chunk->slab & 1;
            if (inuse) {
                struct SelvaSortItem *item = (struct SelvaSortItem *)mempool_get_obj(mempool, chunk);
                switch (order) {
                case SELVA_SORT_ORDER_NONE:
                    (void)RB_INSERT(SelvaSortTreeNone, &ctx->out_none, item);
                    break;
                case SELVA_SORT_ORDER_I64_ASC:
                    (void)RB_INSERT(SelvaSortTreeAscI64, &ctx->out_ai64, item);
                    break;
                case SELVA_SORT_ORDER_I64_DESC:
                    (void)RB_INSERT(SelvaSortTreeDescI64, &ctx->out_di64, item);
                    break;
                case SELVA_SORT_ORDER_DOUBLE_ASC:
                    (void)RB_INSERT(SelvaSortTreeAscDouble, &ctx->out_ad, item);
                    break;
                case SELVA_SORT_ORDER_DOUBLE_DESC:
                    (void)RB_INSERT(SelvaSortTreeDescDouble, &ctx->out_dd, item);
                    break;
                case SELVA_SORT_ORDER_BUFFER_ASC:
                case SELVA_SORT_ORDER_BUFFER_DESC:
                case SELVA_SORT_ORDER_TEXT_ASC:
                case SELVA_SORT_ORDER_TEXT_DESC:
                    abort();
                }
            }
        } MEMPOOL_FOREACH_CHUNK_END();
    } MEMPOOL_FOREACH_SLAB_END();
}

static int defrag_cmp_none(const void *a, const void *b)
{
    return selva_sort_cmp_none(a, b);
}

static int defrag_cmp_asc_i64(const void *a, const void *b)
{
    return selva_sort_cmp_asc_i64(a, b);
}

static int defrag_cmp_desc_i64(const void *a, const void *b)
{
    return selva_sort_cmp_desc_i64(a, b);
}

static int defrag_cmp_asc_d(const void *a, const void *b)
{
    return selva_sort_cmp_asc_d(a, b);
}

static int defrag_cmp_desc_d(const void *a, const void *b)
{
    return selva_sort_cmp_desc_d(a, b);
}

int selva_sort_defrag(struct SelvaSortCtx *ctx)
{
    int (*cmp)(const void *, const void *b);

    switch (ctx->order) {
    case SELVA_SORT_ORDER_NONE:
        cmp = defrag_cmp_none;
        break;
    case SELVA_SORT_ORDER_I64_ASC:
        cmp = defrag_cmp_asc_i64;
        break;
    case SELVA_SORT_ORDER_I64_DESC:
        cmp = defrag_cmp_desc_i64;
        break;
    case SELVA_SORT_ORDER_DOUBLE_ASC:
        cmp = defrag_cmp_asc_d;
        break;
    case SELVA_SORT_ORDER_DOUBLE_DESC:
        cmp = defrag_cmp_desc_d;
        break;
    default:
        return SELVA_ENOTSUP;
    }

    RB_INIT(&ctx->out_none);
    mempool_defrag(&ctx->mempool, cmp);
    reinsert_items(ctx);

    return 0;
}

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
        selva_sort_insert_i64(sort, (uint64_t)x <<31, (void *)i);
    }
    ts_monotime(&ts_end);
    print_time("inserts", &ts_start, &ts_end);

    ts_monotime(&ts_start);
    selva_sort_foreach_begin(sort);
    while (!selva_sort_foreach_done(sort)) {
#if 0
        __unused const void *item = selva_sort_foreach(sort);
#endif
        int64_t v;
        __unused const void *item = selva_sort_foreach_i64(sort, &v);
#if 0
        fprintf(stderr, "%lld\n", v);
#endif
    }
    ts_monotime(&ts_end);
    print_time("foreach", &ts_start, &ts_end);

    ts_monotime(&ts_start);
    selva_sort_defrag(sort);
    ts_monotime(&ts_end);
    print_time("defrag", &ts_start, &ts_end);

    ts_monotime(&ts_start);
    selva_sort_foreach_begin(sort);
    while (!selva_sort_foreach_done(sort)) {
#if 0
        __unused const void *item = selva_sort_foreach(sort);
#endif
        int64_t v;
        __unused const void *item = selva_sort_foreach_i64(sort, &v);
#if 0
        fprintf(stderr, "%lld\n", v);
#endif
    }
    ts_monotime(&ts_end);
    print_time("foreach2", &ts_start, &ts_end);

    selva_sort_destroy(sort);
}
