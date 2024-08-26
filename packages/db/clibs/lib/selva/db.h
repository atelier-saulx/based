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
#include "selva/types.h"

RB_HEAD(SelvaNodeIndex, SelvaNode);
RB_HEAD(SelvaAliasesByName, SelvaAlias);
RB_HEAD(SelvaAliasesByDest, SelvaAlias);

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

struct SelvaNodeSchema {
    field_t nr_fields; /*!< The total number of fields for this node type. */
    field_t nr_main_fields; /*!< Number of main fields that are always allocated. */
    field_t created_field;
    field_t updated_field;
    struct SelvaFieldSchema {
        field_t field;
        enum SelvaFieldType type;
        union {
            struct {
                size_t fixed_len; /*!< Greater than zero if the string has a fixed maximum length. */
            } string;
            struct EdgeFieldConstraint edge_constraint;
        };
    } field_schemas[] __counted_by(nr_fields);
};

/**
 * Selva node.
 */
struct SelvaNode {
    node_id_t node_id;
    node_type_t type;
    struct trx_label trx_label;
    RB_ENTRY(SelvaNode) _index_entry;
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
            enum SelvaFieldType type: 5;
            uint16_t off: 11; /*!< Offset in data in 8-byte blocks. */
        } __packed fields_map[] __counted_by(nr_fields);
    } fields;
};

#define SELVA_TO_EXPIRE(_ts_) ((uint32_t)((_ts_) - SELVA_HIERARCHY_EXPIRE_EPOCH))
#define SELVA_FROM_EXPIRE(_expire_) ((time_t)(_expire_) + SELVA_HIERARCHY_EXPIRE_EPOCH)
#define SELVA_IS_EXPIRED(_expire_, _now_) ((time_t)(_expire_) + SELVA_HIERARCHY_EXPIRE_EPOCH <= (time_t)(_now_))

struct SelvaAlias {
    RB_ENTRY(SelvaAlias) _entry;
    struct SelvaAlias *prev;
    struct SelvaAlias *next; /*!< Next alias for the same destination. */
    node_id_t dest;
    char name[];
};

/**
 * Entry for each node type supported by the schema.
 */
struct SelvaTypeEntry {
    node_type_t type;
    struct SelvaNodeIndex nodes; /*!< Index of nodes by this type. */
    struct SelvaAliases {
        struct SelvaAliasesByName alias_by_name;
        struct SelvaAliasesByDest alias_by_dest;
    } aliases;
    size_t nr_nodes; /*!< Number of nodes of this type. */
    size_t nr_aliases; /*!< Number of aliases by name. */
    struct mempool nodepool; /* Pool for struct SelvaNode of this type. */
    struct {
        void *buf;
        size_t len;
        size_t main_data_size;
    } field_map_template;
    const char *schema_buf;
    size_t schema_len;
    struct SelvaNodeSchema ns; /*!< Schema for this node type. Must be last. */
} __attribute__((aligned(65536)));

/**
 * Database instance.
 */
struct SelvaDb {
    /**
     * Global transaction state.
     */
    struct trx_state trx_state;

    SVector type_list;
    struct schemabuf_parser_ctx *schemabuf_ctx;

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

static inline void *SelvaTypeEntry2vecptr(struct SelvaTypeEntry *type)
{
#if 0
    assert(((uintptr_t)type & 0xFFFF) == 0);
#endif
    return (void *)((uintptr_t)type | type->type);
}

static inline struct SelvaTypeEntry *vecptr2SelvaTypeEntry(void *p)
{
    struct SelvaTypeEntry *te = (struct SelvaTypeEntry *)((uintptr_t)p & ~0xFFFF);
    __builtin_prefetch(te);
    return te;
}

RB_PROTOTYPE(SelvaNodeIndex, SelvaNode, _index_entry, SelvaNode_Compare)
RB_PROTOTYPE(SelvaAliasesByName, SelvaAlias, _entry, SelvaAlias_comp_name);
RB_PROTOTYPE(SelvaAliasesByDest, SelvaAlias, _entry, SelvaAlias_comp_dest);
int SelvaNode_Compare(const struct SelvaNode *a, const struct SelvaNode *b);
int SelvaAlias_comp_name(const struct SelvaAlias *a, const struct SelvaAlias *b);
int SelvaAlias_comp_dest(const struct SelvaAlias *a, const struct SelvaAlias *b);

#include "selva/db.h"
