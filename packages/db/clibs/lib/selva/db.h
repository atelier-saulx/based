/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

/**
 * Create a new DB instance.
 */
struct SelvaDb *db_create(void);

/**
 * Destroy a DB instance.
 */
void db_destroy(struct SelvaDb *db);

/**
 * Create a new node type with a schema.
 */
int db_schema_create(struct SelvaDb *db, node_type_t type, const char *schema_buf, size_t schema_len);

struct SelvaTypeEntry *db_get_type_by_index(struct SelvaDb *db, node_type_t type);
struct SelvaTypeEntry *db_get_type_by_node(struct SelvaDb *db, struct SelvaNode *node);
struct SelvaFieldSchema *db_get_fs_by_ns_field(struct SelvaNodeSchema *ns, field_t field);
struct SelvaFieldSchema *get_fs_by_node(struct SelvaDb *db, struct SelvaNode *node, field_t field);

/**
 * Delete a node.
 */
void db_del_node(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node);

/**
 * Get or create a node by id.
 */
struct SelvaNode *db_find_node(struct SelvaTypeEntry *type, node_id_t node_id);
struct SelvaNode *db_upsert_node(struct SelvaTypeEntry *type, node_id_t node_id);
void db_archive(struct SelvaTypeEntry *type);
void db_prefetch(struct SelvaTypeEntry *type);

void db_set_alias(struct SelvaTypeEntry *type, node_id_t dest, const char *name);
void db_del_alias_by_name(struct SelvaTypeEntry *type, const char *name);
void db_del_alias_by_dest(struct SelvaTypeEntry *type, node_id_t dest);
struct SelvaNode *db_get_alias(struct SelvaTypeEntry *type, const char *name);
