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
    SELVA_FIELD_TYPE_BOOLEAN = 6,
    SELVA_FIELD_TYPE_ENUM = 7,
    SELVA_FIELD_TYPE_STRING = 8,
    SELVA_FIELD_TYPE_TEXT = 9,
    SELVA_FIELD_TYPE_REFERENCE = 10,
    SELVA_FIELD_TYPE_REFERENCES = 11,
} __packed;

struct SelvaObject;

typedef int8_t field_t;
typedef uint64_t node_id_t;
typedef uint32_t node_type_t;

RB_HEAD(SelvaNodeIndex, SelvaNode);
RB_HEAD(SelvaTypeIndex, SelvaTypeEntry);

struct EdgeFieldConstraint {
    enum EdgeFieldConstraintFlag {
        /**
         * Single reference edge.
         */
        EDGE_FIELD_CONSTRAINT_FLAG_SINGLE_REF       = 0x01,
        /**
         * Bidirectional reference.
         * TODO Is this needed if edges are always bidir.
         */
        EDGE_FIELD_CONSTRAINT_FLAG_BIDIRECTIONAL    = 0x02,
        /**
         * Edge field array mode.
         * By default an edge field acts like a set. This flag makes the field work like an array.
         */
        EDGE_FIELD_CONSTRAINT_FLAG_ARRAY            = 0x40,
    } __packed flags;
    field_t inverse_field;
    struct SelvaNodeSchema *src_node;
    struct SelvaNodeSchema *dst_node;
} edge_constraint;

struct SelvaNodeSchema {
    uint16_t nr_fields;
    field_t created_field;
    field_t updated_field;
    struct SelvaFieldSchema {
        field_t field_index;
        enum SelvaFieldType type;
        uint32_t offset;
        size_t size;
        struct EdgeFieldConstraint edge_constraint;
    } field_schemas[] __counted_by(nr_fields);
};

struct EdgeFieldSingle {
    struct SelvaNode *dst;
    struct SelvaObject *metadata;
};

/**
 * A struct for edge fields.
 * This struct contains the actual arcs pointing directly to other nodes in the
 * hierarchy.
 */
struct EdgeFieldMulti {
    struct SVector arcs; /*!< Pointers to nodes. */
    /**
     * Metadata organized by dst_node_id.
     * This object should not be accessed directly but by using functions
     * provided in this header:
     * - Edge_GetFieldEdgeMetadata()
     * - Edge_DeleteFieldMetadata()
     * Can be NULL.
     */
    struct SelvaObject *metadata;
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
        void *data;
        struct {
            uint32_t size: 24; /*!< Size of data. */
            field_t nr_fields: 8;
        };
        struct SelvaFieldInfo {
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
    struct SelvaNodeSchema *ns; /*!< Schema for this node type. */
    struct SelvaNodeIndex nodes; /*!< Index of nodes by this type. */
    struct {
        STATIC_SELVA_OBJECT(_obj_data);
    } aliases;
    struct mempool nodepool; /* Pool for struct SelvaNode of this type. */
    RB_ENTRY(SelvaTypeEntry) _type_entry;
};

/**
 * Database instance.
 */
struct SelvaDb {
    /**
     * Global transaction state.
     */
    struct trx_state trx_state;

    struct {
        struct SelvaTypeIndex index;
        struct mempool pool;
    } types;

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

__attribute__((visibility("default"))) struct SelvaDb *selva_db_create(void);
__attribute__((visibility("default"))) void selva_db_delete(struct SelvaDb *db);
__attribute__((visibility("default"))) int selva_db_schema_update(struct SelvaDb *db, char *schema_buf, size_t schema_len);
