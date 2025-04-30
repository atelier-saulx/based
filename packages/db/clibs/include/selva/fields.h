/*
 * Copyright (c) 2024-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stdint.h>
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

/**
 * Type helper to determine the size of statically (constant/fixed) sized fields.
 */
union SelvaStaticFields {
    bool boolean; /*!< SELVA_FIELD_TYPE_BOOLEAN */
    double number; /*!< SELVA_FIELD_TYPE_NUMBER */
    struct selva_string *string; /*!< SELVA_FIELD_TYPE_STRING */
    int8_t int8; /* SELVA_FIELD_TYPE_INT8 */
    uint8_t uint8; /*!< SELVA_FIELD_TYPE_UINT8 */
    int16_t int16; /*!< SELVA_FIELD_TYPE_INT16 */
    uint16_t uint16; /*!< SELVA_FIELD_TYPE_UINT16 */
    int32_t int32; /*!< SELVA_FIELD_TYPE_INT32 */
    uint32_t uint32; /*!< SELVA_FIELD_TYPE_UINT32 */
    uint8_t enu; /*!< SELVA_FIELD_TYPE_ENUM */
    struct SelvaNodeWeakReference weak_reference; /*!< SELVA_FIELD_TYPE_WEAK_REFERENCE */
};

struct SelvaFieldsPointer {
    uint8_t *ptr;
    size_t off;
    size_t len;
};

/**
 * Precalculated empty strings for text translations.
 * The size of the string is 8 for better alignment but they are only
 * filled upto 6 bytes.
 */
SELVA_EXPORT
extern const uint8_t selva_fields_text_tl_empty[_selva_lang_last][8];

#define SELVA_FIELDS_TEXT_TL_EMPTY_LEN 6

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

void selva_fields_ensure_ref_meta(
        struct SelvaDb *db,
        struct SelvaNode *node,
        struct SelvaNodeReference *ref,
        const struct EdgeFieldConstraint *efc)
    __attribute__((nonnull));

/**
 * Set field value.
 */
SELVA_EXPORT
int selva_fields_set(
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        const void *value, size_t len);

/**
 * Set field value by a `fields` pointer.
 * @param fields can be either `node->fields` or any other `fields` structure
 *               associated with the given node (currently edge).
 */
SELVA_EXPORT
int fields_set2(
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        struct SelvaFields *fields,
        const void *value, size_t len);

SELVA_EXPORT
int selva_fields_get_mutable_string(
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        size_t len,
        struct selva_string **s)
    __attribute__((access(write_only, 4)));

SELVA_EXPORT
struct SelvaFieldInfo *selva_fields_ensure(struct SelvaFields *fields, const struct SelvaFieldSchema *fs);

/*
 * TODO Document diff to get_mutable_string
 */
SELVA_EXPORT
struct selva_string *selva_fields_ensure_string(
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        size_t initial_len);

SELVA_EXPORT
struct selva_string *selva_fields_ensure_string2(
        struct SelvaDb *db,
        struct SelvaNode *node,
        const struct EdgeFieldConstraint *efc,
        struct SelvaNodeReference *ref,
        const struct SelvaFieldSchema *fs,
        size_t initial_len);

/**
 * Set reference to fields.
 * @param dirty_nodes returns the nodes that were changed, apart from src and dst.
 *                    [n].id = 0 = nil;
 *                    [0] = the node src was pointing to previously (same type as dst);
 *                    [1] = the node dst was pointing to previously (same type as src).
 */
SELVA_EXPORT
int selva_fields_reference_set(
        struct SelvaDb *db,
        struct SelvaNode * restrict src,
        const struct SelvaFieldSchema *fs_src,
        struct SelvaNode * restrict dst,
        struct SelvaNodeReference **ref_out,
        node_id_t dirty_nodes[static 2])
    __attribute__((access(write_only, 5), access(write_only, 6)));

/**
 * @param index 0 = first; -1 = last.
 * @param reorder move the existing ref to `index` instead of returning EEXIST.
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
int selva_fields_set_string(
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        struct SelvaFieldInfo *nfo,
        const char *str,
        size_t len);

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
        struct SelvaNode * restrict node,
        const struct SelvaFieldSchema *fs,
        enum selva_lang_code lang,
        const char **str,
        size_t *len);

SELVA_EXPORT
struct SelvaNodeReference *selva_fields_get_reference(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
    __attribute__((nonnull));

SELVA_EXPORT
struct SelvaNodeReferences *selva_fields_get_references(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
    __attribute__((nonnull));

SELVA_EXPORT
struct SelvaNodeWeakReference selva_fields_get_weak_reference(struct SelvaDb *db, struct SelvaFields *fields, field_t field)
    __attribute__((nonnull));

SELVA_EXPORT
struct SelvaNodeWeakReferences selva_fields_get_weak_references(struct SelvaDb *db, struct SelvaFields *fields, field_t field)
    __attribute__((nonnull));

SELVA_EXPORT
struct SelvaNode *selva_fields_resolve_weak_reference(
        const struct SelvaDb *db,
        const struct SelvaFieldSchema *fs,
        const struct SelvaNodeWeakReference *weak_ref)
    __attribute__((nonnull));

SELVA_EXPORT
struct selva_string *selva_fields_get_selva_string3(struct SelvaNodeReference *ref, const struct SelvaFieldSchema *fs)
    __attribute__((nonnull));

SELVA_EXPORT
struct selva_string *selva_fields_get_selva_string2(struct SelvaFields *fields, const struct SelvaFieldSchema *fs)
    __attribute__((nonnull));

SELVA_EXPORT
struct selva_string *selva_fields_get_selva_string(struct SelvaNode *node, const struct SelvaFieldSchema *fs)
    __attribute__((nonnull));

SELVA_EXPORT
struct SelvaFieldsPointer selva_fields_get_raw2(struct SelvaFields *fields, const struct SelvaFieldSchema *fs)
    __attribute__((nonnull));

SELVA_EXPORT
struct SelvaFieldsPointer selva_fields_get_raw(struct SelvaNode *node, const struct SelvaFieldSchema *fs)
    __attribute__((nonnull));

/**
 * Delete field.
 * @param dirty_cb will be called with the deleted node_id in case of a reference(s) field.
 */
SELVA_EXPORT
int selva_fields_del(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, selva_dirty_node_cb_t dirty_cb, void *dirty_ctx)
    __attribute__((nonnull(1, 2, 3)));

/**
 * Delete an edge from a references field.
 */
SELVA_EXPORT
int selva_fields_del_ref(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, node_id_t dst_node_id);

/**
 * Clear a references field but don't free it.
 */
SELVA_EXPORT
void selva_fields_clear_references(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, selva_dirty_node_cb_t dirty_cb, void *dirty_ctx)
    __attribute__((nonnull(1, 2, 3)));

/**
 * Init the fields struct of a node or edge.
 */
SELVA_EXPORT
void selva_fields_init(const struct SelvaFieldsSchema *schema, struct SelvaFields *fields)
    __attribute__((nonnull));

/**
 * Destroy all fields of a node.
 * This will set nr_fields = 0, making setting new field values impossible
 * regardless wether the schema defines fields for this node.
 */
SELVA_EXPORT
void selva_fields_destroy(struct SelvaDb *db, struct SelvaNode *node, selva_dirty_node_cb_t dirty_cb, void *dirty_ctx)
    __attribute__((nonnull(1, 2)));

SELVA_EXPORT
void selva_fields_hash_update(struct XXH3_state_s *hash_state, struct SelvaDb *db, const struct SelvaFieldsSchema *schema, const struct SelvaFields *fields);

SELVA_EXPORT
selva_hash128_t selva_fields_hash(struct SelvaDb *db, const struct SelvaFieldsSchema *schema, const struct SelvaFields *fields);
