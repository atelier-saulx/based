/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

struct SelvaDb *db_create(void);
void db_destroy(struct SelvaDb *db);
int db_schema_create(struct SelvaDb *db, node_type_t type, const char *schema_buf, size_t schema_len);
struct SelvaTypeEntry *db_get_type_by_index(struct SelvaDb *db, node_type_t type);
struct SelvaTypeEntry *db_get_type_by_node(struct SelvaDb *db, struct SelvaNode *node);
struct SelvaFieldSchema *db_get_fs_by_ns_field(struct SelvaNodeSchema *ns, field_t field);
void del_node(struct SelvaDb *db, struct SelvaNode *node);
struct SelvaNode *db_get_node(struct SelvaDb *db, struct SelvaTypeEntry *type, node_id_t node_id, bool upsert);

[[noreturn]]
void db_panic_fn(const char * restrict where, const char * restrict func, const char * restrict fmt, ...) __attribute__((format(printf, 3, 4)));

#define DB_PANIC_WHERESTR (__FILE__ ":" S__LINE__)

#define db_panic1(where, func, fmt, ...) \
    db_panic_fn(where, func, fmt __VA_OPT__(,) __VA_ARGS__)

#define db_panic(fmt, ...) \
    db_panic1(DB_PANIC_WHERESTR, __func__, fmt __VA_OPT__(,) __VA_ARGS__)

