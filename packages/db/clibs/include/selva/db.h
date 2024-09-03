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

SELVA_EXPORT
pid_t selva_dump_save_async(struct SelvaDb *db, const char *filename);

SELVA_EXPORT
int selva_is_dump_ready(pid_t child, const char *filename, char *out_buf, size_t *out_len);

SELVA_EXPORT
int selva_dump_load(const char *filename, struct SelvaDb **db_out);

SELVA_EXPORT
struct SelvaTypeEntry *selva_get_type_by_index(struct SelvaDb *db, node_type_t type);

SELVA_EXPORT
struct SelvaTypeEntry *selva_get_type_by_node(struct SelvaDb *db, struct SelvaNode *node);

SELVA_EXPORT
struct SelvaNodeSchema *selva_get_ns_by_te(struct SelvaTypeEntry *te);

SELVA_EXPORT
struct SelvaFieldSchema *selva_get_fs_by_ns_field(struct SelvaNodeSchema *ns, field_t field);

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

SELVA_EXPORT
struct SelvaNode *selva_prev_node(struct SelvaTypeEntry *type, struct SelvaNode *node);

SELVA_EXPORT
struct SelvaNode *selva_next_node(struct SelvaTypeEntry *type, struct SelvaNode *node);

SELVA_EXPORT
size_t selva_node_count(const struct SelvaTypeEntry *type);

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

SELVA_EXPORT
void selva_del_alias_by_name(struct SelvaTypeEntry *type, const char *name);

SELVA_EXPORT
void selva_del_alias_by_dest(struct SelvaTypeEntry *type, node_id_t dest);

/**
 * Get alias by name.
 */
SELVA_EXPORT
struct SelvaNode *selva_get_alias(struct SelvaTypeEntry *type, const char *name);
