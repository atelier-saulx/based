/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stdint.h>
#include "selva/_export.h"

typedef int8_t field_t;
typedef uint32_t node_id_t;
typedef uint16_t node_type_t;

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
} __packed;

struct EdgeFieldConstraint;
struct SelvaNodeSchema;
struct SelvaFieldSchema;
struct SelvaNode;
struct SelvaFields;
struct SelvaFieldInfo;
struct SelvaAlias;
struct SelvaTypeEntry;
struct SelvaAliases;
struct SelvaDb;

SELVA_EXPORT
bool selva_is_valid_field_type(enum SelvaFieldType ftype);

SELVA_EXPORT
const char *selva_str_field_type(enum SelvaFieldType ftype);
