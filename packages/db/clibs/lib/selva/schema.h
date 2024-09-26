/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

struct ref_save_map_item;

struct schema_fields_count {
    size_t nr_fixed_fields;
    size_t nr_fields;
};

/**
 * Count the number of fields in a given node schema.
 */
int schemabuf_count_fields(struct schema_fields_count *count, const char *buf, size_t len);

/**
 * Parse node schema.
 */
int schemabuf_parse_ns(struct SelvaDb *db, struct SelvaNodeSchema *ns, struct schema_fields_count *count, const char *buf, size_t len);

void schemabuf_deinit_fields_schema(struct SelvaFieldsSchema *schema);
