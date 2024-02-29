/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include "cdefs.h"
#include "queue.h"
#include "jemalloc.h"
#include "util/finalizer.h"

struct finalizer_item pool[1000];
struct finalizer_stack free_list;

__constructor static void init_finalizer_free_list(void)
{
    SLIST_INIT(&free_list);

    for (size_t i = 0; i < num_elem(pool); i++) {
        SLIST_INSERT_HEAD(&free_list, &pool[i], entries);
    }
}

void finalizer_init(struct finalizer *fin)
{
    SLIST_INIT(&fin->head);
}

static struct finalizer_item *new_item(void)
{
    struct finalizer_item *item;

    item = SLIST_FIRST(&free_list);
    if (item) {
        SLIST_REMOVE_HEAD(&free_list, entries);
    } else {
        item = selva_malloc(sizeof(struct finalizer_item));
    }

    return item;
}

static void free_item(struct finalizer_item *item)
{
    SLIST_INSERT_HEAD(&free_list, item, entries);
}

void finalizer_add(struct finalizer *fin, void *p, void (*dispose)(void *p))
{
    struct finalizer_item *item = new_item();

    item->dispose = dispose;
    item->p = p;

    SLIST_INSERT_HEAD(&fin->head, item, entries);
}

void finalizer_forget(struct finalizer *fin, void *p) {
    struct finalizer_stack *head = &fin->head;
    struct finalizer_item *item;
    struct finalizer_item *item_tmp;

    SLIST_FOREACH_SAFE(item, head, entries, item_tmp) {
        if (item->p == p) {
            SLIST_REMOVE(head, item, finalizer_item, entries);
            free_item(item);
            break;
        }
    }
}

void finalizer_run(struct finalizer *fin)
{
    struct finalizer_stack *head = &fin->head;

    while (!SLIST_EMPTY(head)) {
        struct finalizer_item *item = SLIST_FIRST(head);

        item->dispose(item->p);

        SLIST_REMOVE_HEAD(head, entries);
        free_item(item);
    }
}

void _wrap_finalizer_run(void *p)
{
    finalizer_run((struct finalizer *)p);
}
