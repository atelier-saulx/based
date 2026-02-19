/*
 * Copyright (c) 2024-2026 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#ifndef __zig
#include <stdatomic.h>
#endif
#include <assert.h>
#include <stddef.h>
#include <stdint.h>
#include <sys/types.h>
#include "selva/_export.h"
#include "selva/types.h"

/*
 * TODO Don't like this one but it compiles.
 * We should have something with selva_hash_state;
 */
struct XXH3_state_s;
struct selva_string;

struct selva_dump_common_data {
    /**
     * Schema ids.
     * Pointer to data returned here when loading; Data read from here when saving.
     */
    node_id_t *ids_data __pcounted_by(ids_len);
    size_t ids_len;

    /**
     * Info about all blocks related to this dump.
     * Only on load.
     */
    struct selva_dump_block {
        node_type_t type;
        block_id_t block;
    } *blocks __pcounted_by(blocks_len);
    size_t blocks_len;

    /**
     * Error log.
     * Can be nullptr. Also set errlog_size to 0.
     */
    char *errlog_buf __pcounted_by(errlog_size);
    size_t errlog_size;
};

/**
 * Create a new DB instance.
 */
SELVA_EXPORT
struct SelvaDb *selva_db_create(size_t len, uint8_t schema[len]);

/**
 * Destroy a DB instance.
 */
SELVA_EXPORT
void selva_db_destroy(struct SelvaDb *db) __attribute__((nonnull));

/**
 * Change backup directory.
 */
SELVA_EXPORT
int selva_db_chdir(struct SelvaDb *db, const char *pathname_str, size_t pathname_len) __attribute__((nonnull));

/**
 * Set a hook to the dirty marking system.
 * The hook function will be called every time a node is marked dirty.
 */
SELVA_EXPORT
void selva_db_set_dirty_hook(struct SelvaDb *db, selva_db_dirty_hook_t dirty_hook, void *ctx);

/**
 * Save the common/shared data of the database.
 */
SELVA_EXPORT
int selva_dump_save_common(struct SelvaDb *db, struct selva_dump_common_data *com) __attribute__((nonnull));

/**
 * Save a nodes block starting from start.
 */
SELVA_EXPORT
int selva_dump_save_block(struct SelvaDb *db, struct SelvaTypeEntry *te, block_id_t block_i) __attribute__((nonnull));

SELVA_EXPORT
int selva_dump_load_common(struct SelvaDb *db, struct selva_dump_common_data *com) __attribute__((nonnull));

SELVA_EXPORT
int selva_dump_load_block(struct SelvaDb *db, struct SelvaTypeEntry *te, block_id_t block_i, char *errlog_buf, size_t errlog_size) __attribute__((nonnull));

SELVA_EXPORT
inline node_type_t selva_get_max_type(const struct SelvaDb *db) [[reproducible]];

/**
 * Find a type by type id.
 */
SELVA_EXPORT
inline struct SelvaTypeEntry *selva_get_type_by_index(struct SelvaDb *db, node_type_t type) [[reproducible]];

/**
 * Get the type for node.
 */
SELVA_EXPORT
inline struct SelvaTypeEntry *selva_get_type_by_node(struct SelvaDb *db, struct SelvaNode *node) [[reproducible]];

SELVA_EXPORT
inline node_type_t selva_get_type(const struct SelvaTypeEntry *te) [[reproducible]];

SELVA_EXPORT
inline block_id_t selva_get_nr_blocks(const struct SelvaTypeEntry *te);

SELVA_EXPORT
inline block_id_t selva_get_block_capacity(const struct SelvaTypeEntry *te);

#define SELVA_NODE_ID2BLOCK_I3(block_capacity, node_id) \
    (((node_id - 1) - ((node_id - 1) % block_capacity)) / block_capacity)

static inline block_id_t selva_node_id2block_i3(block_id_t block_capacity, node_id_t node_id)
{
    assert(node_id > 0);
    return SELVA_NODE_ID2BLOCK_I3(block_capacity, node_id);
}

SELVA_EXPORT
inline block_id_t selva_node_id2block_i(const struct SelvaTypeBlocks *blocks, node_id_t node_id);

SELVA_EXPORT
inline block_id_t selva_node_id2block_i2(const struct SelvaTypeEntry *te, node_id_t node_id);

SELVA_EXPORT
inline node_id_t selva_block_i2start(const struct SelvaTypeEntry *te, block_id_t block_i);

SELVA_EXPORT
inline node_id_t selva_block_i2end(const struct SelvaTypeEntry *te, block_id_t block_i);

SELVA_EXPORT
inline void selva_foreach_block(
        struct SelvaDb *db,
        enum SelvaTypeBlockStatus or_mask,
        void (*cb)(void *ctx, struct SelvaDb *db, struct SelvaTypeEntry *te, block_id_t block, node_id_t start), void *ctx);

/**
 * \addtogroup block_status
 * @{
 */

SELVA_EXPORT
inline enum SelvaTypeBlockStatus selva_block_status_get(const struct SelvaTypeEntry *te, block_id_t block_i);

SELVA_EXPORT
inline void selva_block_status_replace(const struct SelvaTypeEntry *te, block_id_t block_i, enum SelvaTypeBlockStatus status);

/**
 * OR mask to the status.
 * @returns the previous status.
 */
SELVA_EXPORT
inline enum SelvaTypeBlockStatus selva_block_status_set(const struct SelvaTypeEntry *te, block_id_t block_i, enum SelvaTypeBlockStatus mask);

/**
 * Reset mask flags from the status.
 * @returns the previous status.
 */
SELVA_EXPORT
inline enum SelvaTypeBlockStatus selva_block_status_reset(const struct SelvaTypeEntry *te, block_id_t block_i, enum SelvaTypeBlockStatus mask);

SELVA_EXPORT
inline bool selva_block_status_eq(const struct SelvaTypeEntry *te, block_id_t block_i, enum SelvaTypeBlockStatus mask);

SELVA_EXPORT
size_t selva_get_type_status(const struct SelvaTypeEntry *te, size_t len, uint8_t packed_statuses[len]);

/**
 * @}
 */

/**
 * Get the node schema for type.
 */
SELVA_EXPORT
__attribute__((nonnull, pure))
inline const struct SelvaNodeSchema *selva_get_ns_by_te(const struct SelvaTypeEntry *te);

SELVA_EXPORT
inline const struct SelvaFieldSchema *get_fs_by_fields_schema_field(const struct SelvaFieldsSchema *fields_schema, field_t field);

/**
 * Get the field schema for field.
 */
SELVA_EXPORT
__attribute__((nonnull, pure))
inline const struct SelvaFieldSchema *selva_get_fs_by_te_field(const struct SelvaTypeEntry *te, field_t field);

/**
 * Get the field schema for field.
 */
SELVA_EXPORT
__attribute__((nonnull, pure))
inline const struct SelvaFieldSchema *selva_get_fs_by_ns_field(const struct SelvaNodeSchema *ns, field_t field);

/**
 * Get the field schema for field.
 */
SELVA_EXPORT
__attribute__((nonnull, pure))
inline const struct SelvaFieldSchema *selva_get_fs_by_node(struct SelvaDb *db, struct SelvaNode *node, field_t field);

SELVA_EXPORT
inline enum SelvaFieldType selva_get_fs_type(const struct SelvaFieldSchema *fs) [[reproducible]];

/**
 * Get the EdgeFieldConstraint from a ref field schema.
 * struct EdgeFieldConstraint *efc = selva_get_edge_field_constraint(src_fs);
 * struct SelvaTypeEntry *dst_type = selva_get_type_by_index(db, efc->dst_node_type);
 * struct SelvaFieldSchema *dst_fs = selva_get_fs_by_node(db, dst, efc->inverse_field);
 */
SELVA_EXPORT
__attribute__((returns_nonnull))
__attribute__((nonnull))
inline const struct EdgeFieldConstraint *selva_get_edge_field_constraint(const struct SelvaFieldSchema *fs);

SELVA_EXPORT
inline const struct SelvaFieldsSchema *selva_get_edge_field_fields_schema(struct SelvaDb *db, const struct EdgeFieldConstraint *efc);

/**
 * Strategy for adding new node expires.
 */
enum selva_expire_node_strategy {
    /**
     * Ignore any existing expire and just add a new one.
     */
    SELVA_EXPIRE_NODE_STRATEGY_IGNORE = 0,
    /**
     * Cancel adding an expire if one already exists.
     */
    SELVA_EXPIRE_NODE_STRATEGY_CANCEL = 1,
    /**
     * Cancel the previous expire before adding a new one.
     * TODO This will currently only cancel one previous hit.
     */
    SELVA_EXPIRE_NODE_STRATEGY_CANCEL_OLD = 2,
};

SELVA_EXPORT
void selva_expire_node(struct SelvaDb *db, node_type_t type, node_id_t node_id, int64_t ts, enum selva_expire_node_strategy stg);

SELVA_EXPORT
void selva_expire_node_cancel(struct SelvaDb *db, node_type_t type, node_id_t node_id);

SELVA_EXPORT
void selva_db_expire_tick(struct SelvaDb *db, int64_t now);

/**
 * Delete a node.
 */
SELVA_EXPORT
void selva_del_node(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node) __attribute__((nonnull(1, 2, 3)));

SELVA_EXPORT
void selva_flush_node(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node);

SELVA_EXPORT
void selva_mark_dirty(struct SelvaTypeEntry *te, node_id_t node_id);

SELVA_EXPORT
void selva_del_block(struct SelvaDb *db, struct SelvaTypeEntry *te, block_id_t block_i);

/**
 * Get a node by id.
 */
SELVA_EXPORT
struct SelvaNodeRes selva_find_node(struct SelvaTypeEntry *type, node_id_t node_id) __attribute__((nonnull));

/**
 * Find the first node greater than or equal to the provided id, or NULL.
 */
SELVA_EXPORT
struct SelvaNodeRes selva_nfind_node(struct SelvaTypeEntry *type, node_id_t node_id) __attribute__((nonnull));

/**
 * Get or create a node by id.
 */
SELVA_EXPORT
struct SelvaNodeRes selva_upsert_node(struct SelvaTypeEntry *type, node_id_t node_id) __attribute__((nonnull));

/**
 * **Example**
 * ```c
 * for (struct SelvaNode *np = selva_min_node(type); np; np = selva_next_node(type, np))
 * ```
 */
SELVA_EXPORT
struct SelvaNodeRes selva_min_node(struct SelvaTypeEntry *type) __attribute__((nonnull));

/**
 * **Example**
 * ```c
 * for (struct SelvaNode *np = selva_max_node(type); np; np = selva_prev_node(type, np))
 * ```
 */
SELVA_EXPORT
struct SelvaNode *selva_max_node(struct SelvaTypeEntry *type) __attribute__((nonnull));

/**
 * Get previous node with a lower node id.
 */
SELVA_EXPORT
struct SelvaNodeRes selva_prev_node(struct SelvaTypeEntry *type, struct SelvaNode *node) __attribute__((nonnull));

/**
 * Get next node with higher node id.
 */
SELVA_EXPORT
struct SelvaNodeRes selva_next_node(struct SelvaTypeEntry *type, struct SelvaNode *node) __attribute__((nonnull));

/**
 * Total count of nodes of type.
 */
SELVA_EXPORT
size_t selva_node_count(const struct SelvaTypeEntry *type) __attribute__((nonnull));

/**
 * Get the node id of of node.
 */
SELVA_EXPORT
__attribute__((nonnull, pure))
inline node_id_t selva_get_node_id(const struct SelvaNode *node);

/**
 * Get the type of of node.
 */
SELVA_EXPORT
__attribute__((nonnull, pure))
inline node_type_t selva_get_node_type(const struct SelvaNode *node);

/**
 * \addtogroup node_hash
 * @{
 */

/**
 * Calculate the node hash.
 * Update node hash by using a temp hash state allocated earlier.
 * @param tmp_hash_state is only used for computation and it's reset before use.
 */
SELVA_EXPORT
selva_hash128_t selva_node_hash_update(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node, struct XXH3_state_s *tmp_hash_state);

SELVA_EXPORT
selva_hash128_t selva_node_hash(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node);

SELVA_EXPORT
int selva_node_block_hash(struct SelvaDb *db, struct SelvaTypeEntry *type, node_id_t start, selva_hash128_t *hash_out) __attribute__((nonnull));

/**
 * @}
 */

/**
 * Get the number of aliases under given type.
 */
SELVA_EXPORT
size_t selva_alias_count(const struct SelvaAliases *aliases);

/**
 * Set new alias.
 * @param name is copied.
 * @returns the previous node_id the alias was pointing to; Otherwise 0.
 */
SELVA_EXPORT
node_id_t selva_set_alias(struct SelvaAliases *aliases, node_id_t dest, const char *name_str, size_t name_len);

/**
 * Delete alias by name.
 * @return the destination node_id the alias was pointing to; 0 if SELVA_ENOENT.
 */
SELVA_EXPORT
node_id_t selva_del_alias_by_name(struct SelvaAliases *aliases, const char *name_str, size_t name_len);

/**
 * Delete all aliases pointing to dest.
 */
SELVA_EXPORT
void selva_del_alias_by_dest(struct SelvaAliases *aliases, node_id_t dest);

/**
 * Get alias by name.
 */
SELVA_EXPORT
struct SelvaNodeRes selva_get_alias(struct SelvaTypeEntry *type, struct SelvaAliases *aliases, const char *name_str, size_t name_len);

/**
 * Get alias by destination id.
 */
SELVA_EXPORT
const struct SelvaAlias *selva_get_alias_by_dest(struct SelvaAliases *aliases, node_id_t dest);

/* TODO Is this needed as a separate func? */
SELVA_EXPORT
const char *selva_get_alias_name(const struct SelvaAlias *alias, size_t *len) __attribute__((nonnull, pure));

SELVA_EXPORT
struct SelvaAliases *selva_get_aliases(struct SelvaTypeEntry *type, field_t field);

/***
 * Remove all aliases to the given node_id.
 */
SELVA_EXPORT
void selva_remove_all_aliases(struct SelvaTypeEntry *type, node_id_t node_id);

/*
 * Inline functions that can be inlined only in C.
 */
#ifndef __zig
inline node_type_t selva_get_max_type(const struct SelvaDb *db)
{
    assert(db->types[db->nr_types - 1].type == db->nr_types);
    return db->nr_types;
}

inline struct SelvaTypeEntry *selva_get_type_by_index(struct SelvaDb *db, node_type_t type)
{
    if (type == 0) {
        return nullptr;
    }
    assert((size_t)type - 1 < db->nr_types);
    return &db->types[type - 1];
}

inline struct SelvaTypeEntry *selva_get_type_by_node(struct SelvaDb *db, struct SelvaNode *node)
{
    assert((size_t)node->type - 1 < db->nr_types);
    return &db->types[node->type - 1];
}

inline node_type_t selva_get_type(const struct SelvaTypeEntry *te)
{
    return te->type;
}

inline block_id_t selva_get_nr_blocks(const struct SelvaTypeEntry *te)
{
    return te->blocks->len;
}

inline block_id_t selva_get_block_capacity(const struct SelvaTypeEntry *te)
{
    return te->blocks->block_capacity;
}

inline block_id_t selva_node_id2block_i(const struct SelvaTypeBlocks *blocks, node_id_t node_id)
{
    return SELVA_NODE_ID2BLOCK_I3(blocks->block_capacity, node_id);
}

inline block_id_t selva_node_id2block_i2(const struct SelvaTypeEntry *te, node_id_t node_id)
{
    return selva_node_id2block_i(te->blocks, node_id);
}

inline node_id_t selva_block_i2start(const struct SelvaTypeEntry *te, block_id_t block_i)
{
    block_id_t block_capacity = te->blocks->block_capacity;
    node_id_t start = block_i * block_capacity + 1;
    return start;
}

inline node_id_t selva_block_i2end(const struct SelvaTypeEntry *te, block_id_t block_i)
{
    block_id_t block_capacity = te->blocks->block_capacity;
    node_id_t start = block_i * block_capacity + 1;
    node_id_t end = start + block_capacity - 1;
    return end;
}

inline void selva_foreach_block(
        struct SelvaDb *db,
        enum SelvaTypeBlockStatus or_mask,
        void (*cb)(void *ctx, struct SelvaDb *db, struct SelvaTypeEntry *te, block_id_t block, node_id_t start), void *ctx)
{
    for (size_t ti = 0; ti < db->nr_types; ti++) {
        struct SelvaTypeEntry *te = &db->types[ti];
        struct SelvaTypeBlocks *blocks = te->blocks;

        for (block_id_t block_i = 0; block_i < blocks->len; block_i++) {
            struct SelvaTypeBlock *block = &blocks->blocks[block_i];

            /*
             * Note that we call it or_mask because the cb() is called if any
             * bit of the mask is set in the status.
             */
            if (atomic_load_explicit(&block->status.atomic, memory_order_consume) & or_mask) {
                cb(ctx, db, te, block_i, selva_block_i2start(te, block_i));
            }
        }
    }
}

inline enum SelvaTypeBlockStatus selva_block_status_get(const struct SelvaTypeEntry *te, block_id_t block_i)
{
    return atomic_load(&te->blocks->blocks[block_i].status.atomic);
}

inline void selva_block_status_replace(const struct SelvaTypeEntry *te, block_id_t block_i, enum SelvaTypeBlockStatus status)
{
    atomic_store_explicit(&te->blocks->blocks[block_i].status.atomic, (uint32_t)status, memory_order_seq_cst);
}

inline enum SelvaTypeBlockStatus selva_block_status_set(const struct SelvaTypeEntry *te, block_id_t block_i, enum SelvaTypeBlockStatus mask)
{
    return atomic_fetch_or_explicit(&te->blocks->blocks[block_i].status.atomic, (uint32_t)mask, memory_order_seq_cst);
}

inline enum SelvaTypeBlockStatus selva_block_status_reset(const struct SelvaTypeEntry *te, block_id_t block_i, enum SelvaTypeBlockStatus mask)
{
    return atomic_fetch_and_explicit(&te->blocks->blocks[block_i].status.atomic, ~(uint32_t)mask, memory_order_seq_cst);
}

inline bool selva_block_status_eq(const struct SelvaTypeEntry *te, block_id_t block_i, enum SelvaTypeBlockStatus mask)
{
    return (atomic_load(&te->blocks->blocks[block_i].status.atomic) & (uint32_t)mask) == (uint32_t)mask;
}

inline const struct SelvaNodeSchema *selva_get_ns_by_te(const struct SelvaTypeEntry *te)
{
    return &te->ns;
}

inline const struct SelvaFieldSchema *get_fs_by_fields_schema_field(const struct SelvaFieldsSchema *fields_schema, field_t field)
{
    if (!fields_schema || field >= fields_schema->nr_fields) {
        return nullptr;
    }

    return &fields_schema->field_schemas[field];
}

inline const struct SelvaFieldSchema *selva_get_fs_by_te_field(const struct SelvaTypeEntry *te, field_t field)
{
    return get_fs_by_fields_schema_field(&te->ns.fields_schema, field);
}

inline const struct SelvaFieldSchema *selva_get_fs_by_ns_field(const struct SelvaNodeSchema *ns, field_t field)
{
    return get_fs_by_fields_schema_field(&ns->fields_schema, field);
}

inline const struct SelvaFieldSchema *selva_get_fs_by_node(struct SelvaDb *db, struct SelvaNode *node, field_t field)
{
    struct SelvaTypeEntry *type;

    type = selva_get_type_by_node(db, node);
    if (!type) {
        return nullptr;
    }

    return selva_get_fs_by_ns_field(&type->ns, field);
}

inline enum SelvaFieldType selva_get_fs_type(const struct SelvaFieldSchema *fs)
{
    return fs->type;
}

inline const struct EdgeFieldConstraint *selva_get_edge_field_constraint(const struct SelvaFieldSchema *fs)
{
    assert(fs->type == SELVA_FIELD_TYPE_REFERENCE ||
           fs->type == SELVA_FIELD_TYPE_REFERENCES);
    return &fs->edge_constraint;
}

inline const struct SelvaFieldsSchema *selva_get_edge_field_fields_schema(struct SelvaDb *db, const struct EdgeFieldConstraint *efc)
{
    struct SelvaTypeEntry *te = selva_get_type_by_index(db, efc->edge_node_type);

    return (te) ? &selva_get_ns_by_te(te)->fields_schema : nullptr;
}

inline node_id_t selva_get_node_id(const struct SelvaNode *node)
{
    return node->node_id;
}

inline node_type_t selva_get_node_type(const struct SelvaNode *node)
{
    return node->type;
}
#endif
