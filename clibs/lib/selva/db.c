/*
 * Copyright (c) 2024-2026 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <sys/mman.h>
#include <unistd.h>
#include "jemalloc_selva.h"
#include "selva/align.h"
#include "selva/fields.h"
#include "selva/selva_hash128.h"
#include "selva/colvec.h"
#include "queue.h"
#include "selva_error.h"
#include "schema.h"
#include "db_panic.h"
#include "io.h"
#include "db.h"

static constexpr uint64_t NODEPOOL_SLAB_SIZE = 2097152;

static void selva_unl_node(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node);

static struct SelvaTypeBlocks *alloc_blocks(size_t block_capacity)
#ifdef __clang__
    __attribute__((malloc, returns_nonnull));
#else
    __attribute__((malloc, malloc(selva_free), returns_nonnull));
#endif


static inline int node_id_cmp(node_id_t a, node_id_t b)
{
    return a < b ? -1 : a > b ? 1 : 0;
}

__attribute__((nonnull))
int SelvaNode_cmp(const struct SelvaNode *a, const struct SelvaNode *b)
{
    return node_id_cmp(a->node_id, b->node_id);
}

__attribute__((nonnull))
int SelvaAlias_cmp_name(const struct SelvaAlias *a, const struct SelvaAlias *b)
{
    if (a->name_len == b->name_len) {
        return memcmp(a->name, b->name, a->name_len);
    } else if (a->name_len < b->name_len) {
        return '\0' - b->name[b->name_len - 1];
    } else {
        return a->name[a->name_len - 1] - '\0';
    }
}

__attribute__((nonnull))
int SelvaAlias_cmp_dest(const struct SelvaAlias *a, const struct SelvaAlias *b)
{
    return node_id_cmp(a->dest, b->dest);
}

__attribute__((nonnull))
static int SelvaTypeEntry_cmp(const struct SelvaTypeEntry *a, const struct SelvaTypeEntry *b)
{
    return (int)((struct SelvaTypeEntryFind *)a)->type - (int)((struct SelvaTypeEntryFind *)b)->type;
}

RB_GENERATE(SelvaTypeEntryIndex, SelvaTypeEntry, _entry, SelvaTypeEntry_cmp)
RB_GENERATE(SelvaNodeIndex, SelvaNode, _index_entry, SelvaNode_cmp)
RB_GENERATE(SelvaAliasesByName, SelvaAlias, _entry1, SelvaAlias_cmp_name)
RB_GENERATE(SelvaAliasesByDest, SelvaAlias, _entry2, SelvaAlias_cmp_dest)

static bool node_expire_cmp(struct SelvaExpireToken *tok, selva_expire_cmp_arg_t arg)
{
    struct SelvaDbExpireToken *token = containerof(tok, typeof(*token), token);
    node_type_t type = (node_type_t)(arg.v >> 32);
    node_id_t node_id = (uint32_t)(arg.v & 0xFFFFFFFF);

    return type == token->type && node_id == token->node_id;
}

static bool node_expire_exists(struct SelvaDb *db, node_type_t type, node_id_t node_id)
{
    return selva_expire_exists(&db->expiring, node_expire_cmp, (uint64_t)node_id | ((uint64_t)type << 32));
}

void selva_expire_node(struct SelvaDb *db, node_type_t type, node_id_t node_id, int64_t ts, enum selva_expire_node_strategy stg)
{
    struct SelvaDbExpireToken *token;

    switch (stg) {
    case SELVA_EXPIRE_NODE_STRATEGY_IGNORE:
        break;
    case SELVA_EXPIRE_NODE_STRATEGY_CANCEL:
        if (node_expire_exists(db, type, node_id)) {
            return;
        }
        break;
    case SELVA_EXPIRE_NODE_STRATEGY_CANCEL_OLD:
        /* TODO This will currently only cancel one previous hit. */
        selva_expire_node_cancel(db, type, node_id);
        break;
    }

    token = selva_calloc(1, sizeof(*token));
    token->token.expire = ts;
    token->db = db;
    token->type = type;
    token->node_id = node_id;

    selva_expire_insert(&db->expiring, &token->token);
}

void selva_expire_node_cancel(struct SelvaDb *db, node_type_t type, node_id_t node_id)
{
    selva_expire_remove(&db->expiring, node_expire_cmp, (uint64_t)node_id | ((uint64_t)type << 32));
}

static void expire_cb(struct SelvaExpireToken *tok, void *ctx)
{
    struct SelvaDbExpireToken *token = containerof(tok, typeof(*token), token);
    struct SelvaTypeEntry *te;
    struct SelvaNodeRes res;

    te = selva_get_type_by_index(token->db, token->type);
    assert(te);
    res = selva_find_node(te, token->node_id);
    if (res.node) {
        /* TODO What if the node is on FS but it's expiring */
        selva_del_node(token->db, te, res.node);
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
    selva_expire_tick(&db->expiring, nullptr, now);
}


static uint32_t te_slab_size(void)
{
    const size_t te_size = sizeof(struct SelvaTypeEntry);
    uint32_t slab_size = (1'048'576 / te_size) * te_size;

    slab_size--;
    slab_size |= slab_size >> 1;
    slab_size |= slab_size >> 2;
    slab_size |= slab_size >> 4;
    slab_size |= slab_size >> 8;
    slab_size |= slab_size >> 16;
    slab_size++;

    return slab_size;
}

struct SelvaDb *selva_db_create(void)
{
    struct SelvaDb *db = selva_calloc(1, sizeof(*db));

    mempool_init(&db->types.pool, te_slab_size(), sizeof(struct SelvaTypeEntry), alignof(struct SelvaTypeEntry));
    db->expiring.expire_cb = expire_cb;
    db->expiring.cancel_cb = cancel_cb;
    db->dirfd = AT_FDCWD;
    selva_expire_init(&db->expiring);

    return db;
}

int selva_db_chdir(struct SelvaDb *db, const char *pathname_str, size_t pathname_len)
{
    char buf[pathname_len + 1];
    int fd;

    memcpy(buf, pathname_str, pathname_len);
    buf[pathname_len] = '\0';

    if (db->dirfd != AT_FDCWD) {
        close(db->dirfd);
    }

    fd = open(buf, O_SEARCH | O_DIRECTORY | O_CLOEXEC);
    if (fd == -1) {
        return SELVA_EIO;
    }

    db->dirfd = fd;
    return 0;
}

/**
 * Delete all nodes of a block.
 * Pretty safe as long as block_i is within the range.
 */
static inline void selva_del_block_unsafe(struct SelvaDb *db, struct SelvaTypeEntry *te, block_id_t block_i, bool unload)
{
    struct SelvaNodeIndex *nodes = &te->blocks->blocks[block_i].nodes;
    struct SelvaNode *node;
    struct SelvaNode *tmp;

    RB_FOREACH_SAFE(node, SelvaNodeIndex, nodes, tmp) {
        if (unload) {
            selva_unl_node(db, te, node);
        } else {
            /* TODO Presumably this block shouldn't be marked dirty?. */
            selva_del_node(db, te, node);
        }
    }
}

void selva_del_block(struct SelvaDb *db, struct SelvaTypeEntry *te, node_id_t start)
{
    const size_t block_i = selva_node_id2block_i(te->blocks, start);

    selva_del_block_unsafe(db, te, block_i, true);
}

/**
 * Delete all nodes under this type.
 */
static void del_all_nodes(struct SelvaDb *db, struct SelvaTypeEntry *te)
{
    struct SelvaTypeBlocks *blocks = te->blocks;
    block_id_t blocks_len = blocks->len;

    for (block_id_t block_i = 0; block_i < blocks_len; block_i++) {
        selva_del_block_unsafe(db, te, block_i, false);
    }
}

static inline void clear_type(struct SelvaDb *db, struct SelvaTypeEntry *te)
{
    del_all_nodes(db, te);
}

static void destroy_type(struct SelvaDb *db, struct SelvaTypeEntry *te)
{
    /*
     * We assume that as the nodes are deleted the aliases are also freed.
     * The following function will just free te->aliases.
     */
    selva_destroy_aliases(te);

    colvec_deinit_te(te);

    /*
     * Remove this type from the type list.
     */
    RB_REMOVE(SelvaTypeEntryIndex, &db->types.index, te);

    mempool_destroy(&te->nodepool);
    selva_free(te->blocks);
    schemabuf_deinit_fields_schema(&te->ns.fields_schema);
#if 0
    memset(te, 0, sizeof(*te));
#endif
    selva_free(te->schema_buf);
    mempool_return(&db->types.pool, te);
    db->types.count--;
}

static void del_all_types(struct SelvaDb *db)
{
    struct SelvaTypeEntry *te;
    struct SelvaTypeEntry *tmp;

    RB_FOREACH_SAFE(te, SelvaTypeEntryIndex, &db->types.index, tmp) {
        clear_type(db, te);
    }

    RB_FOREACH_SAFE(te, SelvaTypeEntryIndex, &db->types.index, tmp) {
        destroy_type(db, te);
    }
}

void selva_db_destroy(struct SelvaDb *db)
{
    del_all_types(db);
    selva_expire_deinit(&db->expiring);
#if 0
    memset(db, 0, sizeof(*db));
#endif
    if (db->dirfd != AT_FDCWD) {
        close(db->dirfd);
    }
    selva_free(db);
}

static bool eq_type_exists(struct SelvaDb *db, node_type_t type, const uint8_t *schema_buf, size_t schema_len)
{
    struct SelvaTypeEntry *te;

    te = selva_get_type_by_index(db, type);
    return (te && te->schema_len == schema_len && !memcmp(te->schema_buf, schema_buf, schema_len));
}

/**
 * Alloc .blocks in a type entry.
 */
static struct SelvaTypeBlocks *alloc_blocks(size_t block_capacity)
{
    assert(block_capacity >= 2);
    size_t nr_blocks = 4294967295ull / block_capacity;
    struct SelvaTypeBlocks *blocks = selva_aligned_alloc(alignof(*blocks), sizeof_wflex(typeof(*blocks), blocks, nr_blocks));

    blocks->block_capacity = block_capacity;
    blocks->len = nr_blocks;

    /*
     * We assume that clearing the memory results the correct initialized state.
     */
    memset(&blocks->blocks, 0, nr_blocks * sizeof(struct SelvaTypeBlock));

    return blocks;
}

struct SelvaTypeBlock *selva_get_block(struct SelvaTypeBlocks *blocks, node_id_t node_id)
{
    const size_t block_i = selva_node_id2block_i(blocks, node_id);

    /*
     * Buffer overflow is impossible because blocks is always allocated to the
     * absolute maximum number of nodes a type can contain.
     */
    assert(block_i < blocks->len);

    return &blocks->blocks[block_i];
}

void selva_foreach_block(struct SelvaDb *db, enum SelvaTypeBlockStatus or_mask, void (*cb)(void *ctx, struct SelvaDb *db, struct SelvaTypeEntry *te, block_id_t block, node_id_t start), void *ctx)
{
    struct SelvaTypeEntry *te;

    RB_FOREACH(te, SelvaTypeEntryIndex, &db->types.index) {
        struct SelvaTypeBlocks *blocks = te->blocks;

        for (block_id_t block_i = 0; block_i < blocks->len; block_i++) {
            struct SelvaTypeBlock *block = &blocks->blocks[block_i];

            /*
             * Note that we call it or_mask because the cb() is called if any
             * bit of the mask is set in the status.
             */
            if (atomic_load_explicit(&block->status.atomic, memory_order_consume) & or_mask) {
                cb(ctx, db, te, block_i, selva_block_i2start(te, block_i));
            }
        }
    }
}

static void clone_schema_buf(struct SelvaTypeEntry *te, const uint8_t *schema_buf, size_t schema_len)
{
    te->schema_buf = selva_malloc(schema_len);
    memcpy(te->schema_buf, schema_buf, schema_len);
    te->schema_len = schema_len;
}

int selva_db_create_type(struct SelvaDb *db, node_type_t type, const uint8_t *schema_buf, size_t schema_len)
{
    struct schema_info nfo;
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

    if (nfo.nr_fields > SELVA_FIELDS_MAX) {
        /* schema too large. */
        return SELVA_ENOBUFS;
    }

    struct SelvaTypeEntry *te = mempool_get(&db->types.pool);

#if 0
    fprintf(stderr, "schema_buf: [ ");
    for (size_t i = 0; i < schema_len; i++) {
        fprintf(stderr, "%x, ", schema_buf[i]);
    }
    fprintf(stderr, "]\n");
#endif

    memset(te, 0, sizeof(*te));
    te->type = type;
    err = schemabuf_parse_ns(&te->ns, schema_buf, schema_len, db->sdb_version ?: SELVA_SDB_VERSION);
    if (err) {
        mempool_return(&db->types.pool, te);
        return err;
    }

    clone_schema_buf(te, schema_buf, schema_len);
    te->blocks = alloc_blocks(nfo.block_capacity);
    selva_init_aliases(te);
    colvec_init_te(te);

    const size_t node_size = sizeof_wflex(struct SelvaNode, fields.fields_map, nfo.nr_fields);
    mempool_init2(&te->nodepool, NODEPOOL_SLAB_SIZE, node_size, alignof(size_t), MEMPOOL_ADV_RANDOM | MEMPOOL_ADV_HP_SOFT);

    if (RB_INSERT(SelvaTypeEntryIndex, &db->types.index, te)) {
        db_panic("Schema update not supported");
    }
    db->types.count++;
    return 0;
}

struct SelvaTypeEntry *selva_get_type_by_index(const struct SelvaDb *db, node_type_t type)
{
    struct SelvaTypeEntryFind find = { type };

    if (type == 0) {
        return nullptr;
    }

    return RB_FIND(SelvaTypeEntryIndex, (typeof_unqual(db->types.index) *)&db->types.index, (struct SelvaTypeEntry *)&find);
}

struct SelvaTypeEntry *selva_get_type_by_node(const struct SelvaDb *db, struct SelvaNode *node)
{
    struct SelvaTypeEntryFind find = { node->type };
    struct SelvaTypeEntry *te;

    te = RB_FIND(SelvaTypeEntryIndex, (typeof_unqual(db->types.index) *)&db->types.index, (struct SelvaTypeEntry *)&find);
    assert(te);
    return te;
}

extern inline node_type_t selva_get_type(const struct SelvaTypeEntry *te);

extern inline block_id_t selva_get_block_capacity(const struct SelvaTypeEntry *te);

extern inline block_id_t selva_node_id2block_i(const struct SelvaTypeBlocks *blocks, node_id_t node_id);

extern inline block_id_t selva_node_id2block_i2(const struct SelvaTypeEntry *te, node_id_t node_id);

extern inline node_id_t selva_block_i2start(const struct SelvaTypeEntry *te, block_id_t block_i);

extern inline node_id_t selva_block_i2end(const struct SelvaTypeEntry *te, block_id_t block_i);

extern inline enum SelvaTypeBlockStatus selva_block_status_get(const struct SelvaTypeEntry *te, block_id_t block_i);

extern inline void selva_block_status_replace(const struct SelvaTypeEntry *te, block_id_t block_i, enum SelvaTypeBlockStatus status);

extern inline void selva_block_status_set(const struct SelvaTypeEntry *te, block_id_t block_i, enum SelvaTypeBlockStatus mask);

extern inline void selva_block_status_reset(const struct SelvaTypeEntry *te, block_id_t block_i, enum SelvaTypeBlockStatus mask);

extern inline bool selva_block_status_eq(const struct SelvaTypeEntry *te, block_id_t block_i, enum SelvaTypeBlockStatus mask);

extern inline const struct SelvaNodeSchema *selva_get_ns_by_te(const struct SelvaTypeEntry *te);

extern inline const struct SelvaFieldSchema *get_fs_by_fields_schema_field(const struct SelvaFieldsSchema *fields_schema, field_t field);

extern inline const struct SelvaFieldSchema *selva_get_fs_by_te_field(const struct SelvaTypeEntry *te, field_t field);

extern inline const struct SelvaFieldSchema *selva_get_fs_by_ns_field(const struct SelvaNodeSchema *ns, field_t field);

extern inline const struct SelvaFieldSchema *selva_get_fs_by_node(struct SelvaDb *db, struct SelvaNode *node, field_t field);

extern inline enum SelvaFieldType selva_get_fs_type(const struct SelvaFieldSchema *fs);

extern inline const struct EdgeFieldConstraint *selva_get_edge_field_constraint(const struct SelvaFieldSchema *fs);

extern inline const struct SelvaFieldsSchema *selva_get_edge_field_fields_schema(struct SelvaDb *db, const struct EdgeFieldConstraint *efc);

static inline void del_node(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node, bool unload)
{
    struct SelvaTypeBlock *block = selva_get_block(type->blocks, node->node_id);
    struct SelvaNodeIndex *nodes = &block->nodes;

    atomic_fetch_or_explicit(&block->status.atomic, (uint32_t)SELVA_TYPE_BLOCK_STATUS_DIRTY, memory_order_release);

    selva_remove_all_aliases(type, node->node_id);
    RB_REMOVE(SelvaNodeIndex, nodes, node);
    if (node == type->max_node) {
        /*
         * selva_max_node() is as fast as selva_prev_node().
         * TODO What if it hits partial!
         */
        type->max_node = selva_max_node(type).node;
    }

    if (unload) {
        selva_fields_unload(db, node);
    } else {
        selva_fields_destroy(db, node);
    }
#if 0
    memset(node, 0, sizeof_wflex(struct SelvaNode, fields.fields_map, type->ns.fields_schema.nr_fields));
#endif
    mempool_return(&type->nodepool, node);
    atomic_fetch_or_explicit(&block->status.atomic, (uint32_t)(SELVA_TYPE_BLOCK_STATUS_INMEM | SELVA_TYPE_BLOCK_STATUS_DIRTY), memory_order_release); /* TODO Is this needed?? */
    block->nr_nodes_in_block--;
    type->nr_nodes--;
}

void selva_del_node(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node)
{
    del_node(db, type, node, false);
}

static void selva_unl_node(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node)
{
    del_node(db, type, node, true);
}

void selva_flush_node(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node)
{
    selva_mark_dirty(type, node->node_id);

    selva_remove_all_aliases(type, node->node_id);
    selva_fields_flush(db, node);
}

void selva_mark_dirty(struct SelvaTypeEntry *te, node_id_t node_id)
{
    if (node_id > 0) {
        selva_block_status_set(te, selva_node_id2block_i2(te, node_id), SELVA_TYPE_BLOCK_STATUS_DIRTY);
    }
}

struct SelvaNodeRes selva_find_node(struct SelvaTypeEntry *type, node_id_t node_id)
{
    if (unlikely(node_id == 0)) {
        return (struct SelvaNodeRes){};
    }

    struct SelvaTypeBlocks *blocks = type->blocks;
    struct SelvaNodeRes res = {
        .block = selva_node_id2block_i(blocks, node_id),
    };

    struct SelvaTypeBlock *block = &blocks->blocks[res.block];
    res.block_status = atomic_load_explicit(&block->status.atomic, memory_order_acquire);
    if (!(res.block_status & SELVA_TYPE_BLOCK_STATUS_INMEM)) {
        goto out;
    }

    struct SelvaNodeIndex *nodes = &block->nodes;
    struct SelvaNode find = {
        .node_id = node_id,
    };

    res.node = RB_FIND(SelvaNodeIndex, nodes, &find);
out:
    return res;
}

struct SelvaNodeRes selva_nfind_node(struct SelvaTypeEntry *type, node_id_t node_id)
{
    struct SelvaTypeBlocks *blocks = type->blocks;
    struct SelvaNodeRes res = {
        .block = selva_node_id2block_i(blocks, node_id),
    };

    if (unlikely(node_id == 0)) {
        goto out;
    }

    struct SelvaTypeBlock *block = &blocks->blocks[res.block];
    res.block_status = atomic_load_explicit(&block->status.atomic, memory_order_acquire);
    if (!(res.block_status & SELVA_TYPE_BLOCK_STATUS_INMEM)) {
        goto out;
    }

    struct SelvaNodeIndex *nodes = &block->nodes;
    struct SelvaNode find = {
        .node_id = node_id,
    };

    res.node = RB_NFIND(SelvaNodeIndex, nodes, &find);
out:
    return res;
}

struct SelvaNodeRes selva_upsert_node(struct SelvaTypeEntry *type, node_id_t node_id)
{
    if (unlikely(node_id == 0)) {
        return (struct SelvaNodeRes){};
    }

    struct SelvaTypeBlocks *blocks = type->blocks;
    struct SelvaNodeRes res = {
        .block = selva_node_id2block_i(blocks, node_id),
    };

    struct SelvaTypeBlock *block = &blocks->blocks[res.block];
    res.block_status = atomic_load_explicit(&block->status.atomic, memory_order_acquire);
    constexpr enum SelvaTypeBlockStatus mask = SELVA_TYPE_BLOCK_STATUS_FS | SELVA_TYPE_BLOCK_STATUS_INMEM;
    if ((res.block_status & mask) == SELVA_TYPE_BLOCK_STATUS_FS) {
        /*
         * Note that this is tricky because we want to normally bail if the block
         * is only in fs to avoid creating two versions of the block (one in fs
         * and one in mem. However, we must be able to upsert while loading the
         * block. The trick is to set `SELVA_TYPE_BLOCK_STATUS_INMEM` before
         * upsert if the caller is loading.
         */
        goto out;
    }

    struct SelvaNode *node = mempool_get(&type->nodepool);

    node->node_id = node_id;
    node->type = type->type;

    if (type->max_node &&type->max_node->node_id < node_id &&
        selva_node_id2block_i2(type, type->max_node->node_id) == res.block) {
        /*
         * We can assume that node_id almost always grows monotonically.
         */
        RB_INSERT_NEXT(SelvaNodeIndex, &block->nodes, type->max_node, node);
    } else {
        struct SelvaNode *prev;

        prev = RB_INSERT(SelvaNodeIndex, &block->nodes, node);
        if (prev) {
            mempool_return(&type->nodepool, node);
            res.node = prev;
            goto out;
        }
    }

    selva_fields_init_node(type, node);

    atomic_fetch_or_explicit(&block->status.atomic, (uint32_t)(SELVA_TYPE_BLOCK_STATUS_INMEM | SELVA_TYPE_BLOCK_STATUS_DIRTY), memory_order_release);
    block->nr_nodes_in_block++;
    type->nr_nodes++;
    if (!type->max_node || type->max_node->node_id < node_id) {
        type->max_node = node;
    }

    res.node = node;
out:
    res.block_status = atomic_load_explicit(&block->status.atomic, memory_order_relaxed);
    return res;
}

/**
 * Find the min node starting from block `start`.
 */
static struct SelvaNodeRes selva_min_node_from(struct SelvaTypeEntry *type, block_id_t start)
{
    struct SelvaTypeBlocks *blocks = type->blocks;
    const size_t len = blocks->len;
    struct SelvaNodeRes res = {};

    for (size_t i = start; i < len; i++) {
        struct SelvaTypeBlock *block = &blocks->blocks[i];
        struct SelvaNode *node;

        res.block = i;
        res.block_status = atomic_load_explicit(&block->status.atomic, memory_order_acquire);
        if (!(res.block_status & SELVA_TYPE_BLOCK_STATUS_INMEM)) {
            break;
        }

        node = RB_MIN(SelvaNodeIndex, &block->nodes);
        if (node) {
            res.node = node;
            break;
        }
    }

    return res;
}

struct SelvaNodeRes selva_min_node(struct SelvaTypeEntry *type)
{
    return selva_min_node_from(type, 0);
}

/**
 * Find the max node starting from block `start`.
 */
static struct SelvaNodeRes selva_max_node_from(struct SelvaTypeEntry *type, block_id_t start)
{
    struct SelvaTypeBlocks *blocks = type->blocks;
    struct SelvaNodeRes res = {};

    for (ssize_t i = start; i >= 0; i--) {
        struct SelvaTypeBlock *block = &blocks->blocks[i];
        struct SelvaNode *node;

        res.block = i;
        res.block_status = atomic_load_explicit(&block->status.atomic, memory_order_acquire);
        if (!(res.block_status & SELVA_TYPE_BLOCK_STATUS_INMEM)) {
            break;
        }

        node = RB_MAX(SelvaNodeIndex, &block->nodes);
        if (node) {
            res.node = node;
            break;
        }
    }

    return res;
}

struct SelvaNodeRes selva_max_node(struct SelvaTypeEntry *type)
{
    return selva_max_node_from(type, type->blocks->len - 1);
}

/* FIXME This seems incorrect. What if also the previous block is empty but there is a prev on somewhere? */
struct SelvaNodeRes selva_prev_node(struct SelvaTypeEntry *type, struct SelvaNode *node)
{
    const struct SelvaTypeBlocks *blocks = type->blocks;
    struct SelvaNodeRes res = {
        .block = selva_node_id2block_i(blocks, node->node_id),
        .block_status = SELVA_TYPE_BLOCK_STATUS_INMEM,
    };
    struct SelvaNode *prev;

    /* We know it's always SELVA_TYPE_BLOCK_STATUS_INMEM */
#if 0
    res.block_status = atomic_load_explicit(&block->status.atomic, memory_order_acquire);
#endif

    prev = RB_PREV(SelvaNodeIndex, nullptr /* notused */, node);
    if (prev) {
        res.node = prev;
        goto out;
    }

    if ( res.block > 0 && res.block - 1 < res.block) {
        return selva_max_node_from(type, res.block - 1);
    }

out:
    return res;
}

struct SelvaNodeRes selva_next_node(struct SelvaTypeEntry *type, struct SelvaNode *node)
{
    const struct SelvaTypeBlocks *blocks = type->blocks;
    struct SelvaNodeRes res = {
        .block = selva_node_id2block_i(blocks, node->node_id),
        .block_status = SELVA_TYPE_BLOCK_STATUS_INMEM,
    };
    struct SelvaNode *next;

    next = RB_NEXT(SelvaNodeIndex, nullptr /* notused */, node);
    if (next) {
        res.node = next;
        return res;
    }

    block_id_t i_next = res.block + 1;
    if (i_next < blocks->len) {
        return selva_min_node_from(type, i_next);
    }

    return res;
}

size_t selva_node_count(const struct SelvaTypeEntry *type)
{
    return type->nr_nodes;
}

extern inline node_id_t selva_get_node_id(const struct SelvaNode *node);

extern inline node_type_t selva_get_node_type(const struct SelvaNode *node);

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

            selva_hash_update(hash_state, alias->name, alias->name_len);
            alias = alias->next;
        }
    }
}

static void hash_col_fields(struct SelvaTypeEntry *type, node_id_t node_id, selva_hash_state_t *tmp_hash_state)
{
    /*
     * colvec fields.
     */
    for (size_t i = 0; i < type->ns.nr_colvecs; i++) {
        struct SelvaColvec *colvec = &type->col_fields.colvec[i];

        colvec_hash_update(type, node_id, colvec, tmp_hash_state);
    }
}

selva_hash128_t selva_node_hash_update(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node, selva_hash_state_t *tmp_hash_state)
{
    selva_hash128_t res;

    selva_hash_reset(tmp_hash_state);
    selva_hash_update(tmp_hash_state, &node->node_id, sizeof(node->node_id));
    selva_fields_hash_update(tmp_hash_state, db, &type->ns.fields_schema, node);
    hash_aliases(tmp_hash_state, type, node->node_id);
    hash_col_fields(type, node->node_id, tmp_hash_state);
    res = selva_hash_digest(tmp_hash_state);

    return res;
}

selva_hash128_t selva_node_hash(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node)
{
    selva_hash128_t res;

    selva_hash_state_t *hash_state = selva_hash_create_state();
    res = selva_node_hash_update(db, type, node, hash_state);
    selva_hash_free_state(hash_state);

    return res;
}

void selva_node_block_hash2(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaTypeBlock *block, selva_hash128_t *hash_out)
{
    selva_hash_state_t *hash_state = selva_hash_create_state();
    selva_hash_state_t *tmp_hash_state = selva_hash_create_state();
    struct SelvaNode *node;

    selva_hash_reset(hash_state);

    RB_FOREACH(node, SelvaNodeIndex, &block->nodes) {
        selva_hash128_t node_hash = selva_node_hash_update(db, type, node, tmp_hash_state);
        selva_hash_update(hash_state, &node_hash, sizeof(node_hash));
    }

    *hash_out = selva_hash_digest(hash_state);
    selva_hash_free_state(hash_state);
    selva_hash_free_state(tmp_hash_state);
}

int selva_node_block_hash(struct SelvaDb *db, struct SelvaTypeEntry *type, node_id_t start, selva_hash128_t *hash_out)
{
    struct SelvaTypeBlock *block = selva_get_block(type->blocks, start);

    if (!block) {
        return SELVA_ENOENT;
    }

    selva_node_block_hash2(db, type, block, hash_out);

    return 0;
}
