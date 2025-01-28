/*
 * Copyright (c) 2024-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdint.h>
#include <sys/types.h>
#include "selva/types.h"
#include "db.h"
#include "selva/fields.h"
#include "selva/fast_linear_search.h"

static inline size_t get_mid(size_t len)
{
    return len / 2 - !(len & 1);
}

#define MAKE_FUN(TYPE, NAME) \
    ssize_t NAME(const TYPE arr[], size_t len, TYPE x) \
    { \
        if (len == 0) return -1; \
        size_t mid = get_mid(len); \
        for (size_t i = 0, j = len - 1, k = mid, l = mid; i <= mid; i++, j--, k--, l++) { \
            if (arr[i] == x) return i; \
            if (arr[j] == x) return j; \
            if (arr[k] == x) return k; \
            if (arr[l] == x) return l; \
        } \
        return -1; \
    }

#define MAKE_FUN_S(TYPE, NAME, FIELD) \
    ssize_t NAME(const TYPE *arr[], size_t len, const TYPE *x) \
    { \
        if (len == 0) return -1; \
        size_t mid = get_mid(len); \
        for (size_t i = 0, j = len - 1, k = mid, l = mid; i <= mid; i++, j--, k--, l++) { \
            typeof(x->FIELD) y = x->FIELD; \
            if (arr[i]->FIELD == y) return i; \
            if (arr[j]->FIELD == y) return j; \
            if (arr[k]->FIELD == y) return k; \
            if (arr[l]->FIELD == y) return l; \
        } \
        return -1; \
    }

MAKE_FUN(uint32_t, fast_linear_search_uint32)
MAKE_FUN(node_id_t, fast_linear_search_node_id)
MAKE_FUN_S(struct SelvaNode, fast_linear_search_node, node_id)

ssize_t fast_linear_search_references(const struct SelvaNodeReference arr[], size_t len, const struct SelvaNode *x)
{
    if (len == 0) return -1;

    size_t mid = get_mid(len);

    for (size_t i = 0, j = len - 1, k = mid, l = mid; i <= mid; i++, j--, k--, l++) {
        if (arr[i].dst == x) return i;
        if (arr[j].dst == x) return j;
        if (arr[k].dst == x) return k;
        if (arr[l].dst == x) return l;
    }

    return -1;
}
