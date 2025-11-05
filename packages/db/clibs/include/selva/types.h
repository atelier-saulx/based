/*
 * Copyright (c) 2024-2025 SAULX
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
    SELVA_FIELD_TYPE_ALIASES = 9,
    SELVA_FIELD_TYPE_COLVEC = 10,
    SELVA_FIELD_TYPE_REFERENCES_CIRCULAR = 11,
} __packed;

struct EdgeFieldConstraint {
    enum EdgeFieldConstraintFlag {
        EDGE_FIELD_CONSTRAINT_FLAG_DEPENDENT = 0x01,
    } __packed flags;
    field_t inverse_field;
    node_type_t dst_node_type;
    node_type_t meta_node_type;
    uint32_t circular_limit; /*!< Used for SELVA_FIELD_TYPE_REFERENCES_CIRCULAR. */
};

struct SelvaFieldSchema {
    field_t field;
    enum SelvaFieldType type;
    union {
        struct {
            size_t fixed_len; /*!< Greater than zero if the string has a fixed maximum length. */
        } string; /*!< SELVA_FIELD_TYPE_STRING */
        struct EdgeFieldConstraint edge_constraint; /*!< SELVA_FIELD_TYPE_REFERENCE, SELVA_FIELD_TYPE_REFERENCES, SELVA_FIELD_TYPE_WEAK_REFERENCE, and SELVA_FIELD_TYPE_WEAK_REFERENCES. */
        struct {
            uint16_t len; /*!< Size of the smb. */
            uint32_t default_off; /*!< Offset to the default in  the raw schema buffer. */
        } smb; /*!< SELVA_FIELD_TYPE_MICRO_BUFFER */
        size_t alias_index; /*!< Index in aliases for SELVA_FIELD_TYPE_ALIAS and SELVA_FIELD_TYPE_ALIASES. */
        struct {
            uint16_t vec_len; /*!< Length of a single vector. */
            uint16_t comp_size; /*!< Component size in the vector. */
            field_t index; /*!< Index in te->col_fields.colvec.v. */
        } colvec;
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
    size_t nr_aliases; /*!< Number of alias fields in this type. */
    size_t nr_colvecs; /*!< Number of columnar vector fields. */
    struct SelvaFieldsSchema fields_schema;
    /* Nothing must be put after this line. */
};

struct SelvaAlias;
struct SelvaAliases;
struct SelvaDb;
struct SelvaFieldInfo;
struct SelvaFields;
struct SelvaNode;
struct SelvaTypeEntry;

typedef void (*selva_dirty_node_cb_t)(void *ctx, node_type_t type, node_id_t node_id);

SELVA_EXPORT
bool selva_is_valid_field_type(enum SelvaFieldType ftype);

SELVA_EXPORT
const char *selva_str_field_type(enum SelvaFieldType ftype);
