/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef _SELVA_DB_
#define _SELVA_DB_

/**
 * NodeId size including the type prefix.
 */
#define SELVA_NODE_ID_SIZE      16ul /* Must be at least sizeof(void *) */
/**
 * Scan nodeId with selva_proto_scanf().
 */
#define SELVA_SCA_NODE_ID       "16s"
/**
 * NodeId type prefix size.
 */
#define SELVA_NODE_TYPE_SIZE    2
/**
 * Scan nodeType with selva_proto_scanf().
 */
#define SELVA_SCA_NODE_TYPE     "2s"
/**
 * NodeId of the root node.
 */
#define ROOT_NODE_ID            "root\0\0\0\0\0\0\0\0\0\0\0\0"
/**
 * An empty nodeId.
 */
#define EMPTY_NODE_ID           "\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0\0"

/**
 * Reserved field names.
 * @addtogroup selva_reserved_field_names
 * @{
 */
#define SELVA_ID_FIELD          "id"
#define SELVA_TYPE_FIELD        "type"
#define SELVA_ALIASES_FIELD     "aliases"
#define SELVA_PARENTS_FIELD     "parents"
#define SELVA_CHILDREN_FIELD    "children"
#define SELVA_ANCESTORS_FIELD   "ancestors"
#define SELVA_DESCENDANTS_FIELD "descendants"
#define SELVA_CREATED_AT_FIELD  "createdAt"
#define SELVA_UPDATED_AT_FIELD  "updatedAt"
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

#define SELVA_IS_TYPE_FIELD(_s, _len) \
    ((_len) == (sizeof(SELVA_TYPE_FIELD) - 1) && !__builtin_memcmp((_s), SELVA_TYPE_FIELD, sizeof(SELVA_TYPE_FIELD) - 1))

#define SELVA_IS_ALIASES_FIELD(_s, _len) \
    ((_len) == (sizeof(SELVA_ALIASES_FIELD) - 1) && !__builtin_memcmp((_s), SELVA_ALIASES_FIELD, sizeof(SELVA_ALIASES_FIELD) - 1))

#define SELVA_IS_PARENTS_FIELD(_s, _len) \
    ((_len) == (sizeof(SELVA_PARENTS_FIELD) - 1) && !__builtin_memcmp((_s), SELVA_PARENTS_FIELD, sizeof(SELVA_PARENTS_FIELD) - 1))

#define SELVA_IS_CHILDREN_FIELD(_s, _len) \
    ((_len) == (sizeof(SELVA_CHILDREN_FIELD) - 1) && !__builtin_memcmp((_s), SELVA_CHILDREN_FIELD, sizeof(SELVA_CHILDREN_FIELD) - 1))

#define SELVA_IS_ANCESTORS_FIELD(_s, _len) \
    ((_len) == (sizeof(SELVA_ANCESTORS_FIELD) - 1) && !__builtin_memcmp((_s), SELVA_ANCESTORS_FIELD, sizeof(SELVA_ANCESTORS_FIELD) - 1))

#define SELVA_IS_DESCENDANTS_FIELD(_s, _len) \
    ((_len) == (sizeof(SELVA_DESCENDANTS_FIELD) - 1) && !__builtin_memcmp((_s), SELVA_DESCENDANTS_FIELD, sizeof(SELVA_DESCENDANTS_FIELD) - 1))

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

#define SELVA_SUB_ID_STR_MAXLEN 20

#endif /* _SELVA_DB_ */
