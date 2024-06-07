/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

struct SelvaDb *db_create(void);
void db_destroy(struct SelvaDb *db);
int db_schema_update(struct SelvaDb *db, char *schema_buf, size_t schema_len);
struct SelvaNode *new_node(struct SelvaDb *db, struct SelvaTypeEntry *type, node_id_t id);
void del_node(struct SelvaDb *db, struct SelvaNode *node);
