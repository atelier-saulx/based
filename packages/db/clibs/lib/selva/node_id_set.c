/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <sys/types.h>
#include <string.h>
#include "jemalloc.h"
#include "selva/node_id_set.h"

static ssize_t bsearch_id_arr(node_id_t *a, size_t n, node_id_t x)
{
    ssize_t i = 0;
    ssize_t j = n - 1;

    while (i <= j) {
        int k = i + ((j - i) / 2);
        if (a[k] == x) {
            return k;
        } else if (a[k] < x) {
            i = k + 1;
        } else {
            j = k - 1;
        }
    }
    return -1;
}

void node_id_set_init(struct node_id_set *set)
{
    set->len = 0;
    set->arr = NULL;
}

void node_id_set_destroy(struct node_id_set *set)
{
    node_id_set_clear(set);
}

bool node_id_set_has(struct node_id_set *set, node_id_t id)
{
    if (!set->arr) {
        return false;
    }

    return bsearch_id_arr(set->arr, set->len, id) >= 0;
}

bool node_id_set_add(struct node_id_set *set, node_id_t id)
{
    if (!set->arr) {
        set->len = 1;
        set->arr = selva_malloc(sizeof(set->arr[0]));
    }

    ssize_t l = 0;
    ssize_t r = (ssize_t)set->len - 1;
    node_id_t *arr = set->arr;

    while (l <= r) {
        ssize_t m = (l + r) / 2;
        node_id_t c = arr[m];

        if (id > c) {
            l = m + 1;
        } else if (id < c) {
            r = m - 1;
        } else {
            /* Already inserted. */
            return false;
        }
    }

    size_t new_len;

    new_len = set->len + 1;
    set->arr = arr = selva_realloc(arr, new_len * sizeof(set->arr[0]));

    if (l <= (ssize_t)set->len - 1) {
        memmove(arr + l + 1, arr + l, (set->len - l) * sizeof(set->arr[0]));
    }
    arr[l] = id;
    set->len = new_len;

    return true;
}

bool node_id_set_remove(struct node_id_set *set, node_id_t id)
{
    ssize_t idx;

    if (!set->arr) {
        return false;
    }

    idx = bsearch_id_arr(set->arr, set->len, id);
    if (idx < 0) {
        return false;
    }

    if (set->len == 1) {
        node_id_set_clear(set);
    } else {
        node_id_t *el = &set->arr[idx];
        memmove(el, el + 1, (size_t)((uintptr_t)(set->arr + set->len - 1) - (uintptr_t)el));
        set->len--;
    }

    return true;
}

void node_id_set_clear(struct node_id_set *set)
{
    selva_free(set->arr);
    set->arr = NULL;
    set->len = 0;
}
