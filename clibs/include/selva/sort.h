/*
 * Copyright (c) 2022-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#include <stdint.h>
#include <stddef.h>
#include "selva/_export.h"
#include "selva_lang_code.h"

/*
 * Usage
 * -----
 *
 * ```c
 * struct SelvaSortCtx *sort = selva_sort_init(SELVA_SORT_ORDER_I64_ASC);
 * selva_sort_insert_i64(sort, num, data);
 *
 * selva_sort_foreach_begin(sort);
 * while (!selva_sort_foreach_done(sort)) {
 *     item = selva_sort_foreach(sort);
 *     print(item);
 * }
 *
 * selva_sort_destroy(sort);
 * ```
 */

enum SelvaSortOrder {
    SELVA_SORT_ORDER_NONE = 0,
    SELVA_SORT_ORDER_I64_ASC,
    SELVA_SORT_ORDER_I64_DESC,
    SELVA_SORT_ORDER_FLOAT_ASC,
    SELVA_SORT_ORDER_FLOAT_DESC,
    SELVA_SORT_ORDER_DOUBLE_ASC,
    SELVA_SORT_ORDER_DOUBLE_DESC,
    SELVA_SORT_ORDER_BUFFER_ASC,
    SELVA_SORT_ORDER_BUFFER_DESC,
    SELVA_SORT_ORDER_TEXT_ASC,
    SELVA_SORT_ORDER_TEXT_DESC,
};

struct SelvaSortItem;
struct SelvaSortCtx;

struct SelvaSortIterator {
    struct SelvaSortItem *next;
};

SELVA_EXPORT
struct SelvaSortCtx *selva_sort_init(enum SelvaSortOrder order);

SELVA_EXPORT
struct SelvaSortCtx *selva_sort_init2(enum SelvaSortOrder order, size_t fixed_size);

SELVA_EXPORT
struct SelvaSortCtx *selva_sort_init3(enum SelvaSortOrder order, size_t fixed_size, size_t copy_size);

SELVA_EXPORT
void selva_sort_set_lang(struct SelvaSortCtx *ctx, enum selva_lang_code lang, enum selva_langs_trans trans);

SELVA_EXPORT
void selva_sort_clear(struct SelvaSortCtx *ctx);

SELVA_EXPORT
void selva_sort_destroy(struct SelvaSortCtx *ctx);

SELVA_EXPORT
void selva_sort_insert(struct SelvaSortCtx *ctx, const void *p);

SELVA_EXPORT
void selva_sort_insert_i64(struct SelvaSortCtx *ctx, int64_t v, const void *p);

SELVA_EXPORT
void selva_sort_insert_float(struct SelvaSortCtx *ctx, float f, const void *p);

SELVA_EXPORT
void selva_sort_insert_double(struct SelvaSortCtx *ctx, double d, const void *p);

SELVA_EXPORT
void selva_sort_insert_buf(struct SelvaSortCtx *ctx, const void *buf, size_t len, const void *p);

SELVA_EXPORT
void selva_sort_insert_text(struct SelvaSortCtx *ctx, const char *str, size_t len, const void *p);

SELVA_EXPORT
void selva_sort_remove(struct SelvaSortCtx *ctx, const void *p);

SELVA_EXPORT
void selva_sort_remove_i64(struct SelvaSortCtx *ctx, int64_t v, const void *p);

SELVA_EXPORT
void selva_sort_remove_float(struct SelvaSortCtx *ctx, float f, const void *p);

SELVA_EXPORT
void selva_sort_remove_double(struct SelvaSortCtx *ctx, double d, const void *p);

SELVA_EXPORT
void selva_sort_remove_buf(struct SelvaSortCtx *ctx, const void *buf, size_t len, const void *p);

SELVA_EXPORT
void selva_sort_remove_text(struct SelvaSortCtx *ctx, const char *str, size_t len, const void *p);

SELVA_EXPORT
void selva_sort_foreach_begin(struct SelvaSortCtx *ctx, struct SelvaSortIterator *it);

SELVA_EXPORT
void selva_sort_foreach_begin_reverse(struct SelvaSortCtx *ctx, struct SelvaSortIterator *it);

SELVA_EXPORT
void *selva_sort_foreach(struct SelvaSortCtx *ctx, struct SelvaSortIterator *it);

SELVA_EXPORT
void *selva_sort_foreach_reverse(struct SelvaSortCtx *ctx, struct SelvaSortIterator *it);

SELVA_EXPORT
void *selva_sort_foreach_i64(struct SelvaSortCtx *ctx, struct SelvaSortIterator *it, int64_t *v);

SELVA_EXPORT
void *selva_sort_foreach_i64_reverse(struct SelvaSortCtx *ctx, struct SelvaSortIterator *it, int64_t *v);

SELVA_EXPORT
void *selva_sort_foreach_float(struct SelvaSortCtx *ctx, struct SelvaSortIterator *it, float *f);

SELVA_EXPORT
void *selva_sort_foreach_float_reverse(struct SelvaSortCtx *ctx, struct SelvaSortIterator *it, float *f);

SELVA_EXPORT
void *selva_sort_foreach_double(struct SelvaSortCtx *ctx, struct SelvaSortIterator *it, double *d);

SELVA_EXPORT
void *selva_sort_foreach_double_reverse(struct SelvaSortCtx *ctx, struct SelvaSortIterator *it, double *d);

SELVA_EXPORT
void *selva_sort_foreach_buffer(struct SelvaSortCtx *ctx, struct SelvaSortIterator *it, void **buf, size_t *len);

SELVA_EXPORT
void *selva_sort_foreach_buffer_reverse(struct SelvaSortCtx *ctx, struct SelvaSortIterator *it, void **buf, size_t *len);

static inline bool selva_sort_foreach_done(struct SelvaSortIterator *it)
{
    return !it->next;
}

SELVA_EXPORT
int selva_sort_defrag(struct SelvaSortCtx *ctx);
