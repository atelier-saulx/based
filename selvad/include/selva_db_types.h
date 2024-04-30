/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef _SELVA_DB_TYPES_
#define _SELVA_DB_TYPES_

/**
 * NodeId size including the type prefix.
 */
#define SELVA_NODE_ID_SIZE      8ul /* Must be at least sizeof(void *) */
/**
 * Scan nodeId with selva_proto_scanf().
 */
#define SELVA_SCA_NODE_ID       "8s"
/**
 * NodeId type prefix size.
 */
#define SELVA_NODE_TYPE_SIZE    2
/**
 * Scan nodeType with selva_proto_scanf().
 */
#define SELVA_SCA_NODE_TYPE     "2s"
/**
 * An empty nodeId.
 */
#define EMPTY_NODE_ID           "\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0"
#define SELVA_NULL_TYPE         "\0"

#define SELVA_SHORT_FIELD_NAME_LEN 8

/**
 * Reserved field names.
 * @addtogroup selva_reserved_field_names
 * @{
 */
#define SELVA_ID_FIELD          "id"
#define SELVA_ALIASES_FIELD     "aliases"
#define SELVA_CREATED_AT_FIELD  "created"
#define SELVA_UPDATED_AT_FIELD  "updated"
/**
 * Pseudo field name for retrieving edge metadata.
 */
#define SELVA_EDGE_META_FIELD   "$edgeMeta"
#define SELVA_DEPTH_FIELD       "$depth"
/**
 * @}
 */

#define SELVA_IS_ID_FIELD(_s, _len) \
    ((_len) == (sizeof(SELVA_ID_FIELD) - 1) && !__builtin_memcmp((_s), SELVA_ID_FIELD, sizeof(SELVA_ID_FIELD) - 1))

#define SELVA_IS_ALIASES_FIELD(_s, _len) \
    ((_len) == (sizeof(SELVA_ALIASES_FIELD) - 1) && !__builtin_memcmp((_s), SELVA_ALIASES_FIELD, sizeof(SELVA_ALIASES_FIELD) - 1))

#define SELVA_IS_CREATED_AT_FIELD(_s, _len) \
    ((_len) == (sizeof(SELVA_CREATED_AT_FIELD) - 1) && !__builtin_memcmp((_s), SELVA_CREATED_AT_FIELD, sizeof(SELVA_CREATED_AT_FIELD) - 1))

#define SELVA_IS_UPDATED_AT_FIELD(_s, _len) \
    ((_len) == (sizeof(SELVA_UPDATED_AT_FIELD) - 1) && !__builtin_memcmp((_s), SELVA_UPDATED_AT_FIELD, sizeof(SELVA_UPDATED_AT_FIELD) - 1))

struct selva_string;

/**
 * Type for Selva NodeId.
 */
typedef char Selva_NodeId[SELVA_NODE_ID_SIZE];

/**
 * Type of Selva NodeType.
 */
typedef char Selva_NodeType[SELVA_NODE_TYPE_SIZE];

/**
 * Type for Selva subscription IDs.
 */
typedef int64_t Selva_SubscriptionId;

/**
 * Type for Selva subscription marker id.
 */
typedef int64_t Selva_SubscriptionMarkerId;

#define PRIsubId PRId64
#define PRImrkId PRId64

#endif /* _SELVA_DB_TYPES_ */
