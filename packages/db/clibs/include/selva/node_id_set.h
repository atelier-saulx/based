/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stddef.h>
#include <sys/types.h>
#include "selva/types.h"

SELVA_EXPORT
ssize_t node_id_set_bsearch(const node_id_t *a, size_t n, node_id_t x)
    __attribute__((access(read_only, 1, 2)));

static inline bool node_id_set_has(const node_id_t *set, size_t len, node_id_t id)
{
    if (len == 0) {
        return false;
    }

    return node_id_set_bsearch(set, len, id) >= 0;
}

SELVA_EXPORT
bool node_id_set_add(node_id_t **set_p, size_t *len, node_id_t id);

SELVA_EXPORT
bool node_id_set_remove(node_id_t **set_p, size_t *len, node_id_t id);
