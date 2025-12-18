/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <sys/types.h>
#include <stdint.h>
#include "svector.h"
#include "selva/types.h"

#define SELVA_EXPIRE_NEVER 0x7FFFFFFFFFFFFFFF

struct SelvaExpireToken {
    int64_t expire;
    struct SelvaExpireToken *next; /*!< Next token expiring at the same time. */
};

struct SelvaExpire {
    SVector list; /*!< List of all expiring nodes. */
    /**
     * Timestamp of the element expiring next.
     * Set to SELVA_EXPIRE_NEVER if nothing is expiring.
     */
    int64_t next;

    /**
     * Expire callback.
     * This should also free the token.
     */
    void (*expire_cb)(struct SelvaExpireToken *token, void *ctx);
    /**
     * Cancel expiration callback.
     * This should also free the token.
     */
    void (*cancel_cb)(struct SelvaExpireToken *token);
};

typedef union {
    uint64_t v;
    void *p;
} selva_expire_cmp_arg_t __attribute__((__transparent_union__));

/**
 * Initialize a SelvaExpire struct.
 * expire_cb and cancel_cb must be set in the ex struct by the caller.
 */
void selva_expire_init(struct SelvaExpire *ex);
void selva_expire_deinit(struct SelvaExpire *ex);
void selva_expire_tick(struct SelvaExpire *ex, void *ctx, int64_t now);

/**
 * Insert an expire token.
 * The expire time must be set by the caller.
 */
void selva_expire_insert(struct SelvaExpire *ex, struct SelvaExpireToken *token);

bool selva_expire_exists(struct SelvaExpire *ex, bool (cmp)(struct SelvaExpireToken *token, selva_expire_cmp_arg_t arg), selva_expire_cmp_arg_t arg);
void selva_expire_remove(struct SelvaExpire *ex, bool (cmp)(struct SelvaExpireToken *token, selva_expire_cmp_arg_t arg), selva_expire_cmp_arg_t arg);
size_t selva_expire_count(const struct SelvaExpire *ex);
