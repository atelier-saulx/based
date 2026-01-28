/*
 * Copyright (c) 2024-2026 SAULX
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

struct XXH3_state_s; /* RFE Not good? */

#ifndef __zig
struct SelvaTextField {
    struct selva_string *tl __pcounted_by(len);
    uint8_t len;
} __packed;
#endif

struct SelvaNodeSmallReference {
    node_id_t dst;
};

struct SelvaNodeLargeReference {
    node_id_t dst;
    node_id_t edge;
};

enum SelvaNodeReferenceType {
    SELVA_NODE_REFERENCE_NULL = 0,
    SELVA_NODE_REFERENCE_SMALL = 1,
    SELVA_NODE_REFERENCE_LARGE = 2,
} __packed;

struct SelvaNodeReferenceAny {
    enum SelvaNodeReferenceType type;
    union {
        void *any;
        struct SelvaNodeSmallReference *small;
        struct SelvaNodeLargeReference *large;
    }
#ifdef __zig
      p
#endif
    ;
};

static_assert(offsetof(struct SelvaNodeLargeReference, dst) == offsetof(struct SelvaNodeSmallReference, dst));

struct SelvaNodeReferences {
    uint32_t nr_refs;
    uint16_t offset;
    enum SelvaNodeReferenceType size;

    union {
        void *any;
        struct SelvaNodeLargeReference *large __pcounted_by(nr_refs);
        struct SelvaNodeSmallReference *small __pcounted_by(nr_refs);
    };
    node_id_t *index __pcounted_by(nr_refs); /*!< Sorted index of all nodes in `.refs`. */
};
static_assert(offsetof(struct SelvaNodeReferences, any) == offsetof(struct SelvaNodeReferences, small));
static_assert(offsetof(struct SelvaNodeReferences, any) == offsetof(struct SelvaNodeReferences, large));
static_assert(offsetof(struct SelvaNodeReferences, small) == offsetof(struct SelvaNodeReferences, large));

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

struct SelvaNodeLargeReference *selva_fields_ensure_reference(
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs);

SELVA_EXPORT
struct SelvaNode *selva_fields_ensure_ref_edge(
        struct SelvaDb *db,
        struct SelvaNode *node,
        const struct EdgeFieldConstraint *efc,
        struct SelvaNodeLargeReference *ref,
        node_id_t edge_id);

SELVA_EXPORT
int selva_fields_get_mutable_string(
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        size_t len,
        struct selva_string **s)
    __attribute__((access(write_only, 4)));

/**
 * Get mutable string field without intializing the string buffer.
 */
int selva_fields_get_mutable_string_unsafe(struct SelvaNode *node, const struct SelvaFieldSchema *fs, size_t len, struct selva_string **s);

SELVA_EXPORT
void *selva_fields_ensure_micro_buffer(struct SelvaNode *node, const struct SelvaFieldSchema *fs);

/*
 * TODO Document diff to get_mutable_string
 */
SELVA_EXPORT
struct selva_string *selva_fields_ensure_string(
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        size_t initial_len);

SELVA_EXPORT
struct SelvaNodeReferenceAny selva_fields_references_get(const struct SelvaNodeReferences *refs, node_id_t dst_node_id);

/**
 * Set reference to fields.
 */
SELVA_EXPORT
int selva_fields_reference_set(
        struct SelvaDb *db,
        struct SelvaNode * restrict src,
        const struct SelvaFieldSchema *fs_src,
        struct SelvaNode * restrict dst,
        struct SelvaNodeReferenceAny *ref_out);

enum selva_fields_references_insert_flags {
    /**
     * Reorder existing reference to the new index.
     * The reference is either inserted or moved to the given index.
     */
    SELVA_FIELDS_REFERENCES_INSERT_FLAGS_REORDER = 0x01,
    SELVA_FIELDS_REFERENCES_INSERT_FLAGS_IGNORE_SRC_DEPENDENT = 0x02,
};

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
        enum selva_fields_references_insert_flags flags,
        struct SelvaTypeEntry *te_dst,
        struct SelvaNode * restrict dst,
        struct SelvaNodeReferenceAny *ref_out)
    __attribute__((access(write_only, 8)));

/**
 * Prealloc a references field buffer.
 * @returns nr_refs.
 */
SELVA_EXPORT
size_t selva_fields_prealloc_refs(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, size_t nr_refs_min);

SELVA_EXPORT
int selva_fields_references_insert_tail(
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

int selva_fields_get_mutable_text(
        struct SelvaNode *node,
        const struct SelvaFieldSchema *fs,
        enum selva_lang_code lang,
        size_t len,
        struct selva_string **out);

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
int selva_fields_set_micro_buffer(struct SelvaNode *node, const struct SelvaFieldSchema *fs, const void *value, size_t len);

SELVA_EXPORT
struct SelvaNodeLargeReference *selva_fields_get_reference(struct SelvaNode *node, const struct SelvaFieldSchema *fs)
    __attribute__((nonnull));

SELVA_EXPORT
struct SelvaNodeReferences *selva_fields_get_references(struct SelvaNode *node, const struct SelvaFieldSchema *fs)
    __attribute__((nonnull));

SELVA_EXPORT
struct selva_string *selva_fields_get_selva_string(struct SelvaNode *node, const struct SelvaFieldSchema *fs)
    __attribute__((nonnull));

SELVA_EXPORT
struct SelvaFieldsPointer selva_fields_get_raw(struct SelvaNode *node, const struct SelvaFieldSchema *fs)
    __attribute__((nonnull));

/**
 * Delete field.
 */
SELVA_EXPORT
int selva_fields_del(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
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
void selva_fields_clear_references(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs)
    __attribute__((nonnull(1, 2, 3)));

/**
 * Init the fields struct of a node or edge.
 */
void selva_fields_init_node(struct SelvaTypeEntry *te, struct SelvaNode *node)
    __attribute__((nonnull));

void selva_fields_flush(struct SelvaDb *db, struct SelvaNode *node);

/**
 * Destroy all fields of a node.
 */
SELVA_EXPORT
void selva_fields_destroy(struct SelvaDb *db, struct SelvaNode *node)
    __attribute__((nonnull(1, 2)));

/**
 * Unload node fields.
 * Same as selva_fields_destroy() but only clears references from one side.
 */
SELVA_EXPORT
void selva_fields_unload(struct SelvaDb *db, struct SelvaNode *node)
    __attribute__((nonnull));

SELVA_EXPORT
void selva_fields_hash_update(struct XXH3_state_s *hash_state, struct SelvaDb *db, const struct SelvaFieldsSchema *schema, const struct SelvaNode *node);

SELVA_EXPORT
selva_hash128_t selva_fields_hash(struct SelvaDb *db, const struct SelvaFieldsSchema *schema, const struct SelvaNode *node);
