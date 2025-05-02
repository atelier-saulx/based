/*
 * Copyright (c) 2024-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <sys/types.h>
#include <stddef.h>
#include <stdint.h>
#include "tree.h"
#include "mempool.h"
#include "svector.h"
#include "trx.h"
#include "selva/types.h"
#include "selva/selva_hash128.h"
#include "expire.h"
#include "ref_save_map.h"

RB_HEAD(SelvaNodeIndex, SelvaNode);
RB_HEAD(SelvaTypeCursorById, SelvaTypeCursor);
RB_HEAD(SelvaTypeCursorsByNodeId, SelvaTypeCursors);
RB_HEAD(SelvaAliasesByName, SelvaAlias);
RB_HEAD(SelvaAliasesByDest, SelvaAlias);

/**
 * Selva node.
 */
struct SelvaNode {
    node_id_t node_id;
    node_type_t type;
    struct trx_label trx_label;
    RB_ENTRY(SelvaNode) _index_entry;
    struct SelvaFields {
#define SELVA_FIELDS_DATA_ALIGN 8
#define SELVA_FIELDS_OFF 3
        /**
         * Field data.
         * This pointer is tagged with PTAG.
         * - 1 = shared i.e. refcount == 1
         */
        void *data __pcounted_by(data_len);
        struct {
            uint32_t data_len: 24;
            field_t nr_fields: 8;
        };
        alignas(uint16_t) struct SelvaFieldInfo {
            uint16_t in_use: 1;
            uint16_t off: 15; /*!< Offset in data in 8-byte blocks. (shift by SELVA_FIELDS_OFF) */
        } __packed fields_map[] __counted_by(nr_fields);
    } fields;
};
static_assert(offsetof(struct SelvaNode, node_id) == 0);

struct SelvaAlias {
    RB_ENTRY(SelvaAlias) _entry1;
    RB_ENTRY(SelvaAlias) _entry2;
    struct SelvaAlias *prev;
    struct SelvaAlias *next; /*!< Next alias for the same destination. */
    node_id_t dest;
    uint32_t name_len;
    char name[] __counted_by(name_len);
};

struct SelvaTypeBlock {
    struct SelvaNodeIndex nodes; /*!< Index of nodes in this block. */
};

/**
 * Entry for each node type supported by the schema.
 */
struct SelvaTypeEntry {
    node_type_t type;

    /**
     * Node blocks in this type.
     */
    struct SelvaTypeBlocks {
        block_id_t block_capacity;
        block_id_t len;
        struct SelvaTypeBlock blocks[] __counted_by(len);
    } *blocks;
    struct SelvaAliases {
        field_t field; /*!< Alias field. */
        bool single; /*!< Only allow a single alias per node + field. */
        struct SelvaAliasesByName alias_by_name;
        struct SelvaAliasesByDest alias_by_dest;
        size_t nr_aliases; /*!< Number of aliases by name. */
    } *aliases __pcounted_by(ns.nr_aliases);
    size_t nr_nodes; /*!< Number of nodes of this type. */
    struct mempool nodepool; /*!< Pool for struct SelvaNode of this type. */

    /**
     * Max node inserted so far.
     * Initially NULL but also NULLed if the node is deleted.
     * This is used to optimize new insertions because it's possible to use
     * RB_INSERT_NEXT() almost always as node_id normally grows monotonically.
     */
    struct SelvaNode *max_node;

    struct {
        struct ida *ida; /*! Id allocator for cursors. */
        struct SelvaTypeCursorById by_cursor_id; /*!< Cursors indexed by cursor_id. */
        struct SelvaTypeCursorsByNodeId by_node_id; /*!< Lists of cursors indexed by node_id. i.e. find all cursors pointing to a certain node. */
        size_t nr_cursors; /*!< Total count of active cursors allocated. */
    } cursors;

    /**
     * Copy of the original selvaBuffer tha was used to initialize this type.
     * Alloc & free with selva_jemalloc.
     */
    char *schema_buf __pcounted_by(schema_len);
    size_t schema_len;

    struct SelvaNodeSchema ns; /*!< Schema for this node type. Must be last. */
} __attribute__((aligned(65536)));

/**
 * Node expire token.
 */
struct SelvaDbExpireToken {
    struct SelvaExpireToken token;
    struct SelvaDb *db;
    node_id_t node_id;
    node_type_t type;
};

/**
 * Database instance.
 */
struct SelvaDb {
    /**
     * Global transaction state.
     */
    struct trx_state trx_state;

    SVector type_list;

    /**
     * Schema related items.
     */
    struct {
        struct ref_save_map ref_save_map;
    } schema;

    /**
     * Expiring nodes.
     */
    struct SelvaExpire expiring;
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

RB_PROTOTYPE(SelvaNodeIndex, SelvaNode, _index_entry, SelvaNode_cmp)
RB_PROTOTYPE(SelvaAliasesByName, SelvaAlias, _entry1, SelvaAlias_cmp_name);
RB_PROTOTYPE(SelvaAliasesByDest, SelvaAlias, _entry2, SelvaAlias_cmp_dest);
int SelvaNode_cmp(const struct SelvaNode *a, const struct SelvaNode *b);
int SelvaAlias_cmp_name(const struct SelvaAlias *a, const struct SelvaAlias *b);
int SelvaAlias_cmp_dest(const struct SelvaAlias *a, const struct SelvaAlias *b);

void selva_init_aliases(struct SelvaTypeEntry *type);

/**
 * Free type->aliases.
 * All the aliases must be freed before calling this function.
 */
void selva_destroy_aliases(struct SelvaTypeEntry *type);

/**
 * Set new alias.
 * `new_alias` must be allocated with selva_jemalloc.
 */
node_id_t selva_set_alias_p(struct SelvaAliases *aliases, struct SelvaAlias *new_alias);

#include "selva/db.h"
