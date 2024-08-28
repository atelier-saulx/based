/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stddef.h>
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
struct SelvaTypeEntry *selva_get_type_by_index(struct SelvaDb *db, node_type_t type);

SELVA_EXPORT
struct SelvaTypeEntry *selva_get_type_by_node(struct SelvaDb *db, struct SelvaNode *node);

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

SELVA_EXPORT
size_t selva_node_count(const struct SelvaTypeEntry *type);

SELVA_EXPORT
size_t selva_alias_count(const struct SelvaTypeEntry *type);

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
 * Set new alias.
 * new_alias must be allocated with selva_jemalloc.
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
