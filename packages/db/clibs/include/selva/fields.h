/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "selva/_export.h"
#include "selva/types.h"

struct selva_string;

/**
 * Reserved (N/A) field id.
 * Can be used to mark that a field doesn't exist.
 * E.g. if created and updated fields don't exist their ids can be set to this
 * value.
 * Techinally fields 251..255 are all reserved.
 */
#define SELVA_FIELDS_RESERVED 255

struct SelvaNodeReference {
    struct SelvaNode *dst;
    struct SelvaFields *meta;
};

struct SelvaNodeReferences {
    uint32_t nr_refs;
    uint16_t offset;
    /*!<
     * Greatest node_id ever inserted in this field. (Compressed/packed).
     * This can be zeroed when the gretest node is deleted, which may
     * cause some lookup slowdown.
     */
    uint16_t great_idz;
    struct SelvaNodeReference *refs __pcounted_by(nr_refs);
};

struct SelvaNodeWeakReference {
    /* THe type can be found from the schema. */
#if 0
    node_type_t dst_type;
#endif
    node_id_t dst_id;
};

struct SelvaNodeWeakReferences {
    uint32_t nr_refs;
    uint32_t offset;
    struct SelvaNodeWeakReference *refs __pcounted_by(nr_refs);
};

struct SelvaMicroBuffer {
    uint16_t len;
    uint8_t data[] __counted_by(len);
} __packed;

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
        struct SelvaMicroBuffer *smb; /*!< SELVA_FIELD_TYPE_MICRO_BUFFER */
    };
};

struct SelvaFieldsPointer {
    uint8_t *ptr;
    size_t off;
    size_t len;
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
int selva_fields_set(
        struct SelvaDb *db,
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        const void *value, size_t len);

SELVA_EXPORT
int selva_fields_get_mutable_string(
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        size_t len,
        struct selva_string **s);

SELVA_EXPORT
int selva_fields_reference_set(
        struct SelvaDb *db,
        struct SelvaNode * restrict src,
        const struct SelvaFieldSchema *fs_src,
        struct SelvaNode * restrict dst,
        struct SelvaNodeReference **ref_out);

/**
 * @param index 0 = first; -1 = last.
 */
SELVA_EXPORT
int selva_fields_references_insert(
        struct SelvaDb *db,
        struct SelvaNode * restrict node,
        const struct SelvaFieldSchema *fs,
        ssize_t index,
        struct SelvaTypeEntry *te_dst,
        struct SelvaNode * restrict dst,
        struct SelvaNodeReference **ref_out);

/**
 * Move reference from old to new index in a references field array.
 * If index_new > index_old then the ref will be after the reference that was in index_new before the operation;
 * If index_new < index_ld then the ref  will be before the reference that was in the index_new before the operation.
 * index_new and index_old can be negative, which will start counting the references array from the last position.
 * It's not possible to create a gap of null references using this function.
 */
SELVA_EXPORT
int selva_fields_references_move(
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        ssize_t index_old,
        ssize_t index_new);

/**
 * Swap two references in a references field array.
 */
SELVA_EXPORT
int selva_fields_references_swap(
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        size_t index_a,
        size_t index_b);

SELVA_EXPORT
int selva_fields_set_reference_meta(
        struct SelvaNode *node,
        struct SelvaNodeReference *ref,
        struct EdgeFieldConstraint *efc,
        field_t field,
        const void *value, size_t len);

SELVA_EXPORT
int selva_fields_get_reference_meta_mutable_string(
        struct SelvaNode *node,
        struct SelvaNodeReference *ref,
        struct EdgeFieldConstraint *efc,
        field_t field,
        size_t len,
        struct selva_string **s);

/**
 * Get field value.
 * Strings and references are returned as direct pointers to the data.
 */
SELVA_EXPORT
struct SelvaFieldsAny selva_fields_get2(struct SelvaFields *fields, field_t field);

SELVA_EXPORT
struct SelvaFieldsAny selva_fields_get(struct SelvaNode *node, field_t field);

SELVA_EXPORT
struct SelvaNodeReference *selva_fields_get_reference(struct SelvaNode *node, field_t field);

SELVA_EXPORT
struct SelvaNodeReferences *selva_fields_get_references(struct SelvaNode *node, field_t field);

SELVA_EXPORT
struct SelvaNodeWeakReference selva_fields_get_weak_reference(struct SelvaFields *fields, field_t field);

SELVA_EXPORT
struct SelvaNodeWeakReferences selva_fields_get_weak_references(struct SelvaFields *fields, field_t field);

SELVA_EXPORT
struct SelvaFieldsPointer selva_fields_get_raw2(struct SelvaFields *fields, struct SelvaFieldSchema *fs)
    __attribute__((nonnull));

SELVA_EXPORT
struct SelvaFieldsPointer selva_fields_get_raw(struct SelvaNode *node, struct SelvaFieldSchema *fs);

/**
 * Delete field.
 */
SELVA_EXPORT
int selva_fields_del(struct SelvaDb *db, struct SelvaNode *node, struct SelvaFieldSchema *fs);

/**
 * Delete an edge from a references field.
 */
SELVA_EXPORT
int selva_fields_del_ref(struct SelvaDb *db, struct SelvaNode *node, field_t field, node_id_t dst_node_id);

SELVA_EXPORT
void selva_fields_clear_references(struct SelvaDb *db, struct SelvaNode *node, struct SelvaFieldSchema *fs);

/**
 * Init fields of a node.
 */
SELVA_EXPORT
void selva_fields_init(const struct SelvaFieldsSchema *schema, struct SelvaFields *fields);

/**
 * Destroy all fields of a node.
 * This will set nr_fields = 0, making setting new field values impossible
 * regardless wether the schema defines fields for this node.
 */
SELVA_EXPORT
void selva_fields_destroy(struct SelvaDb *db, struct SelvaNode *node);
