/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

struct SelvaNodeReference {
    struct SelvaNode *dst;
    struct SelvaFields *edge_value; /* TODO */
};

struct SelvaNodeReferences { /* TODO */
    size_t nr_refs;
    struct SelvaNodeReference *refs __counted_by(nr_refs);
};

struct SelvaFieldsAny {
    enum SelvaFieldType type; /*!< Type of the value. */
    union {
        bool boolean;
        double number;
        int64_t timestamp;
        long long integer;
        struct selva_string *string;
        uint32_t uint32;
        uint64_t uint64;
        uint8_t uint8;
        uint8_t enu;
        struct SelvaNodeReference *reference;
        struct SelvaNodeReferences *references;
    };
};

/**
 * Size of each type in fields.data.
 */
extern const size_t selva_field_data_size[15];

int selva_fields_set(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, const void *value, size_t len);
int selva_fields_get(struct SelvaNode *node, field_t field, struct SelvaFieldsAny *any);
int selva_fields_del(struct SelvaDb *db, struct SelvaNode *node, field_t field);
int selva_fields_del_ref(struct SelvaDb *db, struct SelvaNode * restrict node, field_t field, node_id_t dst_node_id);

/**
 * Destroy all fields of a node.
 */
void selva_fields_destroy(struct SelvaDb *db, struct SelvaNode * restrict node);
