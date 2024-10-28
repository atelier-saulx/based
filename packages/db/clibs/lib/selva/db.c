/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include <sys/mman.h>
#include "jemalloc.h"
#include "util/align.h"
#include "util/ida.h"
#include "xxhash.h"
#include "selva/fields.h"
#include "queue.h"
#include "selva_error.h"
#include "selva_hash128.h"
#include "schema.h"
#include "db_panic.h"
#include "db.h"

#define NODEPOOL_SLAB_SIZE 2097152

/**
 * Cursor pointing to a node in a SelvaTypeEntry.
 * If the node is deleted the cursor is updated to point to the next
 * node using selva_next_node().
 */
struct SelvaTypeCursor {
    RB_ENTRY(SelvaTypeCursor) _entry_by_id;
    TAILQ_ENTRY(SelvaTypeCursor) _entry_by_node_id;
    /**
     * Pointer back to the SelvaTypeCursors (by node_id).
     * Saves an RB find.
     * NULL if ptr == NULL.
     */
    struct SelvaTypeCursors *cursors;
    struct SelvaNode *ptr;
    cursor_id_t cursor_id;
    node_type_t type;
};

/**
 * All cursors pointing to a specific node.
 */
struct SelvaTypeCursors {
    RB_ENTRY(SelvaTypeCursors) _entry_by_node_id;
    TAILQ_HEAD(SelvaTypeCursorByNodeIdHead, SelvaTypeCursor) head;
    node_id_t node_id;
};

static inline int node_id_cmp(node_id_t a, node_id_t b)
{
    return a < b ? -1 : a > b ? 1 : 0;
}

int SelvaNode_cmp(const struct SelvaNode *a, const struct SelvaNode *b)
{
    return node_id_cmp(a->node_id, b->node_id);
}

int SelvaAlias_cmp_name(const struct SelvaAlias *a, const struct SelvaAlias *b)
{
    return strcmp(a->name, b->name);
}

int SelvaAlias_cmp_dest(const struct SelvaAlias *a, const struct SelvaAlias *b)
{
    return node_id_cmp(a->dest, b->dest);
}

#if 0
static int SVector_SelvaNode_expire_compare(const void ** restrict a_raw, const void ** restrict b_raw)
{
    const struct SelvaNode *a = *(const struct SelvaNode **)a_raw;
    const struct SelvaNode *b = *(const struct SelvaNode **)b_raw;
    int diff;

    assert(a && b);

    diff = a->expire - b->expire;
    if (diff) {
        return diff;
    }

    return node_id_cmp(a->node_id, b->node_id);
}
#endif

static int SVector_SelvaTypeEntry_compare(const void ** restrict a_raw, const void ** restrict b_raw)
{
    uint16_t a_type = 0xFFFF & (uintptr_t)(*a_raw);
    uint16_t b_type = 0xFFFF & (uintptr_t)(*b_raw);

    return (int)a_type - (int)b_type;
}

static int SelvaTypeCursor_cmp(const struct SelvaTypeCursor *a, const struct SelvaTypeCursor *b)
{
    return (int)(a->cursor_id - b->cursor_id);
}

static int SelvaTypeCursors_cmp(const struct SelvaTypeCursors *a, const struct SelvaTypeCursors *b)
{
    return node_id_cmp(a->node_id, b->node_id);
}

static void selva_cursors_node_going_away(struct SelvaTypeEntry *type, struct SelvaNode *node);
static void selva_destroy_all_cursors(struct SelvaTypeEntry *type);

RB_PROTOTYPE_STATIC(SelvaTypeCursorById, SelvaTypeCursor, _entry_by_id, SelvaTypeCursor_cmp)
RB_PROTOTYPE_STATIC(SelvaTypeCursorsByNodeId, SelvaTypeCursors, _entry_by_node_id, SelvaTypeCursors_cmp)

RB_GENERATE(SelvaNodeIndex, SelvaNode, _index_entry, SelvaNode_cmp)
RB_GENERATE_STATIC(SelvaTypeCursorById, SelvaTypeCursor, _entry_by_id, SelvaTypeCursor_cmp)
RB_GENERATE_STATIC(SelvaTypeCursorsByNodeId, SelvaTypeCursors, _entry_by_node_id, SelvaTypeCursors_cmp)
RB_GENERATE(SelvaAliasesByName, SelvaAlias, _entry, SelvaAlias_cmp_name)
RB_GENERATE(SelvaAliasesByDest, SelvaAlias, _entry, SelvaAlias_cmp_dest)

struct SelvaDb *selva_db_create(void)
{
    struct SelvaDb *db = selva_calloc(1, sizeof(*db));

    SVector_Init(&db->type_list, 1, SVector_SelvaTypeEntry_compare);
    ref_save_map_init(&db->schema.ref_save_map);
#if 0
    db->expiring.next = SELVA_NODE_EXPIRE_NEVER;
    SVector_Init(&db->expiring.list, 0, SVector_SelvaNode_expire_compare);
    /* TODO Expiring nodes timer */
    db->expiring.tim_id = evl_set_timeout(&hierarchy_expire_period, hierarchy_expire_tim_proc, hierarchy);
#endif

    return db;
}

/**
 * Delete all nodes under this type.
 */
static void del_all_nodes(struct SelvaDb *db, struct SelvaTypeEntry *type)
{
    struct SelvaNode *node;
    struct SelvaNode *tmp;

    RB_FOREACH_SAFE(node, SelvaNodeIndex, &type->nodes, tmp) {
        selva_del_node(db, type, node);
    }
}

static void del_type(struct SelvaDb *db, struct SelvaTypeEntry *type)
{
    selva_destroy_all_cursors(type);
    del_all_nodes(db, type);
    /*
     * We assume that as the nodes are deleted the aliases are also freed.
     * The following function will just free type->aliases.
     */
    selva_destroy_aliases(type);

    (void)SVector_Remove(&db->type_list, SelvaTypeEntry2vecptr(type));

    mempool_destroy(&type->nodepool);
    schemabuf_deinit_fields_schema(&type->ns.fields_schema);
#if 0
    memset(type, 0, sizeof(*type));
#endif
    selva_free(type);
}

static void del_all_types(struct SelvaDb *db)
{
    SVECTOR_AUTOFREE(types_copy);
    struct SVectorIterator it;
    struct SelvaTypeEntry *type;

    SVector_Clone(&types_copy, &db->type_list, NULL);
    SVector_ForeachBegin(&it, &types_copy);
    while ((type = vecptr2SelvaTypeEntry(SVector_Foreach(&it)))) {
        del_type(db, type);
    }
}

void selva_db_destroy(struct SelvaDb *db)
{
    del_all_types(db);
    ref_save_map_destroy(&db->schema.ref_save_map);
#if 0
    memset(db, 0, sizeof(*db));
#endif
    selva_free(db);
}

static bool eq_type_exists(struct SelvaDb *db, node_type_t type, const char *schema_buf, size_t schema_len)
{
    struct SelvaTypeEntry *te;

    te = selva_get_type_by_index(db, type);
    return (te && te->schema_len == schema_len && !memcmp(te->schema_buf, schema_buf, schema_len));
}

int selva_db_schema_create(struct SelvaDb *db, node_type_t type, const char *schema_buf, size_t schema_len)
{
    struct schema_fields_count count;
    const size_t te_ns_max_size = (sizeof(struct SelvaTypeEntry) - offsetof(struct SelvaTypeEntry, ns) - sizeof(struct SelvaTypeEntry){0}.ns);
    int err;

    if (eq_type_exists(db, type, schema_buf, schema_len)) {
        return SELVA_EEXIST;
    }

    err = schemabuf_count_fields(&count, schema_buf, schema_len);
    if (err) {
        return err;
    }

    if (count.nr_fields * sizeof(struct SelvaFieldSchema) > te_ns_max_size) {
        /* schema too large. */
        return SELVA_ENOBUFS;
    }

    struct SelvaTypeEntry *te = selva_aligned_alloc(alignof(*te), sizeof(*te));
    memset(te, 0, sizeof(*te) - te_ns_max_size + count.nr_fields * sizeof(struct SelvaFieldSchema));

    te->type = type;
    te->schema_buf = schema_buf;
    te->schema_len = schema_len;
    err = schemabuf_parse_ns(db, &te->ns, &count, schema_buf, schema_len);
    if (err) {
        selva_free(te);
        return err;
    }

    RB_INIT(&te->nodes);
    selva_init_aliases(te);

    const size_t node_size = sizeof_wflex(struct SelvaNode, fields.fields_map, count.nr_fields);
    mempool_init2(&te->nodepool, NODEPOOL_SLAB_SIZE, node_size, alignof(size_t), MEMPOOL_ADV_RANDOM | MEMPOOL_ADV_HP_SOFT);

#if 0
    struct mempool_slab_info slab_info = mempool_slab_info(&te->nodepool);
    printf("\ntype: %d\n"
           "node_size: %zu\n"
           "slab_size: %zu\n"
           "chunk_size: %zu\n"
           "obj_size: %zu\n"
           "nr_objects: %zu\n",
           type,
           node_size,
           slab_info.slab_size,
           slab_info.chunk_size,
           slab_info.obj_size,
           slab_info.nr_objects);
#endif

    void *prev = SVector_Insert(&db->type_list, SelvaTypeEntry2vecptr(te));
    if (prev) {
        db_panic("Schema update not supported");
    }
    return 0;
}

struct SelvaTypeEntry *selva_get_type_by_index(const struct SelvaDb *db, node_type_t type)
{
    void *find = (void *)(uintptr_t)type;

    return vecptr2SelvaTypeEntry(SVector_Search(&db->type_list, find));
}

struct SelvaTypeEntry *selva_get_type_by_node(const struct SelvaDb *db, struct SelvaNode *node)
{
    void *find = (void *)(uintptr_t)node->type;
    struct SelvaTypeEntry *te;

    te = vecptr2SelvaTypeEntry(SVector_Search(&db->type_list, find));
    assert(te);
    return te;
}

const struct SelvaNodeSchema *selva_get_ns_by_te(const struct SelvaTypeEntry *te)
{
    return &te->ns;
}

const struct SelvaFieldSchema *get_fs_by_fields_schema_field(const struct SelvaFieldsSchema *fields_schema, field_t field)
{
    if (field >= fields_schema->nr_fields) {
        return NULL;
    }

    return &fields_schema->field_schemas[field];
}

const struct SelvaFieldSchema *selva_get_fs_by_ns_field(const struct SelvaNodeSchema *ns, field_t field)
{
    return get_fs_by_fields_schema_field(&ns->fields_schema, field);
}

const struct SelvaFieldSchema *selva_get_fs_by_node(struct SelvaDb *db, struct SelvaNode *node, field_t field)
{
    struct SelvaTypeEntry *type;

    type = selva_get_type_by_node(db, node);
    if (!type) {
        return NULL;
    }

    return selva_get_fs_by_ns_field(&type->ns, field);
}

const struct EdgeFieldConstraint *selva_get_edge_field_constraint(const struct SelvaFieldSchema *fs)
{
    return (fs->type == SELVA_FIELD_TYPE_REFERENCE || fs->type == SELVA_FIELD_TYPE_REFERENCES)
        ? &fs->edge_constraint
        : NULL;
}

void selva_del_node(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node)
{
    selva_remove_all_aliases(type, node->node_id);
    selva_cursors_node_going_away(type, node);
    RB_REMOVE(SelvaNodeIndex, &type->nodes, node);
    if (node == type->max_node) {
        type->max_node = selva_max_node(type);
    }

#if 0
    if (node->expire) {
        /* TODO clear expire */
    }
#endif

    selva_fields_destroy(db, node);
#if 0
    memset(node, 0, sizeof_wflex(struct SelvaNode, fields.fields_map, type->ns.nr_fields));
#endif
    mempool_return(&type->nodepool, node);
    type->nr_nodes--;
}

struct SelvaNode *selva_find_node(struct SelvaTypeEntry *type, node_id_t node_id)
{
    struct SelvaNode find = {
        .node_id = node_id,
    };

    return RB_FIND(SelvaNodeIndex, &type->nodes, &find);
}

struct SelvaNode *selva_nfind_node(struct SelvaTypeEntry *type, node_id_t node_id)
{
    struct SelvaNode find = {
        .node_id = node_id,
    };

    return RB_NFIND(SelvaNodeIndex, &type->nodes, &find);
}

struct SelvaNode *selva_upsert_node(struct SelvaTypeEntry *type, node_id_t node_id)
{
    struct SelvaNode *node = mempool_get(&type->nodepool);

    assert(node_id != 0);

    node->node_id = node_id;
    node->type = type->type;
    node->node_hash = 0;

    if (type->max_node && type->max_node->node_id < node_id) {
        /*
         * We can assume that node_id almost always grows monotonically.
         */
        RB_INSERT_NEXT(SelvaNodeIndex, &type->nodes, type->max_node, node);
    } else {
        struct SelvaNode *prev;

        prev = RB_INSERT(SelvaNodeIndex, &type->nodes, node);
        if (prev) {
            mempool_return(&type->nodepool, node);
            return prev;
        }
    }

    memset(&node->trx_label, 0, sizeof(node->trx_label));
#if 0
    node->expire = 0;
#endif
    selva_fields_init(&type->ns.fields_schema, &node->fields);

    type->nr_nodes++;
    if (!type->max_node || type->max_node->node_id < node_id) {
        type->max_node = node;
    }

    return node;
}

struct SelvaNode *selva_min_node(struct SelvaTypeEntry *type)
{
    return RB_MIN(SelvaNodeIndex, &type->nodes);
}

struct SelvaNode *selva_max_node(struct SelvaTypeEntry *type)
{
    return RB_MAX(SelvaNodeIndex, &type->nodes);
}

struct SelvaNode *selva_prev_node(struct SelvaTypeEntry *type __unused, struct SelvaNode *node)
{
    return RB_PREV(SelvaNodeIndex, &type->nodes, node);
}

struct SelvaNode *selva_next_node(struct SelvaTypeEntry *type __unused, struct SelvaNode *node)
{
    return RB_NEXT(SelvaNodeIndex, &type->nodes, node);
}

static struct SelvaTypeCursors *find_cursors(struct SelvaTypeEntry *type, node_id_t node_id)
{
    struct SelvaTypeCursors find = {
        .node_id = node_id,
    };

    return RB_FIND(SelvaTypeCursorsByNodeId, &type->cursors.by_node_id, &find);
}

static struct SelvaTypeCursors *create_cursors_struct(struct SelvaTypeEntry *type, node_id_t node_id)
{
        struct SelvaTypeCursors *cursors;

        cursors = selva_malloc(sizeof(*cursors));
        cursors->node_id = node_id;
        TAILQ_INIT(&cursors->head);
        RB_INSERT(SelvaTypeCursorsByNodeId, &type->cursors.by_node_id, cursors);

        return cursors;
}

/**
 * Inserts a cursor to the cursors by node_id map.
 */
static void selva_cursors_insert(struct SelvaTypeEntry *type, struct SelvaTypeCursor *cursor)
{
    node_id_t node_id = cursor->ptr->node_id;
    struct SelvaTypeCursors *cursors;

    cursors = find_cursors(type, node_id);
    if (!cursors) {
        cursors = create_cursors_struct(type, node_id);
    }

    TAILQ_INSERT_TAIL(&cursors->head, cursor, _entry_by_node_id);
}

static bool maybe_destroy_cursors(struct SelvaTypeEntry *type, struct SelvaTypeCursors *cursors)
{
    if (TAILQ_EMPTY(&cursors->head)) {
        RB_REMOVE(SelvaTypeCursorsByNodeId, &type->cursors.by_node_id, cursors);
        selva_free(cursors);
        return true;
    }

    return false;
}

/**
 * Remove cursor from cursors by node_id map.
 */
static void selva_cursors_remove(struct SelvaTypeEntry *type, struct SelvaTypeCursor *cursor)
{
    struct SelvaTypeCursors *old_cursors = cursor->cursors;

    cursor->cursors = NULL;
    TAILQ_REMOVE(&old_cursors->head, cursor, _entry_by_node_id);
    maybe_destroy_cursors(type, old_cursors);
}

/**
 * Move all cursors having old_node to new_node.
 * @param new_node can be NULL.
 */
static void selva_cursors_move_node(
        struct SelvaTypeEntry *type,
        struct SelvaNode * restrict old_node,
        struct SelvaNode * restrict new_node)
{
    assert(old_node);

    struct SelvaTypeCursors find_old = {
        .node_id = old_node->node_id,
    };
    struct SelvaTypeCursors *old_cursors;

    old_cursors = RB_FIND(SelvaTypeCursorsByNodeId, &type->cursors.by_node_id, &find_old);
    if (!old_cursors) {
        return;
    }
    assert(old_node != new_node);

    if (new_node) {
        assert(new_node->type == old_node->type);

        struct SelvaTypeCursors find_new = {
            .node_id = new_node->node_id,
        };
        struct SelvaTypeCursors *new_cursors;
        struct SelvaTypeCursor *cursor;

        new_cursors = RB_FIND(SelvaTypeCursorsByNodeId, &type->cursors.by_node_id, &find_new);
        if (!new_cursors) {
            new_cursors = create_cursors_struct(type, new_node->node_id);
        }

        TAILQ_FOREACH(cursor, &old_cursors->head, _entry_by_node_id) {
            cursor->ptr = new_node;
            cursor->cursors = new_cursors;
        }

        TAILQ_CONCAT(&new_cursors->head, &old_cursors->head, _entry_by_node_id);
    }

    maybe_destroy_cursors(type, old_cursors);
}

/**
 * Call this before deleting a node.
 */
static void selva_cursors_node_going_away(struct SelvaTypeEntry *type, struct SelvaNode *node)
{
    selva_cursors_move_node(type, node, selva_next_node(type, node));
}

static void selva_cursor_destroy(struct SelvaTypeEntry *type, struct SelvaTypeCursor *cursor)
{
    selva_cursors_remove(type, cursor);
    RB_REMOVE(SelvaTypeCursorById, &type->cursors.by_cursor_id, cursor);
    ida_free(type->cursors.ida, cursor->cursor_id);
    selva_free(cursor);
    type->cursors.nr_cursors--;
}

static void selva_destroy_all_cursors(struct SelvaTypeEntry *type)
{
    struct SelvaTypeCursor *cursor;
    struct SelvaTypeCursor *tmp;

    RB_FOREACH_SAFE(cursor, SelvaTypeCursorById, &type->cursors.by_cursor_id, tmp) {
        selva_cursor_destroy(type, cursor);
    }
}

cursor_id_t selva_cursor_new(struct SelvaTypeEntry *type, struct SelvaNode *node)
{
    struct SelvaTypeCursor *cursor = selva_malloc(sizeof(*cursor));

    assert(type->type == node->type);
    static_assert(sizeof(ida_t) >= sizeof(cursor_id_t));
    cursor->cursor_id = ida_alloc(type->cursors.ida);
    cursor->type = type->type;

    if (RB_INSERT(SelvaTypeCursorById, &type->cursors.by_cursor_id, cursor)) {
        db_panic("cursor_id already in use");
    }
    selva_cursors_insert(type, cursor);

    type->cursors.nr_cursors++;

    return cursor->cursor_id;
}

struct SelvaNode *selva_cursor_get(struct SelvaTypeEntry *type, cursor_id_t id)
{
    struct SelvaTypeCursor find = {
        .cursor_id = id,
    };
    struct SelvaTypeCursor *cursor;

    cursor = RB_FIND(SelvaTypeCursorById, &type->cursors.by_cursor_id, &find);
    return cursor ? cursor->ptr : NULL;
}

int selva_cursor_update(struct SelvaTypeEntry *type, cursor_id_t id, struct SelvaNode *node)
{
    struct SelvaTypeCursor find = {
        .cursor_id = id,
    };
    struct SelvaTypeCursor *cursor;

    cursor = RB_FIND(SelvaTypeCursorById, &type->cursors.by_cursor_id, &find);
    if (!cursor) {
        return SELVA_ENOENT;
    }

    assert(node && node->type == cursor->type);
    cursor->ptr = node;
    if (cursor->cursors) {
        selva_cursors_remove(type, cursor);
    }
    if (node) {
        selva_cursors_insert(type, cursor);
    }

    return 0;
}

void selva_cursor_del(struct SelvaTypeEntry *type, cursor_id_t id)
{
    struct SelvaTypeCursor find = {
        .cursor_id = id,
    };
    struct SelvaTypeCursor *cursor;

    cursor = RB_FIND(SelvaTypeCursorById, &type->cursors.by_cursor_id, &find);
    if (cursor) {
        selva_cursor_destroy(type, cursor);
    }
}

size_t selva_cursor_count(const struct SelvaTypeEntry *type)
{
    return type->cursors.nr_cursors;
}

size_t selva_node_count(const struct SelvaTypeEntry *type)
{
    return type->nr_nodes;
}

node_id_t selva_get_node_id(const struct SelvaNode *node)
{
    return node->node_id;
}

/**
 * Hash the aliases pointing to the given node.
 */
static void hash_aliases(selva_hash_state_t *hash_state, struct SelvaTypeEntry *type, node_id_t dest)
{
    for (size_t i = 0; i < type->nr_aliases; i++) {
        struct SelvaAliases *aliases = &type->aliases[i];
        const struct SelvaAlias *alias;
        struct SelvaAlias find = {
            .dest = dest,
        };

        alias = RB_FIND(SelvaAliasesByDest, &aliases->alias_by_dest, &find);
        while (alias) {
            const char *name = alias->name;
            size_t len = strlen(name);

            selva_hash_update(hash_state, name, len);
            alias = alias->next;
        }
    }
}

static void selva_node_hash_update_internal(struct SelvaTypeEntry *type, struct SelvaNode *node, selva_hash_state_t *tmp_hash_state)
{
    selva_hash128_t res;

    selva_hash_reset(tmp_hash_state);
    selva_fields_hash_update(tmp_hash_state, &type->ns.fields_schema, &node->fields);
    hash_aliases(tmp_hash_state, type, node->node_id);
    res = selva_hash_digest(tmp_hash_state);

    node->node_hash = res;
}

void selva_node_hash_update(struct SelvaTypeEntry *type, struct SelvaNode *node)
{
    selva_hash_state_t *hash_state = selva_hash_create_state();
    selva_node_hash_update_internal(type, node, hash_state);
    selva_hash_free_state(hash_state);
}

void selva_node_hash_update2(struct SelvaTypeEntry *type, struct SelvaNode *node, selva_hash_state_t *tmp_hash_state, selva_hash_state_t *hash_state)
{
    if (node->node_hash == 0) {
        selva_node_hash_update_internal(type, node, tmp_hash_state);
    }

    selva_hash_update(hash_state, &node->node_hash, sizeof(node->node_hash));
}


void selva_node_hash_clear(struct SelvaNode *node)
{
    node->node_hash = 0;
}

selva_hash128_t selva_node_hash_get(struct SelvaNode *node)
{
    return node->node_hash;
}

selva_hash128_t selva_node_hash_range(struct SelvaTypeEntry *type, node_id_t start, node_id_t end)
{
    selva_hash_state_t *hash_state = selva_hash_create_state();
    selva_hash_state_t *tmp_hash_state = selva_hash_create_state();
    selva_hash128_t res = 0;

    selva_hash_reset(hash_state);

    struct SelvaNode *node = selva_nfind_node(type, start);
    if (!node || node->node_id > end) {
        goto out;
    }

    do {
        selva_node_hash_update2(type, node, tmp_hash_state, hash_state);

        node = selva_next_node(type, node);
    } while (node && node->node_id <= end);

    res = selva_hash_digest(hash_state);

out:
    selva_hash_free_state(hash_state);
    selva_hash_free_state(tmp_hash_state);

    return res;
}

void selva_archive_type(struct SelvaTypeEntry *type)
{
    struct mempool *mempool = &type->nodepool;

    MEMPOOL_FOREACH_SLAB_BEGIN(pool) {
        mempool_pageout(mempool, slab);
    } MEMPOOL_FOREACH_CHUNK_END();
}

void selva_prefetch_type(struct SelvaTypeEntry *type)
{
    struct mempool *mempool = &type->nodepool;

    MEMPOOL_FOREACH_SLAB_BEGIN(pool) {
        mempool_pagein(mempool, slab);
    } MEMPOOL_FOREACH_CHUNK_END();
}

