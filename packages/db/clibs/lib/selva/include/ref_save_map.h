/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#include "tree.h"

RB_HEAD(ref_save_map, ref_save_map_item);

/**
 * Initialize a ref_save_map.
 */
void ref_save_map_init(struct ref_save_map *map);

/**
 * Insert a (src, dst) tuple to the ref_save_map.
 * The order of src_type and dst_type is irrelevant as the final key will be
 * constructed in the order of <.
 * @returns true if the tuple was inserted.
 */
bool ref_save_map_insert(struct ref_save_map *map, node_type_t src_type, node_type_t dst_type, field_t src_field, field_t dst_field);

/**
 * Destroy a ref_save_map.
 */
void ref_save_map_destroy(struct ref_save_map *map);
