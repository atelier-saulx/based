/*
 * Copyright (c) 2025-2026 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
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
    assert(ex->cancel_cb);
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

struct SelvaExpireToken *selva_expire_pop(struct SelvaExpire *ex, int64_t now)
{
    struct SelvaExpireToken *last;

    if (ex->next > now) {
        return nullptr;
    }

    // TODO update ex->next
    last = SVector_Peek(&ex->list);
    if (!last || last->expire > now) {
        return nullptr;
    }

    if (!last->next) {
        /* This is the last item */
        (void)SVector_Shift(&ex->list);
    } else {
        struct SelvaExpireToken *prev;
        while (last->next) {
            prev = last;
            last = last->next;
        }
        /*
         * Found the last item in the chain.
         */
        prev->next = nullptr;
    }

    return last;
}

void selva_expire_insert(struct SelvaExpire *ex, struct SelvaExpireToken *token)
{
    struct SelvaExpireToken *old_token = SVector_Insert(&ex->list, token);

    token->next = nullptr;
    if (old_token) {
        while (old_token->next) {
            old_token = old_token->next;
        }
        old_token->next = token;
    }

    if (ex->next > token->expire) {
        ex->next = token->expire;
    }
}

bool selva_expire_exists(struct SelvaExpire *ex, bool (cmp)(struct SelvaExpireToken *token, selva_expire_cmp_arg_t arg), selva_expire_cmp_arg_t arg)
{
    struct SVectorIterator it;
    struct SelvaExpireToken *token;

    SVector_ForeachBegin(&it, &ex->list);
    while (!SVector_Done(&it)) {
        token = SVector_Foreach(&it);
        do {
            if (cmp(token, arg)) {
                return true;
            }
        } while ((token = token->next));
    }
    return false;
}

void selva_expire_remove(struct SelvaExpire *ex, bool (cmp)(struct SelvaExpireToken *token, selva_expire_cmp_arg_t arg), selva_expire_cmp_arg_t arg)
{
    struct SVectorIterator it;

    SVector_ForeachBegin(&it, &ex->list);
    while (!SVector_Done(&it)) {
        struct SelvaExpireToken *token;
        struct SelvaExpireToken *prev = nullptr;

        token = SVector_Foreach(&it);
        do {
            if (cmp(token, arg)) {
                if (prev) {
                    prev->next = token->next;
                    ex->cancel_cb(token);
                    return;
                } else { /* token is the current head */
                    SVector_Remove(&ex->list, token);
                    if (token->next) {
                        (void)SVector_Insert(&ex->list, token->next);
                    }
                    ex->cancel_cb(token);
                    return;
                }
            }
            prev = token;
        } while ((token = token->next));
    }
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
