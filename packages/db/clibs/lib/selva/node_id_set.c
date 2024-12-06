/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <string.h>
#include "jemalloc.h"
#include "selva/node_id_set.h"

ssize_t node_id_set_bsearch(const node_id_t *set, size_t n, node_id_t x)
{
    ssize_t i = 0;
    ssize_t j = n - 1;

    if (x <= set[0]) {
        if (set[0] == x) {
            return 0;
        }
        goto out;
    } else if (x >= set[j]) {
        if (set[j] == x) {
            return j;
        }
        goto out;
    }

    while (i <= j) {
        int k = i + ((j - i) / 2);
        if (set[k] == x) {
            return k;
        } else if (set[k] < x) {
            i = k + 1;
        } else {
            j = k - 1;
        }
    }

out:
    return -1;
}

bool node_id_set_add(node_id_t **set_p, size_t *len, node_id_t id)
{
    const size_t old_len = *len;
    const size_t new_len = old_len + 1;
    node_id_t *arr = *set_p;
    ssize_t l = 0;

    if (old_len == 0) {
        *set_p = arr = selva_malloc(sizeof(arr[0]));
    } else {
        ssize_t r = (ssize_t)old_len - 1;
        const size_t new_size = new_len * sizeof(arr[0]);

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

        if (selva_sallocx(arr, 0) < new_size) {
            *set_p = arr = selva_realloc(arr, new_size);
        }

        if (l <= (ssize_t)old_len - 1) {
            memmove(arr + l + 1, arr + l, (old_len - l) * sizeof(arr[0]));
        }
    }

    arr[l] = id;
    *len = new_len;

    return true;
}

bool node_id_set_remove(node_id_t **set_p, size_t *len, node_id_t id)
{
    node_id_t *arr = *set_p;
    const size_t old_len = *len;
    ssize_t idx;

    if (old_len == 0) {
        return false;
    }

    idx = node_id_set_bsearch(arr, old_len, id);
    if (idx < 0) {
        return false;
    }

    if (old_len == 1) {
        selva_free(*set_p);
        *set_p = nullptr;
        *len = 0;
    } else {
        node_id_t *el = &arr[idx];

        memmove(el, el + 1, (size_t)((uintptr_t)(arr + old_len - 1) - (uintptr_t)el));
        *len = old_len - 1;
    }

    return true;
}
