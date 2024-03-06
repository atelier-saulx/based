/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef SELVA_MODIFY_H
#define SELVA_MODIFY_H

#include "selva_object.h"

struct SelvaHierarchy;
struct SelvaObject;
struct finalizer;
struct selva_server_response_out;
struct selva_string;

enum modify_flags {
    FLAG_NO_ROOT =  0x01, /*!< Don't set root as a parent. */
    FLAG_NO_MERGE = 0x02, /*!< Clear any existing fields. */
    FLAG_CREATE =   0x04, /*!< Only create a new node or fail. */
    FLAG_UPDATE =   0x08, /*!< Only update an existing node. */
};

enum SelvaModify_ArgType {
    SELVA_MODIFY_ARG_INVALID = '\0',
    /* Node object string field operations. */
    SELVA_MODIFY_ARG_DEFAULT_STRING = '2', /*!< Set a string value if unset. */
    SELVA_MODIFY_ARG_STRING = '0', /*!< Value is a string. */
    /* Node object numeric field operations. */
    SELVA_MODIFY_ARG_DEFAULT_LONGLONG = '8',
    SELVA_MODIFY_ARG_LONGLONG = '3', /*!< Value is a long long. */
    SELVA_MODIFY_ARG_DEFAULT_DOUBLE = '9',
    SELVA_MODIFY_ARG_DOUBLE = 'A', /*!< Value is a double. */
    SELVA_MODIFY_ARG_OP_INCREMENT = '4', /*!< Increment a long long value. */
    SELVA_MODIFY_ARG_OP_INCREMENT_DOUBLE = 'B', /*!< Increment a double value. */
    /* Node object set field operations. */
    SELVA_MODIFY_ARG_OP_SET = '5', /*!< Value is a struct SelvaModify_OpSet. */
    SELVA_MODIFY_ARG_OP_ORD_SET = 'J', /*!<  Value is a struct SelvaModify_OpOrdSet. */
    /* Node object array field operations. */
    SELVA_MODIFY_ARG_OP_ARRAY_PUSH = 'D', /*!< Set a new empty SelvaObject at the end of an array */
    SELVA_MODIFY_ARG_OP_ARRAY_INSERT = 'E', /*!< Set a new empty SelvaObject at the start of an array */
    SELVA_MODIFY_ARG_OP_ARRAY_REMOVE = 'F', /*!< Remove item in specified index from array */
    SELVA_MODIFY_ARG_OP_ARRAY_QUEUE_TRIM = 'H', /*!< Remove items from the end of the array to match given length */
    /* HLL operations. */
    SELVA_MODIFY_ARG_OP_HLL = 'I',
    /* Node object operations. */
    SELVA_MODIFY_ARG_OP_DEL = '7', /*!< Delete field; value is a modifier. */
    SELVA_MODIFY_ARG_OP_OBJ_META = 'C', /*!< Set object user metadata. */
    /* Edge metadata ops. */
    SELVA_MODIFY_ARG_OP_EDGE_META = 'G', /*!< Modify edge field metadata. */
    /* Other ops. */
    SELVA_MODIFY_ARG_STRING_ARRAY = '6', /*!< Array of C-strings. */
    /* Deprecated values */
    SELVA_MODIFY_ARG_RESERVED_0 __attribute__((unavailable)) = '1',
};

struct SelvaModify_OpIncrement {
    int64_t $default;
    int64_t $increment;
};

struct SelvaModify_OpIncrementDouble {
    double $default;
    double $increment;
};

/**
 * Set operation value type.
 */
enum SelvaModify_OpSetType {
    SELVA_MODIFY_OP_SET_TYPE_CHAR = 0,
    SELVA_MODIFY_OP_SET_TYPE_REFERENCE = 1, /*!< Items are of size SELVA_NODE_ID_SIZE. */
    SELVA_MODIFY_OP_SET_TYPE_DOUBLE = 2,
    SELVA_MODIFY_OP_SET_TYPE_LONG_LONG = 3,
} __packed;

/**
 * Set operations.
 */
struct SelvaModify_OpSet {
    /**
     * Set type.
     * One of SELVA_MODIFY_OP_SET_TYPE_xxx.
     */
    enum SelvaModify_OpSetType op_set_type;
    int8_t delete_all; /*!< Delete all intems from the set. */
    uint16_t edge_constraint_id; /*!< Edge field constraint id when modifying an edge field. */

    /**
     * Add these elements tot the set.
     */
    const char *$add_str;
    size_t $add_len;

    /**
     * Delete these elements from the set.
     */
    const char *$delete_str;
    size_t $delete_len;

    /**
     * Replace the current set with these elements.
     * If the edgeField has the `EDGE_FIELD_CONSTRAINT_FLAG_ARRAY` flag set,
     * it's advisable to also use `delete_all` in this op to achieve the
     * order given in this list. The downside is that all the current moetadata
     * will be lost. If the metada needs to be preserved then
     * `SelvaModify_OpOrdSet` should be used instead.
     */
    const char *$value_str;
    size_t $value_len;
};

/**
 * Ordered set operations.
 */
struct SelvaModify_OpOrdSet {
    /**
     * Set type.
     * Currently only SELVA_MODIFY_OP_SET_TYPE_REFERENCE is supported and only
     * edge fields can be modified.
     * The array field type and array operations shall be used for other ordered
     * sets.
     */
    enum SelvaModify_OpSetType op_set_type;
    enum SelvaModify_OpOrdSetMode {
        SelvaModify_OpOrdSet_Insert = 0,
        SelvaModify_OpOrdSet_Assign = 1,
        SelvaModify_OpOrdSet_Delete = 2,
        SelvaModify_OpOrdSet_Move = 3,
    } __packed mode;
    uint16_t edge_constraint_id;

    /**
     * Index.
     * Must be less than or equal to the size of the current set.
     * Can be negative for counting from the last item.
     * Note that `[idx]` can't be used to modify sortable references (array EdgeFields).
     */
    ssize_t index;

    /**
     * Insert these elements to the ordered set starting from index.
     *
     * **SelvaModify_OpOrdSet_Insert**
     * List of nodes to be inserted starting from `index`. If the EdgeField
     * doesn't exist, it will be created.
     *
     * **SelvaModify_OpOrdSet_Assign**
     *
     * List of nodes to be replaced starting from `index`.
     * If the edgeField doesn't exist yet then `index` must be set 0.
     *
     * **SelvaModify_OpOrdSet_Delete**
     * List of nodes to be deleted starting from `index`. The nodes must exist
     * on the edgeField in the exact order starting from `index`.
     *
     * **SelvaModify_OpOrdSet_Move**
     * Move listed nodes to `index`. The nodes must exist but they don't need to
     * be consecutive. The move will happen in reverse order.
     * E.g. `[1, 2, 3]` will be inserted as `[3, 2, 1]`.
     */
    const char *$value_str;
    size_t $value_len;
};


struct SelvaModify_OpEdgeMeta {
    /**
     * Edge field metadata op code.
     */
    enum SelvaModify_OpEdgeMetaCode {
        SELVA_MODIFY_OP_EDGE_META_DEL = 0,
        SELVA_MODIFY_OP_EDGE_META_DEFAULT_STRING = 1,
        SELVA_MODIFY_OP_EDGE_META_STRING = 2,
        SELVA_MODIFY_OP_EDGE_META_DEFAULT_LONGLONG = 3,
        SELVA_MODIFY_OP_EDGE_META_LONGLONG = 4,
        SELVA_MODIFY_OP_EDGE_META_DEFAULT_DOUBLE = 5,
        SELVA_MODIFY_OP_EDGE_META_DOUBLE = 6,
    } __packed op_code;
    int8_t delete_all; /*!< Delete all metadata from this edge field. */

    char dst_node_id[SELVA_NODE_ID_SIZE];

    const char *meta_field_name_str;
    size_t meta_field_name_len;

    const char *meta_field_value_str;
    size_t meta_field_value_len;
};

struct SelvaModify_OpHll {
    uint64_t _spare; /*!< For future extensions. */

    const char *$add_str;
    size_t $add_len;
};

/**
 * Modify op arg handler status.
 */
enum selva_op_repl_state {
    SELVA_OP_REPL_STATE_UNCHANGED,  /*!< No changes, do not replicate, reply with OK or ERR. */
    SELVA_OP_REPL_STATE_UPDATED,    /*!< Value changed, replicate, reply with UPDATED */
    SELVA_OP_REPL_STATE_REPLICATE,  /*!< Value might have changed, replicate, reply with OK */
};

struct SelvaModify_OpSet *SelvaModify_OpSet_fixup(
        struct finalizer *fin,
        const struct selva_string *data);
struct SelvaModify_OpOrdSet *SelvaModify_OpOrdSet_fixup(
        struct finalizer *fin,
        const struct selva_string *data);

/**
 * Modify a set.
 * @returns >= 0 number of changes; or < 0 Selva error
 */
int SelvaModify_ModifySet(
    struct SelvaHierarchy *hierarchy,
    const Selva_NodeId node_id,
    struct SelvaHierarchyNode *node,
    struct SelvaObject *obj,
    const struct selva_string *field,
    struct SelvaModify_OpSet *setOpts,
    enum modify_flags modify_flags
);

int SelvaModify_ModifyDel(
    struct SelvaHierarchy *hierarchy,
    struct SelvaHierarchyNode *node,
    struct SelvaObject *obj,
    const struct selva_string *field
);

int SelvaModify_field_prot_check(const char *field_str, size_t field_len, char type_code);

#endif /* SELVA_MODIFY_H */
