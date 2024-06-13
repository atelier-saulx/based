/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

struct SelvaDb *db_create(void);
void db_destroy(struct SelvaDb *db);
int db_schema_update(struct SelvaDb *db, node_type_t type, const char *schema_buf, size_t schema_len);
struct SelvaTypeEntry *db_get_type_by_index(struct SelvaDb *db, node_type_t type);
struct SelvaFieldSchema *db_get_fs_by_ns(struct SelvaNodeSchema *ns, field_t field);
void del_node(struct SelvaDb *db, struct SelvaNode *node);
struct SelvaNode *db_get_node(struct SelvaDb *db, struct SelvaTypeEntry *type, node_id_t node_id, bool upsert);
