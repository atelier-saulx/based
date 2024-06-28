/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <sys/types.h>
#include <stddef.h>
#include <stdint.h>
#include "tree.h"
#include "util/mempool.h"
#include "util/svector.h"
#include "util/trx.h"
#include "selva_object.h"

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
} __packed;

struct SelvaObject;

typedef int8_t field_t;
typedef uint32_t node_id_t;
typedef uint32_t node_type_t;

RB_HEAD(SelvaNodeIndex, SelvaNode);
RB_HEAD(SelvaTypeIndex, SelvaTypeEntry);

struct SelvaNodeSchema {
    field_t nr_fields; /*!< The total number of fields for this node type. */
    field_t nr_main_fields; /*!< Number of main fields that are always allocated. */
    field_t created_field;
    field_t updated_field;
    struct SelvaFieldSchema {
        field_t field;
        enum SelvaFieldType type;
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
                 */
                EDGE_FIELD_CONSTRAINT_FLAG_ARRAY            = 0x40,
            } __packed flags;
            field_t inverse_field;
            node_type_t dst_node_type;
        } edge_constraint;
    } field_schemas[] __counted_by(nr_fields);
};

/**
 * Selva node.
 */
struct SelvaNode {
    node_id_t node_id;
    RB_ENTRY(SelvaNode) _index_entry;
    struct trx_label trx_label;
    node_type_t type;
#define SELVA_NODE_EXPIRE_EPOCH 1704067200000
    /**
     * Expiration timestamp for this node.
     * 0 = never expires
     * max_life = <epoch year>+(2^<bits>)/60/60/24/365
     */
    uint32_t expire;
    struct SelvaFields {
#define SELVA_FIELDS_DATA_ALIGN 8
        /**
         * Field data.
         * This pointer is tagged with PTAG.
         * - 1 = shared i.e. refcount == 1
         */
        void *data;
        struct {
            uint32_t data_len: 24;
            field_t nr_fields: 8;
        };
        alignas(uint16_t) struct SelvaFieldInfo {
            enum SelvaFieldType type: 4;
            uint16_t off: 12; /*!< Offset in data in 8-byte blocks. */
        } __packed fields_map[] __counted_by(nr_fields);
    } fields;
};

/**
 * Entry for each node type supported by the schema.
 */
struct SelvaTypeEntry {
    node_type_t type;
    struct SelvaNodeIndex nodes; /*!< Index of nodes by this type. */
    struct {
        STATIC_SELVA_OBJECT(_obj_data);
    } aliases;
    struct mempool nodepool; /* Pool for struct SelvaNode of this type. */
    RB_ENTRY(SelvaTypeEntry) _type_entry;
    struct {
        void *buf;
        size_t len;
        size_t main_data_size;
    } field_map_template;
    struct SelvaNodeSchema ns; /*!< Schema for this node type. Must be last. */
};

/**
 * Database instance.
 */
struct SelvaDb {
    /**
     * Global transaction state.
     */
    struct trx_state trx_state;

    struct SelvaTypeIndex types;

    /**
     * Expiring nodes.
     */
    struct {
        SVector list; /*!< List of all expiring nodes. */
#define SELVA_NODE_EXPIRE_NEVER UINT32_MAX
        int tim_id; /*!< 1 sec timer. */
        /**
         * Timestamp of the node expiring next.
         * Set to SELVA_NODE_EXPIRE_NEVER if nothing is expiring.
         */
        uint32_t next;
    } expiring;
};
