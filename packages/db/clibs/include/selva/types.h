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
typedef int32_t cursor_id_t;
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
    SELVA_FIELD_TYPE_WEAK_REFERENCE = 6,
    SELVA_FIELD_TYPE_WEAK_REFERENCES = 7,
    SELVA_FIELD_TYPE_ALIAS = 8,
    SELVA_FIELD_TYPE_ALIASES = 9,
    SELVA_FIELD_TYPE_COLVEC = 10,
} __packed;

struct EdgeFieldConstraint {
    enum EdgeFieldConstraintFlag {
        EDGE_FIELD_CONSTRAINT_FLAG_DEPENDENT = 0x01,
        /**
         * _fields_schema is referenced from the opposite efc and shouldn't be freed.
         */
        EDGE_FIELD_CONSTRAINT_FLAG_SCHEMA_REF_CACHED = 0x40,
        /**
         * Skip saving this field while dumping.
         * If the field is of type SELVA_FIELD_TYPE_REFERENCES it's saved
         * regardless of this flag to preserve the original order of references.
         * However, the meta is only save from one side, i.e. the side that's
         * not skipped.
         */
        EDGE_FIELD_CONSTRAINT_FLAG_SKIP_DUMP = 0x80,
    } __packed flags;
    field_t inverse_field;
    node_type_t dst_node_type;
    /**
     * Don't use directly!
     * Use: `selva_get_edge_field_fields_schema()`
     */
    struct SelvaFieldsSchema *_fields_schema;
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
            uint16_t len;
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
    struct {
        void *buf;
        size_t len;
        size_t fixed_data_size;
    } field_map_template;
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
