/*
 * Copyright (c) 2024-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stdint.h>

struct SelvaDb;
struct SelvaNodeSchema;
struct ref_save_map_item;

struct schema_info {
    size_t block_capacity; /*!< Max number of consecutive nodes stored per block. */
    size_t nr_fixed_fields; /*!< Number of fixed fields in the beginning of fields data. */
    size_t nr_virtual_fields; /*!< Number of virtual fields at the end and excluded from the data. */
    size_t nr_fields; /*!< Total number of fields in the schema. */
};

/**
 * Count the number of fields in a given node schema.
 */
int schemabuf_get_info(struct schema_info *nfo, const uint8_t *buf, size_t len);

/**
 * Parse node schema.
 */
int schemabuf_parse_ns(struct SelvaDb *db, struct SelvaNodeSchema *ns, const uint8_t *buf, size_t len);

void schemabuf_deinit_fields_schema(struct SelvaFieldsSchema *schema);
