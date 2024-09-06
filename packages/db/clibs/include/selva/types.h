/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stddef.h>
#include <stdint.h>
#include "selva/_export.h"

typedef uint8_t field_t;
typedef uint32_t node_id_t;
typedef uint16_t node_type_t;
typedef int32_t cursor_id_t;

enum SelvaFieldType {
    SELVA_FIELD_TYPE_NULL = 0,
    SELVA_FIELD_TYPE_TIMESTAMP = 1,
    SELVA_FIELD_TYPE_CREATED = 2,
    SELVA_FIELD_TYPE_UPDATED = 3,
    SELVA_FIELD_TYPE_NUMBER = 4,
    SELVA_FIELD_TYPE_INTEGER = 5,
    SELVA_FIELD_TYPE_UINT8 = 6,
    SELVA_FIELD_TYPE_UINT32 = 7,
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
} __packed;

struct EdgeFieldConstraint {
    enum EdgeFieldConstraintFlag {
        /**
         * Bidirectional reference.
         * TODO Is this needed if edges are always bidir.
         */
        EDGE_FIELD_CONSTRAINT_FLAG_BIDIRECTIONAL    = 0x01,
        /**
         * Edge field array mode.
         * By default an edge field acts like a set. This flag makes the field work like an array.
         * FIXME
         */
        EDGE_FIELD_CONSTRAINT_FLAG_ARRAY            = 0x02,
        /**
         * Skip saving this field while dumping.
         */
        EDGE_FIELD_CONSTRAINT_FLAG_SKIP_DUMP        = 0x80,
    } __packed flags;
    field_t nr_fields;
    field_t inverse_field;
    node_type_t dst_node_type;
    struct SelvaFieldSchema *field_schemas __counted_by(nr_fields);
};

struct SelvaFieldSchema {
    field_t field;
    enum SelvaFieldType type;
    union {
        struct {
            size_t fixed_len; /*!< Greater than zero if the string has a fixed maximum length. */
        } string;
        struct EdgeFieldConstraint edge_constraint;
        struct {
            uint16_t len;
        } smb;
    };
};

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

struct SelvaAlias;
struct SelvaAliases;
struct SelvaDb;
struct SelvaFieldInfo;
struct SelvaFields;
struct SelvaNode;
struct SelvaNodeSchema;
struct SelvaTypeEntry;

SELVA_EXPORT
bool selva_is_valid_field_type(enum SelvaFieldType ftype);

SELVA_EXPORT
const char *selva_str_field_type(enum SelvaFieldType ftype);
