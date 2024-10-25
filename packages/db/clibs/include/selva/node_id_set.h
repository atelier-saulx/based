/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "selva/types.h"

struct node_id_set {
    node_id_t *arr __pcounted_by(len);
    uint32_t len;
} __packed;

static_assert(sizeof(((struct node_id_set *)0)->len) == sizeof(node_id_t));

void node_id_set_init(struct node_id_set *set);
void node_id_set_destroy(struct node_id_set *set);
bool node_id_set_has(struct node_id_set *set, node_id_t id);
bool node_id_set_add(struct node_id_set *set, node_id_t id);
bool node_id_set_remove(struct node_id_set *set, node_id_t id);
void node_id_set_clear(struct node_id_set *set);
