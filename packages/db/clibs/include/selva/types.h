/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stddef.h>
#include <stdint.h>
#include "selva/_export.h"

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
    SELVA_FIELD_TYPE_TIMESTAMP = 1,
    SELVA_FIELD_TYPE_CREATED = 2,
    SELVA_FIELD_TYPE_UPDATED = 3,
    SELVA_FIELD_TYPE_NUMBER = 4,
    SELVA_FIELD_TYPE_SPARE1 = 5,
    SELVA_FIELD_TYPE_INT8 = 20,
    SELVA_FIELD_TYPE_UINT8 = 6,
    SELVA_FIELD_TYPE_INT16 = 21,
    SELVA_FIELD_TYPE_UINT16 = 22,
    SELVA_FIELD_TYPE_INT32 = 23,
    SELVA_FIELD_TYPE_UINT32 = 7,
    SELVA_FIELD_TYPE_INT64 = 24,
    SELVA_FIELD_TYPE_UINT64 = 8,
    SELVA_FIELD_TYPE_BOOLEAN = 9,
    SELVA_FIELD_TYPE_ENUM = 10,
    SELVA_FIELD_TYPE_STRING = 11,
    SELVA_FIELD_TYPE_TEXT = 12,
    SELVA_FIELD_TYPE_REFERENCE = 13,
    SELVA_FIELD_TYPE_REFERENCES = 14,
    SELVA_FIELD_TYPE_WEAK_REFERENCE = 15,
    SELVA_FIELD_TYPE_WEAK_REFERENCES = 16,
    SELVA_FIELD_TYPE_MICRO_BUFFER = 17,
    SELVA_FIELD_TYPE_ALIAS = 18,
    SELVA_FIELD_TYPE_ALIASES = 19,
} __packed;

struct EdgeFieldConstraint {
    enum EdgeFieldConstraintFlag {
        /**
         * Skip saving this field while dumping.
         */
        EDGE_FIELD_CONSTRAINT_FLAG_SKIP_DUMP        = 0x80,
    } __packed flags;
    field_t inverse_field;
    node_type_t dst_node_type;
    struct SelvaFieldsSchema *fields_schema;
};

struct SelvaFieldSchema {
    field_t field;
    enum SelvaFieldType type;
    union {
        struct {
            size_t fixed_len; /*!< Greater than zero if the string has a fixed maximum length. */
        } string; /*!< SELVA_FIELD_TYPE_STRING */
        struct EdgeFieldConstraint edge_constraint; /*!< SELVA_FIELD_TYPE_REFERENCE and SELVA_FIELD_TYPE_REFERENCES. */
        struct {
            uint16_t len;
        } smb; /*!< SELVA_FIELD_TYPE_MICRO_BUFFER */
        size_t alias_index; /*!< Index in aliases for SELVA_FIELD_TYPE_ALIAS and SELVA_FIELD_TYPE_ALIASES. */
    };
} __designated_init;

struct SelvaFieldsSchema {
    field_t nr_fields; /*!< The total number of fields for this node type. */
    field_t nr_fixed_fields; /*!< Number of fixed fields that are always allocated. */
    struct {
        void *buf;
        size_t len;
        size_t fixed_data_size;
    } field_map_template;
    struct SelvaFieldSchema field_schemas[] __counted_by(nr_fields);
};

struct SelvaNodeSchema {
    field_t created_field;
    field_t updated_field;
    struct SelvaFieldsSchema fields_schema;
};

struct SelvaAlias;
struct SelvaAliases;
struct SelvaDb;
struct SelvaFieldInfo;
struct SelvaFields;
struct SelvaNode;
struct SelvaTypeEntry;

SELVA_EXPORT
bool selva_is_valid_field_type(enum SelvaFieldType ftype);

SELVA_EXPORT
const char *selva_str_field_type(enum SelvaFieldType ftype);
