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
void selva_db_destroy(struct SelvaDb *db);

/**
 * Create a new node type with a schema.
 * @param type must not exist before.
 */
SELVA_EXPORT
int selva_db_schema_create(struct SelvaDb *db, node_type_t type, const char *schema_buf, size_t schema_len);

/**
 * Save a db dump.
 * selva_is_dump_ready() must be called after calling this function to
 * reap the child once the dump is ready.
 */
SELVA_EXPORT
pid_t selva_dump_save_async(struct SelvaDb *db, const char *filename);

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
 * Load a db dump.
 */
SELVA_EXPORT
int selva_dump_load(const char *filename, struct SelvaDb **db_out);

/**
 * Find a type by type id.
 */
SELVA_EXPORT
struct SelvaTypeEntry *selva_get_type_by_index(const struct SelvaDb *db, node_type_t type);

/**
 * Get the type for node.
 */
SELVA_EXPORT
struct SelvaTypeEntry *selva_get_type_by_node(const struct SelvaDb *db, struct SelvaNode *node);

/**
 * Get the node schema for type.
 */
SELVA_EXPORT
struct SelvaNodeSchema *selva_get_ns_by_te(struct SelvaTypeEntry *te);

/**
 * Get the field schema for field.
 */
SELVA_EXPORT
struct SelvaFieldSchema *selva_get_fs_by_ns_field(struct SelvaNodeSchema *ns, field_t field);

/**
 * Get the field schema for field.
 */
SELVA_EXPORT
struct SelvaFieldSchema *selva_get_fs_by_node(struct SelvaDb *db, struct SelvaNode *node, field_t field);

/**
 * Delete a node.
 */
SELVA_EXPORT
void selva_del_node(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node);

/**
 * Get a node by id.
 */
SELVA_EXPORT
struct SelvaNode *selva_find_node(struct SelvaTypeEntry *type, node_id_t node_id);

/**
 * Get or create a node by id.
 */
SELVA_EXPORT
struct SelvaNode *selva_upsert_node(struct SelvaTypeEntry *type, node_id_t node_id);

/**
 * **Example**
 * ```c
 * for (struct SelvaNode *np = selva_min_node(type); np; np = selva_next_node(type, np))
 * ```
 */
SELVA_EXPORT
struct SelvaNode *selva_min_node(struct SelvaTypeEntry *type);

/**
 * **Example**
 * ```c
 * for (struct SelvaNode *np = selva_max_node(type); np; np = selva_prev_node(type, np))
 * ```
 */
SELVA_EXPORT
struct SelvaNode *selva_max_node(struct SelvaTypeEntry *type);

/**
 * Get previous node with a lower node id.
 */
SELVA_EXPORT
struct SelvaNode *selva_prev_node(struct SelvaTypeEntry *type, struct SelvaNode *node);

/**
 * Get next node with higher node id.
 */
SELVA_EXPORT
struct SelvaNode *selva_next_node(struct SelvaTypeEntry *type, struct SelvaNode *node);

/**
 * Create a new cursor pointing to node.
 * If the node is deleted later then the cursor is updated to point to the next
 * node using selva_next_node().
 */
SELVA_EXPORT
cursor_id_t selva_cursor_new(struct SelvaTypeEntry *type, struct SelvaNode *node);

/**
 * Get a pointer to the node from a cursor.
 */
SELVA_EXPORT
struct SelvaNode *selva_cursor_get(struct SelvaTypeEntry *type, cursor_id_t id);

/**
 * Update a cursor to point to a new node.
 */
SELVA_EXPORT
int selva_cursor_update(struct SelvaTypeEntry *type, cursor_id_t id, struct SelvaNode *node);

/**
 * Delete a cursor.
 */
SELVA_EXPORT
void selva_cursor_del(struct SelvaTypeEntry *type, cursor_id_t id);

/**
 * Total count of cursors of type.
 */
SELVA_EXPORT
size_t selva_cursor_count(const struct SelvaTypeEntry *type);

/**
 * Total count of nodes of type.
 */
SELVA_EXPORT
size_t selva_node_count(const struct SelvaTypeEntry *type);

/**
 * Get the node id of of node.
 */
SELVA_EXPORT
node_id_t selva_get_node_id(const struct SelvaNode *node);

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
size_t selva_alias_count(const struct SelvaTypeEntry *type);

/**
 * Set new alias.
 * `new_alias` must be allocated with selva_jemalloc.
 */
SELVA_EXPORT
void selva_set_alias_p(struct SelvaTypeEntry *type, struct SelvaAlias *new_alias);

/**
 * Set new alias.
 * @param name is copied.
 */
SELVA_EXPORT
void selva_set_alias(struct SelvaTypeEntry *type, node_id_t dest, const char *name);

/**
 * Delete alias by name.
 */
SELVA_EXPORT
void selva_del_alias_by_name(struct SelvaTypeEntry *type, const char *name);

/**
 * Delete all aliases pointing to dest.
 */
SELVA_EXPORT
void selva_del_alias_by_dest(struct SelvaTypeEntry *type, node_id_t dest);

/**
 * Get alias by name.
 */
SELVA_EXPORT
struct SelvaNode *selva_get_alias(struct SelvaTypeEntry *type, const char *name);
