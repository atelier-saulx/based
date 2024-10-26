/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stddef.h>
#include <sys/types.h>
#include "selva/types.h"

struct node_id_set {
    node_id_t *arr __pcounted_by(len);
    uint32_t len;
} __packed;

static_assert(sizeof(((struct node_id_set *)0)->len) == sizeof(node_id_t));

void node_id_set_init(struct node_id_set *set)
    __attribute__((access(write_only, 1)));
void node_id_set_prealloc(struct node_id_set *set, size_t new_len);
void node_id_set_destroy(struct node_id_set *set);
ssize_t node_id_set_bsearch(const node_id_t *a, size_t n, node_id_t x);
bool node_id_set_has(const struct node_id_set *set, node_id_t id)
    __attribute__((access(read_only, 1)));
bool node_id_set_add(struct node_id_set *set, node_id_t id);
bool node_id_set_remove(struct node_id_set *set, node_id_t id);
void node_id_set_clear(struct node_id_set *set);
