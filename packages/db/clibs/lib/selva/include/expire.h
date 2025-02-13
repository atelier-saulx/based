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
    void (*expire_cb)(struct SelvaExpireToken *token);
};

void selva_expire_init(struct SelvaExpire *ex);
void selva_expire_deinit(struct SelvaExpire *ex);
void selva_expire_tick(struct SelvaExpire *ex, int64_t now);
void selva_expire_insert(struct SelvaExpire *ex, struct SelvaExpireToken *token);
