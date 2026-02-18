/*
 * Copyright (c) 2024-2026 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stddef.h>
#include <stdint.h>
#include "selva/_export.h"

#define SELVA_FIELDS_MAX 249

/**
 * Reserved (N/A) field id.
 * Can be used to mark that a field doesn't exist.
 * E.g. if created and updated fields don't exist their ids can be set to this
 * value.
 * Technically fields 251..255 are all reserved.
 */
#define SELVA_FIELDS_RESERVED 255

typedef uint32_t block_id_t;
typedef uint8_t field_t;
typedef uint32_t node_id_t;
typedef uint16_t node_type_t;
#ifndef __zig
typedef unsigned _BitInt(128) selva_hash128_t;
#else
typedef unsigned __int128 selva_hash128_t;
#endif

struct SelvaFieldsSchema;

enum SelvaFieldType {
    SELVA_FIELD_TYPE_NULL = 0,
    SELVA_FIELD_TYPE_MICRO_BUFFER = 1,
    SELVA_FIELD_TYPE_STRING = 2,
    SELVA_FIELD_TYPE_TEXT = 3,
    SELVA_FIELD_TYPE_REFERENCE = 4,
    SELVA_FIELD_TYPE_REFERENCES = 5,
    SELVA_FIELD_TYPE_WEAK_REFERENCE __attribute__((deprecated)) = 6,
    SELVA_FIELD_TYPE_WEAK_REFERENCES __attribute__((deprecated)) = 7,
    SELVA_FIELD_TYPE_ALIAS = 8,
    SELVA_FIELD_TYPE_ALIASES __attribute__((deprecated)) = 9,
    SELVA_FIELD_TYPE_COLVEC = 10,
} __packed;

struct EdgeFieldConstraint {
    enum EdgeFieldConstraintFlag {
        EDGE_FIELD_CONSTRAINT_FLAG_DEPENDENT = 0x01,
    } __packed __flag_enum flags;
    field_t inverse_field;
    node_type_t dst_node_type;
    node_type_t edge_node_type;
    size_t limit;
};

struct SelvaFieldSchema {
    field_t field;
    enum SelvaFieldType type;
    union {
        struct {
            size_t fixed_len; /*!< Greater than zero if the string has a fixed maximum length. */
            uint32_t default_off; /*!< Offset to the default value in te->schema_buf. */
            uint32_t default_len;
        } string; /*!< SELVA_FIELD_TYPE_STRING */
        struct {
            uint32_t nr_defaults; /*!< Number of defaults for this text field. */
            uint32_t defaults_off; /*!< Offset to the default values in te->schema_buf. */
        } text; /*!< SELVA_FIELD_TYPE_TEXT */
        struct EdgeFieldConstraint edge_constraint; /*!< SELVA_FIELD_TYPE_REFERENCE, SELVA_FIELD_TYPE_REFERENCES, SELVA_FIELD_TYPE_WEAK_REFERENCE, and SELVA_FIELD_TYPE_WEAK_REFERENCES. */
        struct {
            uint32_t default_off; /*!< Offset to the default in  the raw schema buffer. */
            uint16_t len; /*!< Size of the smb. */
        } smb; /*!< SELVA_FIELD_TYPE_MICRO_BUFFER */
        size_t alias_index; /*!< Index in aliases for SELVA_FIELD_TYPE_ALIAS and SELVA_FIELD_TYPE_ALIASES. */
        struct {
            uint16_t vec_len; /*!< Length of a single vector. */
            uint16_t comp_size; /*!< Component size in the vector. */
            uint32_t default_off; /*!< Offset to the default value in te->schema_buf. */
            field_t index; /*!< Index in te->col_fields.colvec.v. */
        } colvec; /*!< SELVA_FIELD_TYPE_COLVEC */
    };
} __designated_init;

struct SelvaFieldsSchema {
    field_t nr_fields; /*!< The total number of fields in this schema. */
    field_t nr_fixed_fields; /*!< The number of fixed fields that are always allocated. */
    field_t nr_virtual_fields; /*!< The number of fields that are not included in fields.fields_map. These must be the last field ids used. */
    /**
     * Template for fields->fields_map.
     */
    struct {
        void *field_map_buf;
        size_t field_map_len;
        void *fixed_data_buf;
        size_t fixed_data_len;
    } template;
    struct SelvaFieldSchema field_schemas[SELVA_FIELDS_MAX];
};

struct SelvaNodeSchema {
    size_t nr_alias_fields; /*!< Number of alias fields in this type. */
    size_t nr_colvec_fields; /*!< Number of columnar vector fields. */
    struct SelvaFieldsSchema fields_schema;
    /* Nothing must be put after this line. */
};

enum SelvaTypeBlockStatus {
    SELVA_TYPE_BLOCK_STATUS_EMPTY = 0, /*!< Block not in use. */
    SELVA_TYPE_BLOCK_STATUS_FS = 0x01, /*!< Block has been saved previously. */
    SELVA_TYPE_BLOCK_STATUS_INMEM = 0x02, /*!< Block loaded in memory. */
    SELVA_TYPE_BLOCK_STATUS_DIRTY = 0x04, /*!< Can't be set if te->blocks->blocks[block_i].status isn't set. */
    SELVA_TYPE_BLOCK_STATUS_LOADING = 0x80, /*!< Loading in progress. */
    SELVA_TYPE_BLOCK_STATUS_SAVING = 0x40, /*!< Saving in progress. */
} __flag_enum;

struct SelvaAlias;
struct SelvaAliases;
struct SelvaDb;
struct SelvaFieldInfo;
struct SelvaFields;
struct SelvaNode;
struct SelvaTypeEntry;

/**
 * Node get result.
 * This struct can be used as a return value from functions that should
 * return a node. If the node is not loaded in memory then the caller can
 * determine if it still might exist by checking `block_status`.
 */
struct SelvaNodeRes {
    struct SelvaNode *node;
    block_id_t block;
    enum SelvaTypeBlockStatus block_status;
} __designated_init;

typedef void (*selva_db_dirty_hook_t)(void *ctx, node_type_t type, node_id_t node_id);

SELVA_EXPORT
bool selva_is_valid_field_type(enum SelvaFieldType ftype);

SELVA_EXPORT
const char *selva_str_field_type(enum SelvaFieldType ftype);
