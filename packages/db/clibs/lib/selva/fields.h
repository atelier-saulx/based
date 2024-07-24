/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

struct SelvaNodeReference {
    struct SelvaNode *dst;
    struct SelvaFields *meta;
};

struct SelvaNodeReferences {
    uint32_t nr_refs;
    uint32_t offset;
    struct SelvaNodeReference *refs __counted_by(nr_refs);
};

struct SelvaNodeWeakReference {
    node_type_t dst_type;
    node_id_t dst_id;
};

/* TODO Support */
struct SelvaNodeWeakReferences {
    uint32_t nr_refs;
    uint32_t offset;
    struct SelvaNodeWeakReference *refs __counted_by(nr_refs);
};

struct SelvaFieldsAny {
    enum SelvaFieldType type; /*!< Type of the value. */
    union {
        bool boolean; /*!< SELVA_FIELD_TYPE_BOOLEAN */
        double number; /*!< SELVA_FIELD_TYPE_NUMBER */
        int64_t timestamp; /*!< SELVA_FIELD_TYPE_TIMESTAMP */
        int32_t integer; /*!< SELVA_FIELD_TYPE_INTEGER */
        struct selva_string *string; /*!< SELVA_FIELD_TYPE_STRING */
        uint32_t uint32; /*!< SELVA_FIELD_TYPE_UINT32 */
        uint64_t uint64; /*!< SELVA_FIELD_TYPE_UINT64 */
        uint8_t uint8; /*!< SELVA_FIELD_TYPE_UINT8 */
        uint8_t enu; /*!< SELVA_FIELD_TYPE_ENUM */
        struct SelvaNodeReference *reference; /*!< SELVA_FIELD_TYPE_REFERENCE */
        struct SelvaNodeReferences *references; /*!< SELVA_FIELD_TYPE_REFERENCES */
        struct SelvaNodeWeakReference weak_reference; /*!< SELVA_FIELD_TYPE_WEAK_REFERENCE */
    };
};

#if __has_c_attribute(unsequenced)
[[unsequenced]]
#else
__attribute__((pure))
#endif
size_t fields_get_data_size(const struct SelvaFieldSchema *fs);

/**
 * Set field value.
 */
int selva_fields_set(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, const void *value, size_t len);

int selva_fields_set_reference_meta(struct SelvaNode *node, struct SelvaNodeReference *ref, struct EdgeFieldConstraint *efc, const struct SelvaFieldSchema *fs, const void *value, size_t len);

/**
 * Get field value.
 * Strings and references are returned as direct pointers to the data.
 */
int selva_fields_get(struct SelvaNode *node, field_t field, struct SelvaFieldsAny *any);

int selva_fields_get_reference_meta(struct SelvaNodeReference *ref, field_t field, struct SelvaFieldsAny *any);

/**
 * Delete field.
 */
int selva_fields_del(struct SelvaDb *db, struct SelvaNode *node, field_t field);

/**
 * Delete an edge from a references field.
 */
int selva_fields_del_ref(struct SelvaDb *db, struct SelvaNode * restrict node, field_t field, node_id_t dst_node_id);

void selva_fields_init(const struct SelvaTypeEntry *type, struct SelvaNode * restrict node);

/**
 * Destroy all fields of a node.
 * This will set nr_fields = 0, making setting new field values impossible despite
 * the schema possibly defining fields for this node.
 */
void selva_fields_destroy(struct SelvaDb *db, struct SelvaNode * restrict node);
