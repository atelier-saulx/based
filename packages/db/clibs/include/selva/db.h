/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <sys/types.h>
#include "selva/_export.h"
#include "selva/types.h"

/**
 * Create a new DB instance.
 */
SELVA_EXPORT
struct SelvaDb *selva_db_create(void);

/**
 * Destroy a DB instance.
 */
SELVA_EXPORT
void selva_db_destroy(struct SelvaDb *db) __attribute__((nonnull));

/**
 * Create a new node type with a schema.
 * @param type must not exist before.
 */
SELVA_EXPORT
int selva_db_schema_create(struct SelvaDb *db, node_type_t type, const char *schema_buf, size_t schema_len) __attribute__((nonnull));

/**
 * Save a db dump.
 * selva_is_dump_ready() must be called after calling this function to
 * reap the child once the dump is ready.
 */
SELVA_EXPORT
pid_t selva_dump_save_async(struct SelvaDb *db, const char *filename) __attribute__((nonnull));

SELVA_EXPORT
int selva_dump_save_common(struct SelvaDb *db, const char *filename) __attribute__((nonnull));

SELVA_EXPORT
int selva_dump_save_range(struct SelvaDb *db, struct SelvaTypeEntry *te, const char *filename, node_id_t start, node_id_t end) __attribute__((nonnull));

/**
 * Check if an ongoing dump has finished.
 * This function must be called to reap the zombie.
 * This function must be called until 0 is returned.
 * @returns 0 if the dump was successful;
 *          SELVA_EINPROGRESS if the chil process is still busy;
 *          SELVA_EGENERAL if the child crashed;
 *          Some other selva error.
 */
SELVA_EXPORT
int selva_is_dump_ready(pid_t child, const char *filename, char *out_buf, size_t *out_len);

/**
 * **Usage:**
 * ```c
 * struct SelvaDb *db = selva_db_create();
 * selva_dump_load_common(db, filename_common);
 * selva_dump_load_range(db, filename_range_n);
 *  ```
 */
SELVA_EXPORT
int selva_dump_load_common(struct SelvaDb *db, const char *filename) __attribute__((nonnull));

SELVA_EXPORT
int selva_dump_load_range(struct SelvaDb *db, const char *filename) __attribute__((nonnull));

/**
 * Load a db dump.
 */
SELVA_EXPORT
int selva_dump_load(const char *filename, struct SelvaDb **db_out) __attribute__((nonnull));

/**
 * Find a type by type id.
 */
SELVA_EXPORT
struct SelvaTypeEntry *selva_get_type_by_index(const struct SelvaDb *db, node_type_t type) __attribute__((nonnull));

/**
 * Get the type for node.
 */
SELVA_EXPORT
struct SelvaTypeEntry *selva_get_type_by_node(const struct SelvaDb *db, struct SelvaNode *node) __attribute__((nonnull, pure));

/**
 * Get the node schema for type.
 */
SELVA_EXPORT
const struct SelvaNodeSchema *selva_get_ns_by_te(const struct SelvaTypeEntry *te) __attribute__((nonnull, pure));

SELVA_EXPORT
const struct SelvaFieldSchema *get_fs_by_fields_schema_field(const struct SelvaFieldsSchema *fields_schema, field_t field) __attribute__((nonnull, pure));

/**
 * Get the field schema for field.
 */
SELVA_EXPORT
const struct SelvaFieldSchema *selva_get_fs_by_ns_field(const struct SelvaNodeSchema *ns, field_t field) __attribute__((nonnull, pure));

/**
 * Get the field schema for field.
 */
SELVA_EXPORT
const struct SelvaFieldSchema *selva_get_fs_by_node(struct SelvaDb *db, struct SelvaNode *node, field_t field) __attribute__((nonnull, pure));

/**
 * Get the EdgeFieldConstraint from a ref field schema.
 * struct EdgeFieldConstraint *efc = selva_get_edge_field_constraint(src_fs);
 * struct SelvaTypeEntry *dst_type = selva_get_type_by_index(db, efc->dst_node_type);
 * struct SelvaFieldSchema *dst_fs = selva_get_fs_by_node(db, dst, efc->inverse_field);
 */
SELVA_EXPORT
const struct EdgeFieldConstraint *selva_get_edge_field_constraint(const struct SelvaFieldSchema *fs) __attribute__((nonnull));

/**
 * Delete a node.
 */
SELVA_EXPORT
void selva_del_node(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node) __attribute__((nonnull));

/**
 * Get a node by id.
 */
SELVA_EXPORT
struct SelvaNode *selva_find_node(struct SelvaTypeEntry *type, node_id_t node_id) __attribute__((nonnull));

/**
 * Find the first node greater than or equal to the provided id, or NULL.
 */
SELVA_EXPORT
struct SelvaNode *selva_nfind_node(struct SelvaTypeEntry *type, node_id_t node_id) __attribute__((nonnull));

/**
 * Get or create a node by id.
 */
SELVA_EXPORT
struct SelvaNode *selva_upsert_node(struct SelvaTypeEntry *type, node_id_t node_id) __attribute__((nonnull));

/**
 * **Example**
 * ```c
 * for (struct SelvaNode *np = selva_min_node(type); np; np = selva_next_node(type, np))
 * ```
 */
SELVA_EXPORT
struct SelvaNode *selva_min_node(struct SelvaTypeEntry *type) __attribute__((nonnull));

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
struct SelvaNode *selva_prev_node(struct SelvaTypeEntry *type, struct SelvaNode *node) __attribute__((nonnull));

/**
 * Get next node with higher node id.
 */
SELVA_EXPORT
struct SelvaNode *selva_next_node(struct SelvaTypeEntry *type, struct SelvaNode *node) __attribute__((nonnull));

/**
 * Create a new cursor pointing to node.
 * If the node is deleted later then the cursor is updated to point to the next
 * node using selva_next_node().
 */
SELVA_EXPORT
cursor_id_t selva_cursor_new(struct SelvaTypeEntry *type, struct SelvaNode *node) __attribute__((nonnull));

/**
 * Get a pointer to the node from a cursor.
 */
SELVA_EXPORT
struct SelvaNode *selva_cursor_get(struct SelvaTypeEntry *type, cursor_id_t id) __attribute__((nonnull));

/**
 * Update a cursor to point to a new node.
 */
SELVA_EXPORT
int selva_cursor_update(struct SelvaTypeEntry *type, cursor_id_t id, struct SelvaNode *node) __attribute__((nonnull));

/**
 * Delete a cursor.
 */
SELVA_EXPORT
void selva_cursor_del(struct SelvaTypeEntry *type, cursor_id_t id) __attribute__((nonnull));

/**
 * Total count of cursors of type.
 */
SELVA_EXPORT
size_t selva_cursor_count(const struct SelvaTypeEntry *type) __attribute__((nonnull));

/**
 * Total count of nodes of type.
 */
SELVA_EXPORT
size_t selva_node_count(const struct SelvaTypeEntry *type) __attribute__((nonnull));

/**
 * Get the node id of of node.
 */
SELVA_EXPORT
node_id_t selva_get_node_id(const struct SelvaNode *node) __attribute__((nonnull, pure));

/**
 * \addtogroup node_hash
 * @{
 */

/**
 * Calculate the node hash.
 */
SELVA_EXPORT
void selva_node_hash_update(struct SelvaTypeEntry *type, struct SelvaNode *node) __attribute__((nonnull));

/**
 * Clear the node hash.
 */
SELVA_EXPORT
void selva_node_hash_clear(struct SelvaNode *node) __attribute__((nonnull));

/**
 * Get the current node_hash value.
 */
SELVA_EXPORT
selva_hash128_t selva_node_hash_get(struct SelvaNode *node) __attribute__((nonnull));

SELVA_EXPORT
selva_hash128_t selva_node_hash_range(struct SelvaTypeEntry *type, node_id_t start, node_id_t end) __attribute__((nonnull));

/**
 * @}
 */

/**
 * Give a hint to page out a node type.
 */
SELVA_EXPORT
void selva_archive_type(struct SelvaTypeEntry *type);

/**
 * Give a hint to page in a node type.
 */
SELVA_EXPORT
void selva_prefetch_type(struct SelvaTypeEntry *type);

/**
 * Get the number of aliases under given type.
 */
SELVA_EXPORT
size_t selva_alias_count(const struct SelvaAliases *aliases);

/**
 * Set new alias.
 * @param name is copied.
 */
SELVA_EXPORT
void selva_set_alias(struct SelvaAliases *aliases, node_id_t dest, const char *name_str, size_t name_len);

/**
 * Delete alias by name.
 */
SELVA_EXPORT
int selva_del_alias_by_name(struct SelvaAliases *aliases, const char *name_str, size_t name_len);

/**
 * Delete all aliases pointing to dest.
 */
SELVA_EXPORT
void selva_del_alias_by_dest(struct SelvaAliases *aliases, node_id_t dest);

/**
 * Get alias by name.
 */
SELVA_EXPORT
struct SelvaNode *selva_get_alias(struct SelvaTypeEntry *type, struct SelvaAliases *aliases, const char *name_str, size_t name_len);

/**
 * Get alias by destination id.
 * This may not seem very useful but this is actually the way that allows you to
 * traverse all aliases to the given node_id by following the `next` pointer or
 * by calling selva_get_next_alias().
 */
SELVA_EXPORT
const struct SelvaAlias *selva_get_alias_by_dest(struct SelvaAliases *aliases, node_id_t dest);

SELVA_EXPORT
const struct SelvaAlias *selva_get_next_alias(struct SelvaAlias *alias);

SELVA_EXPORT
struct SelvaAliases *selva_get_aliases(struct SelvaTypeEntry *type, field_t field);

/***
 * Remove all aliases to the given node_id.
 */
SELVA_EXPORT
void selva_remove_all_aliases(struct SelvaTypeEntry *type, node_id_t node_id);
