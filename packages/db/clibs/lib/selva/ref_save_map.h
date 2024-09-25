/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#include "tree.h"

RB_HEAD(ref_save_map, ref_save_map_item);

void ref_save_map_init(struct ref_save_map *map);
bool ref_save_map_insert(struct ref_save_map *map, node_type_t src_type, node_type_t dst_type);
void ref_save_map_destroy(struct ref_save_map *map);
