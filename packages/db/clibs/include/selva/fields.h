/*
 * Copyright (c) 2024-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <sys/types.h>
#include "selva/_export.h"
#ifdef __zig
struct selva_string;
#else
#include "selva/selva_string.h"
#endif
#include "selva/types.h"
#include "selva_lang_code.h"

/**
 * Reserved (N/A) field id.
 * Can be used to mark that a field doesn't exist.
 * E.g. if created and updated fields don't exist their ids can be set to this
 * value.
 * Technically fields 251..255 are all reserved.
 */
#define SELVA_FIELDS_RESERVED 255

struct XXH3_state_s; /* RFE Not good? */

#ifndef __zig
struct SelvaTextField {
    struct selva_string *tl __pcounted_by(len);
    uint8_t len;
} __packed;
#endif

struct SelvaNodeReference {
    struct SelvaNode *dst;
    struct SelvaFields *meta;
};

struct SelvaNodeReferences {
    uint32_t nr_refs;
    uint16_t offset;
    struct SelvaNodeReference *refs __pcounted_by(nr_refs);
    node_id_t *index __pcounted_by(nr_refs); /*!< Sorted index of all nodes in `.refs`. */
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
        int64_t timestamp; /*!< SELVA_FIELD_TYPE_TIMESTAMP, should fit time_t */
        struct selva_string *string; /*!< SELVA_FIELD_TYPE_STRING */
        int8_t int8; /* SELVA_FIELD_TYPE_INT8 */
        uint8_t uint8; /*!< SELVA_FIELD_TYPE_UINT8 */
        int16_t int16; /*!< SELVA_FIELD_TYPE_INT16 */
        uint16_t uint16; /*!< SELVA_FIELD_TYPE_UINT16 */
        int32_t int32; /*!< SELVA_FIELD_TYPE_INT32 */
        uint32_t uint32; /*!< SELVA_FIELD_TYPE_UINT32 */
        int64_t int64; /* SELVA_FIELD_TYPE_INT64 */
        uint64_t uint64; /*!< SELVA_FIELD_TYPE_UINT64 */
        uint8_t enu; /*!< SELVA_FIELD_TYPE_ENUM */
#if 0
        struct SelvaTextField *text; /*!< SELVA_FIELD_TYPE_TEXT */
        struct SelvaNodeReference *reference; /*!< SELVA_FIELD_TYPE_REFERENCE */
        struct SelvaNodeReferences *references; /*!< SELVA_FIELD_TYPE_REFERENCES */
        struct SelvaNodeWeakReference weak_reference; /*!< SELVA_FIELD_TYPE_WEAK_REFERENCE */
        struct SelvaNodeWeakReferences weak_references; /*!< SELVA_FIELD_TYPE_WEAK_REFERENCES */
        struct SelvaMicroBuffer *smb; /*!< SELVA_FIELD_TYPE_MICRO_BUFFER */
#endif
        // HyperLogLogPlusPlus cardinality; /*!< SELVA_FIELD_TYPE_HLL */
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
__purefn
#endif
size_t selva_fields_get_data_size(const struct SelvaFieldSchema *fs);

#if __has_c_attribute(reproducible)
[[reproducible]]
#endif
void *selva_fields_nfo2p(struct SelvaFields *fields, const struct SelvaFieldInfo *nfo);

/**
 * Set field value.
 */
SELVA_EXPORT
int selva_fields_set(
        struct SelvaDb *db,
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        const void *value, size_t len);

/**
 * Set field value with CRC.
 */
SELVA_EXPORT
int selva_fields_set_wcrc(
        struct SelvaDb *db,
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        const void *value, size_t len,
        uint32_t crc);

SELVA_EXPORT
int selva_fields_get_mutable_string(
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        size_t len,
        struct selva_string **s)
    __attribute__((access(write_only, 4)));

SELVA_EXPORT
int selva_fields_reference_set(
        struct SelvaDb *db,
        struct SelvaNode * restrict src,
        const struct SelvaFieldSchema *fs_src,
        struct SelvaNode * restrict dst,
        struct SelvaNodeReference **ref_out)
    __attribute__((access(write_only, 5)));

/**
 * @param index 0 = first; -1 = last.
 */
SELVA_EXPORT
int selva_fields_references_insert(
        struct SelvaDb *db,
        struct SelvaNode * restrict node,
        const struct SelvaFieldSchema *fs,
        ssize_t index,
        bool reorder,
        struct SelvaTypeEntry *te_dst,
        struct SelvaNode * restrict dst,
        struct SelvaNodeReference **ref_out)
    __attribute__((access(write_only, 8)));

/**
 * Prealloc a references field buffer.
 * @returns nr_refs.
 */
SELVA_EXPORT
size_t selva_fields_prealloc_refs(struct SelvaNode *node, const struct SelvaFieldSchema *fs, size_t nr_refs_min);

SELVA_EXPORT
int selva_fields_references_insert_tail_wupsert(
        struct SelvaDb *db,
        struct SelvaNode * restrict node,
        const struct SelvaFieldSchema *fs,
        struct SelvaTypeEntry *te_dst,
        const node_id_t ids[],
        size_t nr_ids)
    __attribute__((access(read_only, 5, 6)));

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
        struct SelvaDb *db,
        struct SelvaNode *node,
        struct SelvaNodeReference *ref,
        const struct EdgeFieldConstraint *efc,
        field_t field,
        const void *value, size_t len);

SELVA_EXPORT
int selva_fields_get_reference_meta_mutable_string(
        struct SelvaDb *db,
        struct SelvaNode *node,
        struct SelvaNodeReference *ref,
        const struct EdgeFieldConstraint *efc,
        field_t field,
        size_t len,
        struct selva_string **s);

/**
 * Set string field.
 *
 * str format:
 *  0      1      2          len
 * +------+------+--------+-----+
 * | LANG | COMP |  DATA  | CRC |
 * +------+------+--------+-----+
 */
SELVA_EXPORT
int selva_fields_set_string(struct SelvaNode *node, const struct SelvaFieldSchema *fs, struct SelvaFieldInfo *nfo, const char *str, size_t len);

/**
 * Set text field translation.
 *
 * str format:
 *  0      1      2          len
 * +------+------+--------+-----+
 * | LANG | COMP |  DATA  | CRC |
 * +------+------+--------+-----+
 */
SELVA_EXPORT
int selva_fields_set_text(
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        const char *str,
        size_t len);

/**
 * Get text field translation.
 *
 * str format:
 *  0      1      2          len
 * +------+------+--------+-----+
 * | LANG | COMP |  DATA  | CRC |
 * +------+------+--------+-----+
 */
SELVA_EXPORT
int selva_fields_get_text(
        struct SelvaDb *db,
        struct SelvaNode * restrict node,
        const struct SelvaFieldSchema *fs,
        enum selva_lang_code lang,
        const char **str,
        size_t *len);

SELVA_EXPORT
struct SelvaNodeReference *selva_fields_get_reference(struct SelvaNode *node, field_t field);

SELVA_EXPORT
struct SelvaNodeReferences *selva_fields_get_references(struct SelvaNode *node, field_t field);

SELVA_EXPORT
struct SelvaNodeWeakReference selva_fields_get_weak_reference(struct SelvaFields *fields, field_t field);

SELVA_EXPORT
struct SelvaNodeWeakReferences selva_fields_get_weak_references(struct SelvaFields *fields, field_t field);

SELVA_EXPORT
struct SelvaNode *selva_fields_resolve_weak_reference(
        const struct SelvaDb *db,
        const struct SelvaFieldSchema *fs,
        const struct SelvaNodeWeakReference *weak_ref);

SELVA_EXPORT
struct SelvaFieldsPointer selva_fields_get_raw2(struct SelvaFields *fields, const struct SelvaFieldSchema *fs)
    __attribute__((nonnull));

SELVA_EXPORT
struct SelvaFieldsPointer selva_fields_get_raw(struct SelvaNode *node, const struct SelvaFieldSchema *fs);

/**
 * Delete field.
 */
SELVA_EXPORT
int selva_fields_del(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs);

/**
 * Delete an edge from a references field.
 */
SELVA_EXPORT
int selva_fields_del_ref(struct SelvaDb *db, struct SelvaNode *node, field_t field, node_id_t dst_node_id);

SELVA_EXPORT
void selva_fields_clear_references(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs);

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

SELVA_EXPORT
int selva_fields_get_text_crc(const struct SelvaNode *node, const struct SelvaFieldSchema *fs, enum selva_lang_code lang, uint32_t *crc);

SELVA_EXPORT
void selva_fields_hash_update(struct XXH3_state_s *hash_state, struct SelvaDb *db, const struct SelvaFieldsSchema *schema, const struct SelvaFields *fields);

SELVA_EXPORT
selva_hash128_t selva_fields_hash(struct SelvaDb *db, const struct SelvaFieldsSchema *schema, const struct SelvaFields *fields);

SELVA_EXPORT
struct selva_string *fields_ensure_string(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, size_t initial_len);
