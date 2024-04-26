/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef SELVA_MODIFY_H
#define SELVA_MODIFY_H

#include <stdint.h>
#include "selva_object.h"

struct SelvaHierarchy;
struct SelvaObject;
struct finalizer;
struct selva_server_response_out;
struct selva_string;

struct modify_header {
    Selva_NodeId node_id;
    enum modify_flags {
        FLAG_NO_MERGE = 0x01, /*!< Clear any existing fields. */
        FLAG_CREATE =   0x02, /*!< Only create a new node or fail. */
        FLAG_UPDATE =   0x04, /*!< Only update an existing node. */
        FLAG_ALIAS =    0x08, /*!< An alias query follows this header. */
    } flags;
    uint32_t nr_changes;
};

struct SelvaModifyFieldOp {
    enum SelvaModifyOpCode {
        SELVA_MODIFY_OP_DEL = 0, /*!< Delete field. */
        SELVA_MODIFY_OP_STRING = 1,
        SELVA_MODIFY_OP_STRING_DEFAULT = 2,
        SELVA_MODIFY_OP_LONGLONG = 3,
        SELVA_MODIFY_OP_LONGLONG_DEFAULT = 4,
        SELVA_MODIFY_OP_LONGLONG_INCREMENT = 5,
        SELVA_MODIFY_OP_DOUBLE = 6,
        SELVA_MODIFY_OP_DOUBLE_DEFAULT = 7,
        SELVA_MODIFY_OP_DOUBLE_INCREMENT = 8,
        SELVA_MODIFY_OP_SET_VALUE = 9,
        SELVA_MODIFY_OP_SET_INSERT = 10,
        SELVA_MODIFY_OP_SET_REMOVE = 11,
        SELVA_MODIFY_OP_SET_ASSIGN = 12,
        SELVA_MODIFY_OP_SET_MOVE = 13,
        SELVA_MODIFY_OP_EDGE_META = 14, /*!< Value is `struct SelvaModifyEdgeMeta`. */
    } __packed op;
    enum {
        SELVA_MODIFY_OP_FLAGS_VALUE_DEFLATED = 0x01,
    } __packed flags;
    char lang[2];
    uint32_t index;
    char field_name[SELVA_SHORT_FIELD_NAME_LEN];
    /**
     * Field value.
     * Expected format depends on the op code.
     */
    const char *value_str;
    size_t value_len;
};

/**
 * SELVA_MODIFY_OP_LONGLONG_INCREMENT.
 */
struct SelvaModifyLongLongIncrement {
    long long default_value;
    long long increment;
};

/**
 * SELVA_MODIFY_OP_DOUBLE_INCREMENT.
 */
struct SelvaModifyDoubleIncrement {
    double default_value;
    long long increment;
};

/**
 * Set operations.
 */
struct SelvaModifySet {
    enum SelvaModifySetType {
        SELVA_MODIFY_SET_TYPE_CHAR = 0,
        SELVA_MODIFY_SET_TYPE_REFERENCE = 1, /*!< Items are of size SELVA_NODE_ID_SIZE. */
        SELVA_MODIFY_SET_TYPE_DOUBLE = 2,
        SELVA_MODIFY_SET_TYPE_LONG_LONG = 3,
    } __packed type;

    /**
     * Index for ordered set.
     * Must be less than or equal to the size of the current set.
     * Can be negative for counting from the last item.
     */
    ssize_t index;

    /**
     * Insert these elements to the ordered set starting from index.
     *
     * **Insert**
     * List of nodes to be inserted starting from `index`. If the EdgeField
     * doesn't exist, it will be created.
     *
     * **Assign**
     *
     * List of nodes to be replaced starting from `index`.
     * If the edgeField doesn't exist yet then `index` must be set 0.
     *
     * **Delete**
     * List of nodes to be deleted starting from `index`. The nodes must exist
     * on the edgeField in the exact order starting from `index`.
     *
     * **Move**
     * Move listed nodes to `index`. The nodes must exist but they don't need to
     * be consecutive. The move will happen in reverse order.
     * E.g. `[1, 2, 3]` will be inserted as `[3, 2, 1]`.
     */
    const char *value_str;
    size_t value_len;
};

/**
 * SELVA_MODIFY_OP_EDGE_META.
 */
struct SelvaModifyEdgeMeta {
    enum SelvaModifyOpCode op;
    int8_t delete_all; /*!< Delete all metadata from this edge field. */

    char dst_node_id[SELVA_NODE_ID_SIZE];

    const char *meta_field_name_str;
    size_t meta_field_name_len;

    const char *meta_field_value_str;
    size_t meta_field_value_len;
};

#endif /* SELVA_MODIFY_H */
