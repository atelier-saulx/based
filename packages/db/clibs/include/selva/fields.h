/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "selva/_export.h"
#include "selva/types.h"

struct selva_string;

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
        struct SelvaNodeWeakReferences weak_references; /*!< SELVA_FIELD_TYPE_WEAK_REFERENCES */
    };
};

#if __has_c_attribute(unsequenced)
[[unsequenced]]
#else
__attribute__((pure))
#endif
size_t selva_fields_get_data_size(const struct SelvaFieldSchema *fs);

/**
 * Set field value.
 */
SELVA_EXPORT
int selva_fields_set(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, const void *value, size_t len);

SELVA_EXPORT
int selva_fields_get_mutable_string(struct SelvaNode *node, const struct SelvaFieldSchema *fs, size_t len, struct selva_string **s);

SELVA_EXPORT
int selva_fields_set_reference_meta(struct SelvaNode *node, struct SelvaNodeReference *ref, struct EdgeFieldConstraint *efc, field_t field, const void *value, size_t len);

SELVA_EXPORT
int selva_fields_get_reference_meta_mutable_string(struct SelvaNode *node, struct SelvaNodeReference *ref, struct EdgeFieldConstraint *efc, field_t field, size_t len, struct selva_string **s);

/**
 * Get field value.
 * Strings and references are returned as direct pointers to the data.
 */
SELVA_EXPORT
int selva_fields_get(struct SelvaFields *fields, field_t field, struct SelvaFieldsAny *any);

/**
 * Delete field.
 */
SELVA_EXPORT
int selva_fields_del(struct SelvaDb *db, struct SelvaNode *node, field_t field);

/**
 * Delete an edge from a references field.
 */
SELVA_EXPORT
int selva_fields_del_ref(struct SelvaDb *db, struct SelvaNode *node, field_t field, node_id_t dst_node_id);

/**
 * Init fields of a node.
 */
SELVA_EXPORT
void selva_fields_init(const struct SelvaTypeEntry *type, struct SelvaNode *node);

/**
 * Destroy all fields of a node.
 * This will set nr_fields = 0, making setting new field values impossible
 * regardless wether the schema defines fields for this node.
 */
SELVA_EXPORT
void selva_fields_destroy(struct SelvaDb *db, struct SelvaNode *node);
