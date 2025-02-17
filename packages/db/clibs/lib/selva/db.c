/*
 * Copyright (c) 2024-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include <sys/mman.h>
#include "jemalloc_selva.h"
#include "selva/align.h"
#include "selva/fields.h"
#include "selva/selva_hash128.h"
#include "queue.h"
#include "selva_error.h"
#include "schema.h"
#include "ida.h"
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

static struct SelvaTypeBlocks *alloc_blocks(size_t block_capacity)
#if __clang__
    __attribute__((malloc, returns_nonnull));
#else
    __attribute__((malloc, malloc(selva_free), returns_nonnull));
#endif
static struct SelvaTypeBlock *get_block(struct SelvaTypeBlocks *blocks, node_id_t node_id) __attribute__((returns_nonnull));

static void selva_cursors_node_going_away(struct SelvaTypeEntry *type, struct SelvaNode *node);
static void selva_destroy_all_cursors(struct SelvaTypeEntry *type);

RB_PROTOTYPE_STATIC(SelvaTypeCursorById, SelvaTypeCursor, _entry_by_id, SelvaTypeCursor_cmp)
RB_PROTOTYPE_STATIC(SelvaTypeCursorsByNodeId, SelvaTypeCursors, _entry_by_node_id, SelvaTypeCursors_cmp)

RB_GENERATE(SelvaNodeIndex, SelvaNode, _index_entry, SelvaNode_cmp)
RB_GENERATE_STATIC(SelvaTypeCursorById, SelvaTypeCursor, _entry_by_id, SelvaTypeCursor_cmp)
RB_GENERATE_STATIC(SelvaTypeCursorsByNodeId, SelvaTypeCursors, _entry_by_node_id, SelvaTypeCursors_cmp)
RB_GENERATE(SelvaAliasesByName, SelvaAlias, _entry1, SelvaAlias_cmp_name)
RB_GENERATE(SelvaAliasesByDest, SelvaAlias, _entry2, SelvaAlias_cmp_dest)

void selva_expire_node(struct SelvaDb *db, node_type_t type, node_id_t node_id, int64_t ts)
{
    struct SelvaDbExpireToken *token = selva_calloc(1, sizeof(*token));

    token->token.expire = ts;
    token->db = db;
    token->type = type;
    token->node_id = node_id;

    selva_expire_insert(&db->expiring, &token->token);
}

static bool node_expire_cmp(struct SelvaExpireToken *tok, selva_expire_cmp_arg_t arg)
{
    struct SelvaDbExpireToken *token = containerof(tok, typeof(*token), token);
    node_type_t type = (node_type_t)(arg.v >> 32);
    node_id_t node_id = (uint32_t)(arg.v & 0xFFFFFFFF);

    return type == token->type && node_id == token->node_id;
}

void selva_expire_node_cancel(struct SelvaDb *db, node_type_t type, node_id_t node_id)
{
    selva_expire_remove(&db->expiring, node_expire_cmp, (uint64_t)node_id | ((uint64_t)type << 32));
}

static void expire_cb(struct SelvaExpireToken *tok)
{
    struct SelvaDbExpireToken *token = containerof(tok, typeof(*token), token);
    struct SelvaTypeEntry *te;
    struct SelvaNode *node;

    te = selva_get_type_by_index(token->db, token->type);
    assert(te);
    node = selva_find_node(te, token->node_id);
    if (node) {
        selva_del_node(token->db, te, node);
    }

    selva_free(token);
}

static void cancel_cb(struct SelvaExpireToken *tok)
{
    struct SelvaDbExpireToken *token = containerof(tok, typeof(*token), token);

    selva_free(token);
}

void selva_db_expire_tick(struct SelvaDb *db, int64_t now)
{
    selva_expire_tick(&db->expiring, now);
}

struct SelvaDb *selva_db_create(void)
{
    struct SelvaDb *db = selva_calloc(1, sizeof(*db));

    SVector_Init(&db->type_list, 1, SVector_SelvaTypeEntry_compare);
    ref_save_map_init(&db->schema.ref_save_map);
    db->expiring.expire_cb = expire_cb;
    db->expiring.cancel_cb = cancel_cb;
    selva_expire_init(&db->expiring);

    return db;
}

/**
 * Delete all nodes under this type.
 */
static void del_all_nodes(struct SelvaDb *db, struct SelvaTypeEntry *type)
{
    struct SelvaTypeBlocks *blocks = type->blocks;
    block_id_t blocks_len = blocks->len;

    for (block_id_t block_i = 0; block_i < blocks_len; block_i++) {
        struct SelvaNodeIndex *nodes = &blocks->blocks[block_i].nodes;
        struct SelvaNode *node;
        struct SelvaNode *tmp;

        RB_FOREACH_SAFE(node, SelvaNodeIndex, nodes, tmp) {
            selva_del_node(db, type, node);
        }
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
    selva_free(type->blocks);
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

    SVector_Clone(&types_copy, &db->type_list, nullptr);
    SVector_ForeachBegin(&it, &types_copy);
    while ((type = vecptr2SelvaTypeEntry(SVector_Foreach(&it)))) {
        del_type(db, type);
    }
}

void selva_db_destroy(struct SelvaDb *db)
{
    del_all_types(db);
    ref_save_map_destroy(&db->schema.ref_save_map);
    selva_expire_deinit(&db->expiring);
    memset(db, 0, sizeof(*db));
    selva_free(db);
}

static bool eq_type_exists(struct SelvaDb *db, node_type_t type, const char *schema_buf, size_t schema_len)
{
    struct SelvaTypeEntry *te;

    te = selva_get_type_by_index(db, type);
    return (te && te->schema_len == schema_len && !memcmp(te->schema_buf, schema_buf, schema_len));
}

static struct SelvaTypeBlocks *alloc_blocks(size_t block_capacity)
{
    assert(block_capacity >= 2);
    size_t nr_blocks = 4294967295ull / block_capacity;
    struct SelvaTypeBlocks *blocks = selva_aligned_alloc(alignof(*blocks), sizeof_wflex(typeof(*blocks), blocks, nr_blocks));

    blocks->block_capacity = block_capacity;
    blocks->len = nr_blocks;

    for (size_t i = 0; i < nr_blocks; i++) {
        RB_INIT(&blocks->blocks[i].nodes);
    }

    return blocks;
}

static block_id_t node_id2block_i(const struct SelvaTypeBlocks *blocks, node_id_t node_id)
{
    assert(node_id > 0);
    return ((node_id - 1) - ((node_id - 1) % blocks->block_capacity)) / blocks->block_capacity;
}

static struct SelvaTypeBlock *get_block(struct SelvaTypeBlocks *blocks, node_id_t node_id)
{
    const size_t block_i = node_id2block_i(blocks, node_id);

    /*
     * Buffer overflow is impossible because blocks is always allocated to the
     * absolute maximum number of nodes a type can contain.
     */
    assert(block_i < blocks->len);

    return &blocks->blocks[block_i];
}

int selva_db_schema_create(struct SelvaDb *db, node_type_t type, const char *schema_buf, size_t schema_len)
{
    struct schema_info nfo;
    const size_t te_ns_max_size = (sizeof(struct SelvaTypeEntry) - offsetof(struct SelvaTypeEntry, ns) - sizeof(struct SelvaTypeEntry){0}.ns);
    int err;

    if (eq_type_exists(db, type, schema_buf, schema_len)) {
        return SELVA_EEXIST;
    }

    err = schemabuf_get_info(&nfo, schema_buf, schema_len);
    if (err) {
        return err;
    }

    if (nfo.block_capacity == 0) {
        return SELVA_EINVAL;
    }

    if (nfo.nr_fields * sizeof(struct SelvaFieldSchema) > te_ns_max_size) {
        /* schema too large. */
        return SELVA_ENOBUFS;
    }

    struct SelvaTypeEntry *te = selva_aligned_alloc(alignof(*te), sizeof(*te));
    memset(te, 0, sizeof(*te) - te_ns_max_size + nfo.nr_fields * sizeof(struct SelvaFieldSchema));

    te->type = type;
    te->schema_buf = schema_buf;
    te->schema_len = schema_len;
    err = schemabuf_parse_ns(db, &te->ns, schema_buf, schema_len);
    if (err) {
        selva_free(te);
        return err;
    }

    te->blocks = alloc_blocks(nfo.block_capacity);
    selva_init_aliases(te);

    const size_t node_size = sizeof_wflex(struct SelvaNode, fields.fields_map, nfo.nr_fields);
    mempool_init2(&te->nodepool, NODEPOOL_SLAB_SIZE, node_size, alignof(size_t), MEMPOOL_ADV_RANDOM | MEMPOOL_ADV_HP_SOFT);

#if 0
    struct mempool_slab_info slab_info = mempool_slab_info(&te->nodepool);

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
        return nullptr;
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
        return nullptr;
    }

    return selva_get_fs_by_ns_field(&type->ns, field);
}

enum SelvaFieldType selva_get_fs_type(const struct SelvaFieldSchema *fs)
{
    return fs->type;
}

const struct EdgeFieldConstraint *selva_get_edge_field_constraint(const struct SelvaFieldSchema *fs)
{
    return (fs->type == SELVA_FIELD_TYPE_REFERENCE || fs->type == SELVA_FIELD_TYPE_REFERENCES)
        ? &fs->edge_constraint
        : nullptr;
}

const struct SelvaFieldsSchema *selva_get_edge_field_fields_schema(struct SelvaDb *db, const struct EdgeFieldConstraint *efc)
{
    struct SelvaFieldsSchema *schema;

    schema = efc->_fields_schema;
    if (!schema && !(efc->flags & EDGE_FIELD_CONSTRAINT_FLAG_SCHEMA_REF_CACHED)) {
        /*
         * Schema not found on this side, try the dst_type.
         * TODO It would be nice to share the pointer.
         */
        struct SelvaTypeEntry *type_dst;
        const struct SelvaFieldSchema *dst_fs;

        type_dst = selva_get_type_by_index(db, efc->dst_node_type);
        dst_fs = selva_get_fs_by_ns_field(&type_dst->ns, efc->inverse_field);
        assert(dst_fs->type == SELVA_FIELD_TYPE_REFERENCE || dst_fs->type == SELVA_FIELD_TYPE_REFERENCES);
        schema = dst_fs->edge_constraint._fields_schema;

        /**
         * Cache the result.
         * RFE This is not very optimal and nice way to do this but currently
         * it's not very easy to prepare these links in schemabuf_parse_ns()
         * because the type lookup svector is not built there and it's
         * likely incomplete until all types have been created.
         * The flag can be safely set here even if `schema` is nullptr to
         * speed up future lookups.
         */
        struct EdgeFieldConstraint *efcm = (struct EdgeFieldConstraint *)efc;
        efcm->_fields_schema = schema;
        efcm->flags |= EDGE_FIELD_CONSTRAINT_FLAG_SCHEMA_REF_CACHED;
    }

    return schema;
}

void selva_del_node(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node)
{
    struct SelvaTypeBlock *block = get_block(type->blocks, node->node_id);
    struct SelvaNodeIndex *nodes = &block->nodes;

    selva_remove_all_aliases(type, node->node_id);
    selva_cursors_node_going_away(type, node);
    RB_REMOVE(SelvaNodeIndex, nodes, node);
    if (node == type->max_node) {
        type->max_node = selva_max_node(type);
    }

    selva_fields_destroy(db, node);
#if 0
    memset(node, 0, sizeof_wflex(struct SelvaNode, fields.fields_map, type->ns.nr_fields));
#endif
    mempool_return(&type->nodepool, node);
    type->nr_nodes--;
}

struct SelvaNode *selva_find_node(struct SelvaTypeEntry *type, node_id_t node_id)
{
    struct SelvaTypeBlock *block = get_block(type->blocks, node_id);
    struct SelvaNodeIndex *nodes = &block->nodes;
    struct SelvaNode find = {
        .node_id = node_id,
    };

    return RB_FIND(SelvaNodeIndex, nodes, &find);
}

struct SelvaNode *selva_nfind_node(struct SelvaTypeEntry *type, node_id_t node_id)
{
    struct SelvaTypeBlock *block = get_block(type->blocks, node_id);
    struct SelvaNodeIndex *nodes = &block->nodes;
    struct SelvaNode find = {
        .node_id = node_id,
    };

    return RB_NFIND(SelvaNodeIndex, nodes, &find);
}

struct SelvaNode *selva_upsert_node(struct SelvaTypeEntry *type, node_id_t node_id)
{
    block_id_t block_i = node_id2block_i(type->blocks, node_id);
    struct SelvaNodeIndex *nodes = &type->blocks->blocks[block_i].nodes;
    struct SelvaNode *node = mempool_get(&type->nodepool);

    assert(node_id != 0);

    node->node_id = node_id;
    node->type = type->type;

    if (type->max_node &&type->max_node->node_id < node_id &&
        node_id2block_i(type->blocks, type->max_node->node_id) == block_i) {
        /*
         * We can assume that node_id almost always grows monotonically.
         */
        RB_INSERT_NEXT(SelvaNodeIndex, nodes, type->max_node, node);
    } else {
        struct SelvaNode *prev;

        prev = RB_INSERT(SelvaNodeIndex, nodes, node);
        if (prev) {
            mempool_return(&type->nodepool, node);
            return prev;
        }
    }

    memset(&node->trx_label, 0, sizeof(node->trx_label));
    selva_fields_init(&type->ns.fields_schema, &node->fields);

    type->nr_nodes++;
    if (!type->max_node || type->max_node->node_id < node_id) {
        type->max_node = node;
    }

    return node;
}

/**
 * Find the min node starting from block `start`.
 */
static struct SelvaNode *selva_min_node_from(struct SelvaTypeEntry *type, block_id_t start)
{
    struct SelvaTypeBlocks *blocks = type->blocks;
    const size_t len = blocks->len;

    for (size_t i = start; i < len; i++) {
        struct SelvaTypeBlock *block = &blocks->blocks[i];
        struct SelvaNode *node;

        node = RB_MIN(SelvaNodeIndex, &block->nodes);
        if (node) {
            return node;
        }
    }

    return nullptr;
}

struct SelvaNode *selva_min_node(struct SelvaTypeEntry *type)
{
    return selva_min_node_from(type, 0);
}

/**
 * Find the max node starting from block `start`.
 */
static struct SelvaNode *selva_max_node_from(struct SelvaTypeEntry *type, block_id_t start)
{
    struct SelvaTypeBlocks *blocks = type->blocks;

    for (ssize_t i = start; i >= 0; i--) {
        struct SelvaTypeBlock *block = &blocks->blocks[i];
        struct SelvaNode *node;

        node = RB_MAX(SelvaNodeIndex, &block->nodes);
        if (node) {
            return node;
        }
    }

    return nullptr;
}

struct SelvaNode *selva_max_node(struct SelvaTypeEntry *type)
{
    return selva_max_node_from(type, type->blocks->len - 1);
}

struct SelvaNode *selva_prev_node(struct SelvaTypeEntry *type, struct SelvaNode *node)
{
    const struct SelvaTypeBlocks *blocks = type->blocks;
    struct SelvaNode *prev;

    prev = RB_PREV(SelvaNodeIndex, &blocks->blocks[i].nodes, node);
    if (prev) {
        return prev;
    }

    block_id_t i = node_id2block_i(blocks, node->node_id);
    if ( i > 0 && i - 1 < i) {
        return selva_max_node_from(type, i - 1);
    }

    return nullptr;
}

struct SelvaNode *selva_next_node(struct SelvaTypeEntry *type, struct SelvaNode *node)
{
    const struct SelvaTypeBlocks *blocks = type->blocks;
    struct SelvaNode *next;

    next = RB_NEXT(SelvaNodeIndex, &block->nodes, node);
    if (next) {
        return next;
    }

    block_id_t i_next = node_id2block_i(blocks, node->node_id) + 1;
    if (i_next < blocks->len) {
        return selva_min_node_from(type, i_next);
    }

    return nullptr;
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

    cursor->cursors = nullptr;
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
    return cursor ? cursor->ptr : nullptr;
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
    selva_cursors_insert(type, cursor);

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
    for (size_t i = 0; i < type->ns.nr_aliases; i++) {
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

selva_hash128_t selva_node_hash_update(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node, selva_hash_state_t *tmp_hash_state)
{
    selva_hash128_t res;

    selva_hash_reset(tmp_hash_state);
    selva_fields_hash_update(tmp_hash_state, db, &type->ns.fields_schema, &node->fields);
    hash_aliases(tmp_hash_state, type, node->node_id);
    res = selva_hash_digest(tmp_hash_state);

    return res;
}

selva_hash128_t selva_node_hash_update2(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node)
{
    selva_hash128_t res;

    selva_hash_state_t *hash_state = selva_hash_create_state();
    res = selva_node_hash_update(db, type, node, hash_state);
    selva_hash_free_state(hash_state);

    return res;
}

selva_hash128_t selva_node_hash_range(struct SelvaDb *db, struct SelvaTypeEntry *type, node_id_t start, node_id_t end)
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
        selva_hash128_t node_hash = selva_node_hash_update(db, type, node, tmp_hash_state);
        selva_hash_update(hash_state, &node_hash, sizeof(node_hash));

        node = selva_next_node(type, node);
    } while (node && node->node_id <= end);

    res = selva_hash_digest(hash_state);

out:
    selva_hash_free_state(hash_state);
    selva_hash_free_state(tmp_hash_state);

    return res;
}
