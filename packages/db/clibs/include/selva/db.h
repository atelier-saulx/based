/*
 * Copyright (c) 2024-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <sys/types.h>
#include "selva/_export.h"
#include "selva/types.h"

/*
 * TODO Don't like this one but it compiles.
 * We should have something with selva_hash_state;
 */
struct XXH3_state_s;

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
int selva_db_create_type(struct SelvaDb *db, node_type_t type, const char *schema_buf, size_t schema_len) __attribute__((nonnull));

/**
 * Save the common/shared data of the database.
 */
SELVA_EXPORT
int selva_dump_save_common(struct SelvaDb *db, const char *filename) __attribute__((nonnull));

/**
 * Save a range of nodes from te.
 */
SELVA_EXPORT
int selva_dump_save_range(struct SelvaDb *db, struct SelvaTypeEntry *te, const char *filename, node_id_t start, node_id_t end, selva_hash128_t *range_hash_out) __attribute__((nonnull));

/**
 * **Usage:**
 * ```c
 * struct SelvaDb *db = selva_db_create();
 * selva_dump_load_common(db, filename_common);
 * selva_dump_load_range(db, filename_range_n);
 *  ```
 */
SELVA_EXPORT
int selva_dump_load_common(struct SelvaDb *db, const char *filename, char *errlog_buf, size_t errlog_size) __attribute__((nonnull));

SELVA_EXPORT
int selva_dump_load_range(struct SelvaDb *db, const char *filename, char *errlog_buf, size_t errlog_size) __attribute__((nonnull));

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

SELVA_EXPORT
inline block_id_t selva_get_block_capacity(const struct SelvaTypeEntry *te)
#if !__zig
{
    return te->blocks->block_capacity;
}
#else
;
#endif

/**
 * Get the node schema for type.
 */
SELVA_EXPORT
__attribute__((nonnull, pure))
inline const struct SelvaNodeSchema *selva_get_ns_by_te(const struct SelvaTypeEntry *te)
#if !__zig
{
    return &te->ns;
}
#else
;
#endif

SELVA_EXPORT
__attribute__((nonnull, pure))
inline const struct SelvaFieldSchema *get_fs_by_fields_schema_field(const struct SelvaFieldsSchema *fields_schema, field_t field)
#if !__zig
{
    if (field >= fields_schema->nr_fields) {
        return nullptr;
    }

    return &fields_schema->field_schemas[field];
}
#else
;
#endif

/**
 * Get the field schema for field.
 */
SELVA_EXPORT
__attribute__((nonnull, pure))
inline const struct SelvaFieldSchema *selva_get_fs_by_te_field(const struct SelvaTypeEntry *te, field_t field)
#if !__zig
{
    return get_fs_by_fields_schema_field(&te->ns.fields_schema, field);
}
#else
;
#endif

/**
 * Get the field schema for field.
 */
SELVA_EXPORT
__attribute__((nonnull, pure))
inline const struct SelvaFieldSchema *selva_get_fs_by_ns_field(const struct SelvaNodeSchema *ns, field_t field)
#if !__zig
{
    return get_fs_by_fields_schema_field(&ns->fields_schema, field);
}
#else
;
#endif

/**
 * Get the field schema for field.
 */
SELVA_EXPORT
__attribute__((nonnull, pure))
inline const struct SelvaFieldSchema *selva_get_fs_by_node(struct SelvaDb *db, struct SelvaNode *node, field_t field)
#if !__zig
{
    struct SelvaTypeEntry *type;

    type = selva_get_type_by_node(db, node);
    if (!type) {
        return nullptr;
    }

    return selva_get_fs_by_ns_field(&type->ns, field);
}
#else
;
#endif

SELVA_EXPORT
#if __has_c_attribute(reproducible)
[[reproducible]]
#endif
inline enum SelvaFieldType selva_get_fs_type(const struct SelvaFieldSchema *fs)
#if !__zig
{
    return fs->type;
}
#else
;
#endif

/**
 * Get the EdgeFieldConstraint from a ref field schema.
 * struct EdgeFieldConstraint *efc = selva_get_edge_field_constraint(src_fs);
 * struct SelvaTypeEntry *dst_type = selva_get_type_by_index(db, efc->dst_node_type);
 * struct SelvaFieldSchema *dst_fs = selva_get_fs_by_node(db, dst, efc->inverse_field);
 */
SELVA_EXPORT
__attribute__((nonnull))
inline const struct EdgeFieldConstraint *selva_get_edge_field_constraint(const struct SelvaFieldSchema *fs)
#if !__zig
{
    return (fs->type == SELVA_FIELD_TYPE_REFERENCE || fs->type == SELVA_FIELD_TYPE_REFERENCES)
        ? &fs->edge_constraint
        : nullptr;
}
#else
;
#endif

SELVA_EXPORT
const struct SelvaFieldsSchema *selva_get_edge_field_fields_schema(struct SelvaDb *db, const struct EdgeFieldConstraint *efc);

SELVA_EXPORT
void selva_expire_node(struct SelvaDb *db, node_type_t type, node_id_t node_id, int64_t ts);

SELVA_EXPORT
void selva_expire_node_cancel(struct SelvaDb *db, node_type_t type, node_id_t node_id);

SELVA_EXPORT
void selva_db_expire_tick(struct SelvaDb *db, int64_t now);

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
 * \addtogroup db_cursor
 * @{
 */

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
 * @}
 */

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
inline node_id_t selva_get_node_id(const struct SelvaNode *node)
#if !__zig
{
    return node->node_id;
}
#else
;
#endif

/**
 * Get the type of of node.
 */
SELVA_EXPORT
__attribute__((nonnull, pure))
inline node_type_t selva_get_node_type(const struct SelvaNode *node)
#if !__zig
{
    return node->type;
}
#else
;
#endif

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
selva_hash128_t selva_node_hash_range(struct SelvaDb *db, struct SelvaTypeEntry *type, node_id_t start, node_id_t end) __attribute__((nonnull));

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
const struct SelvaAlias *selva_get_next_alias(const struct SelvaAlias *alias);

SELVA_EXPORT
const char *selva_get_alias_name(const struct SelvaAlias *alias, size_t *len) __attribute__((nonnull(1), pure));

SELVA_EXPORT
struct SelvaAliases *selva_get_aliases(struct SelvaTypeEntry *type, field_t field);

/***
 * Remove all aliases to the given node_id.
 */
SELVA_EXPORT
void selva_remove_all_aliases(struct SelvaTypeEntry *type, node_id_t node_id);
