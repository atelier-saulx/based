/*
 * Copyright (c) 2024-2026 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <sys/types.h>
#include <stddef.h>
#include <stdint.h>
#include "tree.h"
#include "mempool.h"
#include "selva/types.h"
#include "selva/selva_hash128.h"
#include "expire.h"

struct selva_string;

RB_HEAD(SelvaTypeEntryIndex, SelvaTypeEntry);
RB_HEAD(SelvaNodeIndex, SelvaNode);
RB_HEAD(SelvaAliasesByName, SelvaAlias);
RB_HEAD(SelvaAliasesByDest, SelvaAlias);

/**
 * Selva node.
 */
struct SelvaNode {
    node_id_t node_id;
    uint16_t _reserved; /*!< Reserved for id extension. */
    node_type_t type;
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
    node_id_t nr_nodes_in_block; /*!< Number of nodes in this block. */
    union {
#if 0
        /* This doesn't work in clang */
        atomic_uint_least32_t
#endif
        _Atomic uint_least32_t atomic;
        enum SelvaTypeBlockStatus e;
    } status;
};

/**
 * Entry for each node type supported by the schema.
 */
struct SelvaTypeEntry {
    node_type_t type;

    RB_ENTRY(SelvaTypeEntry) _entry;

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
     * Columnar fields.
     */
    struct {
        struct SelvaColvec *colvec __pcounted_by(ns.nr_colvecs);
    } col_fields;

    /**
     * Max node inserted so far.
     * Initially NULL but also NULLed if the node is deleted.
     * This is used to optimize new insertions because it's possible to use
     * RB_INSERT_NEXT() almost always as node_id normally grows monotonically.
     */
    struct SelvaNode *max_node;

    /**
     * Copy of the original selvaBuffer tha was used to initialize this type.
     * Alloc & free with selva_jemalloc.
     */
    uint8_t *schema_buf __pcounted_by(schema_len);
    size_t schema_len;

    struct SelvaNodeSchema ns; /*!< Schema for this node type. Must be last. */
};

struct SelvaTypeEntryFind {
    node_type_t type;
};

static_assert(offsetof(struct SelvaTypeEntryFind, type) == offsetof(struct SelvaTypeEntry, type));
static_assert(sizeof_field(struct SelvaTypeEntryFind, type) == sizeof_field(struct SelvaTypeEntry, type));

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
     * SelvaTypeEntries.
     */
    struct {
        struct SelvaTypeEntryIndex index;
        struct mempool pool; /*!< types area allocated from here. */
        size_t count; /*!< Total count of types. */
    } types;

    /**
     * Expiring nodes.
     */
    struct SelvaExpire expiring;

    /**
     * Backup directory file descriptor.
     */
    int dirfd;

    uint32_t sdb_version; /*!< Current SDB version. Set on common load and save. 0 if not saved/loaded. */
};

RB_PROTOTYPE(SelvaTypeEntryIndex, SelvaTypeEntry, _entry, SelvaTypeEntry_cmp)
RB_PROTOTYPE(SelvaNodeIndex, SelvaNode, _index_entry, SelvaNode_cmp)
RB_PROTOTYPE(SelvaAliasesByName, SelvaAlias, _entry1, SelvaAlias_cmp_name)
RB_PROTOTYPE(SelvaAliasesByDest, SelvaAlias, _entry2, SelvaAlias_cmp_dest)
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

struct SelvaTypeBlock *selva_get_block(struct SelvaTypeBlocks *blocks, node_id_t node_id) __attribute__((returns_nonnull));
void selva_node_block_hash2(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaTypeBlock *block, selva_hash128_t *hash_out) __attribute__((nonnull));

#include "selva/db.h"
