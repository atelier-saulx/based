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

RB_HEAD(SelvaNodeIndex, SelvaNode);

enum SelvaFieldType {
    SELVA_FIELD_TYPE_NULL = 0,
    SELVA_FIELD_TYPE_TIMESTAMP = 1,
    SELVA_FIELD_TYPE_CREATED = 2,
    SELVA_FIELD_TYPE_UPDATED = 3,
    SELVA_FIELD_TYPE_NUMBER = 4,
    SELVA_FIELD_TYPE_INTEGER = 5,
    SELVA_FIELD_TYPE_BOOLEAN = 6,
    SELVA_FIELD_TYPE_REFERENCE = 7,
    SELVA_FIELD_TYPE_ENUM = 8,
    SELVA_FIELD_TYPE_STRING = 9,
    SELVA_FIELD_TYPE_REFERENCES = 10,
};

typedef int8_t field_t;
typedef uint64_t node_id_t;

struct EdgeFieldConstraint {
    enum EdgeFieldConstraintFlag {
        /**
         * Single reference edge.
         */
        EDGE_FIELD_CONSTRAINT_FLAG_SINGLE_REF       = 0x01,
        /**
         * Bidirectional reference.
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
    uint16_t nr_emb_fields;
    uint16_t nr_dyn_fields;
    uint16_t nr_fields; /* !< nr_emb_fields + nr_dyn_fields. */
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

/**
 * A struct for edge fields.
 * This struct contains the actual arcs pointing directly to other nodes in the
 * hierarchy.
 */
struct EdgeField {
    struct SVector arcs; /*!< Pointers to hierarchy nodes. */
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

/*
 * Hierarchy node metadata structure for storing edges and references to the
 * origin EdgeFields.
 */
struct EdgeFieldContainer {
    /**
     * Custom edge fields.
     *
     * A.field -> B
     * {
     *   custom.field: <struct EdgeField>
     * }
     */
    struct SelvaObject *edges;

    /**
     * Custom edge field origin references.
     * This object contains pointers to each field pointing to this node. As
     * it's organized per nodeId the size of the object tells how many nodes
     * are pointing to this node via edge fields.
     *
     * A.field <- B
     * {
     *   nodeId1: [     // The node pointing to this node
     *     fieldPtr1,   // A pointer to the edgeField pointing to this node
     *     fieldPtr2,
     *   ],
     * }
     */
    struct SelvaObject *origins;
};

/**
 * Selva node.
 */
struct SelvaNode {
    node_id_t node_id;
    RB_ENTRY(SelvaNode) _index_entry;
    struct trx_label trx_label;
#define SELVA_HIERARCHY_EXPIRE_EPOCH 1704067200000
    /**
     * Expiration timestamp for this node.
     * 0 = never expires
     * max_life = <epoch year>+(2^<bits>)/60/60/24/365
     */
    uint32_t expire;
    uint16_t ns_index; /*!< Index to SelvDb.type[] to get the NodeSchema. */
    struct EdgeFieldContainer edge_fields;
    char *dyn_fields;
    char emb_fields[]; /*!< This is counted by nr_emb_fields in SelvaNodeSchema. */
};

/**
 * Database instance.
 */
struct SelvaDb {
    /**
     * Global transaction state.
     */
    struct trx_state trx_state;

    size_t nr_types;
    struct {
        struct SelvaNodeSchema *ns;
        struct SelvaNodeIndex index_head;
        struct {
            STATIC_SELVA_OBJECT(_obj_data);
        } aliases;
        struct mempool nodepool;
    } *type __counted_by(nr_types);

    /**
     * Expiring nodes.
     */
    struct {
        SVector list; /*!< List of all expiring nodes. */
#define HIERARCHY_EXPIRING_NEVER UINT32_MAX
        int tim_id; /*!< 1 sec timer. */
        /**
         * Timestamp of the node expiring next.
         * Set to HIERARCHY_EXPIRING_NEVER if nothing is expiring.
         */
        uint32_t next;
    } expiring;
};

__attribute__((visibility("default"))) struct SelvaDb *selva_db_create(char *schema_buf, size_t schema_len);
__attribute__((visibility("default"))) void selva_db_delete(struct SelvaDb *db);
__attribute__((visibility("default"))) int selva_db_schema_update(struct SelvaDb *db, char *schema_buf, size_t schema_len);
