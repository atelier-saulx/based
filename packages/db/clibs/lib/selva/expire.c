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
    SVector_Destroy(&ex->list);
    ex->next = SELVA_EXPIRE_NEVER;
}

void selva_expire_tick(struct SelvaExpire *ex, int64_t now)
{
    if (ex->next > now) {
        return;
    }

    struct SelvaExpireToken *next;
    while ((next = SVector_Peek(&ex->list))) {
        if (next->expire > now) {
            break;
        }
        (void)SVector_Pop(&ex->list);

        struct SelvaExpireToken *np;
        do {
            np = next->next;
            ex->expire_cb(next);
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
        old_token = token;
        token->next = NULL;
    }

    if (ex->next > token->expire) {
        ex->next = token->expire;
    }
}
