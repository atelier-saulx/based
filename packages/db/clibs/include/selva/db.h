/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "selva/_export.h"
#include "selva/types.h"

/**
 * Create a new DB instance.
 */
SELVA_EXPORT
struct SelvaDb *db_create(void);

/**
 * Destroy a DB instance.
 */
SELVA_EXPORT
void db_destroy(struct SelvaDb *db);

/**
 * Create a new node type with a schema.
 * @param type must not exist before.
 */
SELVA_EXPORT
int db_schema_create(struct SelvaDb *db, node_type_t type, const char *schema_buf, size_t schema_len);

SELVA_EXPORT
struct SelvaTypeEntry *db_get_type_by_index(struct SelvaDb *db, node_type_t type);

SELVA_EXPORT
struct SelvaTypeEntry *db_get_type_by_node(struct SelvaDb *db, struct SelvaNode *node);

SELVA_EXPORT
struct SelvaFieldSchema *db_get_fs_by_ns_field(struct SelvaNodeSchema *ns, field_t field);

SELVA_EXPORT
struct SelvaFieldSchema *get_fs_by_node(struct SelvaDb *db, struct SelvaNode *node, field_t field);

/**
 * Delete a node.
 */
SELVA_EXPORT
void db_del_node(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node);

/**
 * Get a node by id.
 */
SELVA_EXPORT
struct SelvaNode *db_find_node(struct SelvaTypeEntry *type, node_id_t node_id);

/**
 * Get or create a node by id.
 */
SELVA_EXPORT
struct SelvaNode *db_upsert_node(struct SelvaTypeEntry *type, node_id_t node_id);

/**
 * Give a hint to page out a node type.
 */
SELVA_EXPORT
void db_archive(struct SelvaTypeEntry *type);

/**
 * Give a hint to page in a node type.
 */
SELVA_EXPORT
void db_prefetch(struct SelvaTypeEntry *type);

/**
 * Set new alias.
 * new_alias must be allocated with selva_jemalloc.
 */
SELVA_EXPORT
void db_set_alias_p(struct SelvaTypeEntry *type, struct SelvaAlias *new_alias);

/**
 * Set new alias.
 * @param name is copied.
 */
SELVA_EXPORT
void db_set_alias(struct SelvaTypeEntry *type, node_id_t dest, const char *name);

SELVA_EXPORT
void db_del_alias_by_name(struct SelvaTypeEntry *type, const char *name);

SELVA_EXPORT
void db_del_alias_by_dest(struct SelvaTypeEntry *type, node_id_t dest);

/**
 * Get alias by name.
 */
SELVA_EXPORT
struct SelvaNode *db_get_alias(struct SelvaTypeEntry *type, const char *name);
