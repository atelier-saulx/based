/*
 * Copyright (c) 2022-2024 SAULX
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
 * struct SelvaSortCtx *sort = selva_sort_init(SELVA_SORT_ORDER_I64_ASC, 1000);
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
    SELVA_SORT_ORDER_DOUBLE_ASC,
    SELVA_SORT_ORDER_DOUBLE_DESC,
    SELVA_SORT_ORDER_BUFFER_ASC,
    SELVA_SORT_ORDER_BUFFER_DESC,
    SELVA_SORT_ORDER_TEXT_ASC,
    SELVA_SORT_ORDER_TEXT_DESC,
};

struct SelvaSortCtx;

SELVA_EXPORT
struct SelvaSortCtx *selva_sort_init(enum SelvaSortOrder order, size_t initial_len);

SELVA_EXPORT
void selva_sort_set_lang(struct SelvaSortCtx *ctx, enum selva_lang_code lang);

SELVA_EXPORT
void selva_sort_destroy(struct SelvaSortCtx *ctx);

SELVA_EXPORT
void selva_sort_insert(struct SelvaSortCtx *ctx, const void *p);

SELVA_EXPORT
void selva_sort_insert_i64(struct SelvaSortCtx *ctx, int64_t v, const void *p);

SELVA_EXPORT
void selva_sort_insert_double(struct SelvaSortCtx *ctx, double d, const void *p);

SELVA_EXPORT
void selva_sort_insert_buf(struct SelvaSortCtx *ctx, const void *buf, size_t len, const void *p);

SELVA_EXPORT
void selva_sort_insert_text(struct SelvaSortCtx *ctx, const char *str, size_t len, const void *p);

SELVA_EXPORT
void selva_sort_remove_i64(struct SelvaSortCtx *ctx, int64_t v, const void *p);

SELVA_EXPORT
void selva_sort_remove_double(struct SelvaSortCtx *ctx, int64_t d, const void *p);

SELVA_EXPORT
void selva_sort_remove_buf(struct SelvaSortCtx *ctx, const void *buf, size_t len, const void *p);

SELVA_EXPORT
void selva_sort_remove_text(struct SelvaSortCtx *ctx, const char *str, size_t len, const void *p);

SELVA_EXPORT
void selva_sort_foreach_begin(struct SelvaSortCtx *ctx);

SELVA_EXPORT
void *selva_sort_foreach(struct SelvaSortCtx *ctx);

SELVA_EXPORT
void *selva_sort_foreach_i64(struct SelvaSortCtx *ctx, int64_t *v);

SELVA_EXPORT
void *selva_sort_foreach_double(struct SelvaSortCtx *ctx, double *d);

SELVA_EXPORT
bool selva_sort_foreach_done(const struct SelvaSortCtx *ctx);
