/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdint.h>
#include <sys/types.h>
#include "selva/types.h"

struct SelvaNode;
struct SelvaNodeReference;

SELVA_EXPORT
ssize_t fast_linear_search_uint32(const uint32_t arr[], size_t len, uint32_t x);

SELVA_EXPORT
ssize_t fast_linear_search_node_id(const node_id_t arr[], size_t len, node_id_t x);

SELVA_EXPORT
ssize_t fast_linear_search_node(const struct SelvaNode *arr[], size_t len, const struct SelvaNode *x);

SELVA_EXPORT
ssize_t fast_linear_search_references(const struct SelvaNodeReference *arr, size_t len, const struct SelvaNode *x);
