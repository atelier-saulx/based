/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

struct fields_count {
    size_t nr_main_fields;
    size_t nr_fields;
};

int schemabuf_count_fields(struct fields_count *count, const char *buf, size_t len);
int schemabuf_parse(struct SelvaNodeSchema *ns, const char *buf, size_t len);
