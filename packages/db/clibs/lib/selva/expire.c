/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include "expire.h"

static int compar_expire(const void **ap, const void **bp)
{
    struct SelvaExpireToken *a = *(struct SelvaExpireToken **)ap;
    struct SelvaExpireToken *b = *(struct SelvaExpireToken **)bp;

    return (a->expire > b->expire) - (a->expire < b->expire);
}

void selva_expire_init(struct SelvaExpire *ex)
{
    SVector_Init(&ex->list, 1, compar_expire);
    ex->next = SELVA_EXPIRE_NEVER;
}

void selva_expire_deinit(struct SelvaExpire *ex)
{
    struct SVectorIterator it;
    struct SelvaExpireToken *token;

    /*
     * Free all tokens first.
     */
    SVector_ForeachBegin(&it, &ex->list);
    while (!SVector_Done(&it)) {
        token = SVector_Foreach(&it);
        do {
            struct SelvaExpireToken *next = token->next;
            ex->cancel_cb(token);
            token = next;
        } while (token);
    }

    SVector_Destroy(&ex->list);
    ex->next = SELVA_EXPIRE_NEVER;
}

void selva_expire_tick(struct SelvaExpire *ex, void *ctx, int64_t now)
{
    if (ex->next > now) {
        return;
    }

    struct SelvaExpireToken *next;
    while ((next = SVector_Peek(&ex->list))) {
        if (next->expire > now) {
            break;
        }
        (void)SVector_Shift(&ex->list);

        struct SelvaExpireToken *np;
        do {
            np = next->next;
            ex->expire_cb(next, ctx);
            /* `next` should be freed by expire_cb(). */
        } while ((next = np));
    }
}

void selva_expire_insert(struct SelvaExpire *ex, struct SelvaExpireToken *token)
{
    struct SelvaExpireToken *old_token = SVector_Insert(&ex->list, token);

    if (old_token) {
        while (old_token->next) {
            old_token = old_token->next;
        }
        old_token->next = token;
        token->next = nullptr;
    }

    if (ex->next > token->expire) {
        ex->next = token->expire;
    }
}

void selva_expire_remove(struct SelvaExpire *ex, bool (cmp)(struct SelvaExpireToken *token, selva_expire_cmp_arg_t arg), selva_expire_cmp_arg_t arg)
{
    struct SVectorIterator it;
    struct SelvaExpireToken *token;
    struct SelvaExpireToken *prev = nullptr;

    SVector_ForeachBegin(&it, &ex->list);
    while (!SVector_Done(&it)) {
        token = SVector_Foreach(&it);
        do {
            if (cmp(token, arg)) {
                goto found;
            }
            prev = token;
        } while ((token = token->next));
    }
    return;
found:
    if (prev) {
        prev->next = token->next;
    }
    ex->cancel_cb(token);
}

size_t selva_expire_count(const struct SelvaExpire *ex)
{
    struct SVectorIterator it;
    size_t n = 0;

    SVector_ForeachBegin(&it, &ex->list);
    while (!SVector_Done(&it)) {
        struct SelvaExpireToken *token;

        token = SVector_Foreach(&it);
        do {
            n++;
        } while ((token = token->next));
    }

    return n;
}
