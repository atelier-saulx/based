/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

struct schema_fields_count {
    size_t nr_main_fields;
    size_t nr_fields;
};

/**
 * Count the number of fields in a given node schema.
 */
int schemabuf_count_fields(struct schema_fields_count *count, const char *buf, size_t len);

/**
 * Parse node schema.
 */
int schemabuf_parse(struct SelvaNodeSchema *ns, const char *buf, size_t len);
