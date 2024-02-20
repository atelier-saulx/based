/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef _SELVA_DB_
#define _SELVA_DB_

#include <inttypes.h>
#include <stddef.h>
#include <stdint.h>
#include "cdefs.h"
#include "selva_object_type.h"
#include "selva_db_types.h"

/**
 * Field protection modes.
 */
enum selva_field_prot_mode {
    /**
     * Allows writing to the field.
     */
    SELVA_FIELD_PROT_WRITE = 0x01,
    /**
     * Allows deleting the field.
     */
    SELVA_FIELD_PROT_DEL   = 0x02,
};

/**
 * Test if a field is protected.
 * E.g. if mode = SELVA_FIELD_PROT_WRITE and the function returns 1,
 * it means that the field can be written to.
 */
int selva_field_prot_check(const struct selva_string *s, enum SelvaObjectType type, enum selva_field_prot_mode mode);
int selva_field_prot_check_str(const char *field_str, size_t field_len, enum SelvaObjectType type, enum selva_field_prot_mode mode);

/**
 * Get the length of nodeId ignoring nul bytes at the end of the string.
 */
__purefn size_t Selva_NodeIdLen(const Selva_NodeId nodeId);

/**
 * Copy a node id of any length from src to a fixed length Selva_NodeId variable.
 */
static inline void Selva_NodeIdCpy(Selva_NodeId dest, const char *src) {
#if (defined(__GNUC__) || defined(__GNUG__)) && !defined(__clang__)
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wstringop-truncation"
#endif
    /* Note that strncpy() will handle nul padding. */
    __builtin_strncpy(dest, src, SELVA_NODE_ID_SIZE);
#if (defined(__GNUC__) || defined(__GNUG__)) && !defined(__clang__)
#pragma GCC diagnostic pop
#endif
}

/**
 * Copy selva_string into a nodeId buffer.
 */
int selva_string2node_id(Selva_NodeId nodeId, const struct selva_string *s);


/**
 * Initialize a string array from a node_id or node type string.
 */
#define SELVA_TYPE_INITIALIZER(nodeid_or_type) \
    { nodeid_or_type[0], nodeid_or_type[1] }

/**
 * Compare node types.
 */
static inline int Selva_CmpNodeType(const char t1[SELVA_NODE_TYPE_SIZE], const char t2[SELVA_NODE_TYPE_SIZE]) {
#if SELVA_NODE_TYPE_SIZE == 2
    unsigned short a, b;
#elif SELVA_NODE_TYPE_SIZE == 4
    unsigned int a, b;
#else
#error Unsupported SELVA_NODE_TYPE_SIZE
#endif

    static_assert(SELVA_NODE_TYPE_SIZE == sizeof(a), "type size matches the cmp variable");

    __builtin_memcpy(&a, t1, SELVA_NODE_TYPE_SIZE);
    __builtin_memcpy(&b, t2, SELVA_NODE_TYPE_SIZE);

    return a - b;
}

/**
 * Compare nodeId to type.
 */
static inline int Selva_CmpNodeIdType(const Selva_NodeId nodeId, const char type[SELVA_NODE_TYPE_SIZE]) {
    return Selva_CmpNodeType(nodeId, type);
}

static inline int Selva_IsEdgeMetaField(const char *field_str, size_t field_len)
{
    return field_len >= sizeof(SELVA_EDGE_META_FIELD) - 1 &&
           !__builtin_memcmp(field_str, SELVA_EDGE_META_FIELD, sizeof(SELVA_EDGE_META_FIELD) - 1) &&
           (field_len == sizeof(SELVA_EDGE_META_FIELD) - 1 ||
            (field_len >= sizeof(SELVA_EDGE_META_FIELD) && field_str[sizeof(SELVA_EDGE_META_FIELD) - 1] == '.'));
}

/**
 * Get the edge metadata key from a field name.
 * Strip SELVA_EDGE_META_FIELD from a field name that was already detected with Selva_IsEdgeMetaField().
 */
static inline const char *Selva_GetEdgeMetaKey(const char *field_str, size_t field_len, size_t *meta_key_len_out)
{
    const char *meta_key_str = __builtin_memchr(field_str, '.', field_len);
    size_t meta_key_len = 0;

    if (meta_key_str) {
        meta_key_str++;
        meta_key_len = (field_str + field_len) - meta_key_str;
        if (meta_key_len == 0) {
            meta_key_str = NULL;
        }
    }

    *meta_key_len_out = meta_key_len;
    return meta_key_str;
}

#endif /* _SELVA_DB_ */
