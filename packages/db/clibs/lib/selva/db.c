/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <string.h>
#include "jemalloc.h"
#include "selva_object.h"
#include "selva.h"
#include "db.h"

#define NODEPOOL_SLAB_SIZE 33554432

RB_PROTOTYPE_STATIC(SelvaNodeIndex, SelvaNode, _index_entry, SelvaNode_Compare)
RB_PROTOTYPE_STATIC(SelvaTypeIndex, SelvaTypeEntry, _type_entry, SelvaTypeEntry_Compare);


static int SelvaNode_Compare(const struct SelvaNode *a, const struct SelvaNode *b)
{
    return a->node_id - b->node_id;
}

static int SelvaTypeEntry_Compare(const struct SelvaTypeEntry *a, const struct SelvaTypeEntry *b)
{
    return a->type - b->type;
}

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

    return a->node_id - b->node_id;
}

RB_GENERATE_STATIC(SelvaNodeIndex, SelvaNode, _index_entry, SelvaNode_Compare)
RB_GENERATE_STATIC(SelvaTypeIndex, SelvaTypeEntry, _type_entry, SelvaTypeEntry_Compare);

struct SelvaDb *db_create(void)
{
    struct SelvaDb *db = selva_calloc(1, sizeof(*db));

    RB_INIT(&db->types.index);
    SVector_Init(&db->expiring.list, 0, SVector_SelvaNode_expire_compare);
    db->expiring.next = SELVA_NODE_EXPIRE_NEVER;
    /* TODO Expiring nodes timer */
#if 0
    db->expiring.tim_id = evl_set_timeout(&hierarchy_expire_period, hierarchy_expire_tim_proc, hierarchy);
#endif
    mempool_init(&db->types.pool, 4096, sizeof(struct SelvaTypeEntry), alignof(struct SelvaTypeEntry));

    return db;
}

void db_destroy(struct SelvaDb *db)
{
    /* FIXME */
}

int db_schema_update(struct SelvaDb *db, const char *schema_buf, size_t schema_len)
{
    struct SelvaTypeEntry *e = selva_calloc(1, sizeof(*e));
    size_t fields_map_size = 0; /* FIXME */

    RB_INIT(&e->nodes);
    SelvaObject_Init(e->aliases._obj_data, 0);
    mempool_init(&e->nodepool, NODEPOOL_SLAB_SIZE, sizeof(struct SelvaNode) + fields_map_size, alignof(size_t));

    RB_INSERT(SelvaTypeIndex, &db->types.index, e);
    return 0;
}

struct SelvaTypeEntry *db_get_type_by_index(struct SelvaDb *db, node_type_t type)
{
    struct SelvaTypeEntry find = {
        .type = type,
    };

    return RB_FIND(SelvaTypeIndex, &db->types.index, &find);
}

static struct SelvaTypeEntry *get_type_by_node(struct SelvaDb *db, struct SelvaNode *node)
{
    struct SelvaTypeEntry find = {
        .type = node->type,
    };

    return RB_FIND(SelvaTypeIndex, &db->types.index, &find);
}

struct SelvaNodeSchema *db_get_ns_by_node(struct SelvaDb *db, struct SelvaNode *node)
{
    struct SelvaTypeEntry *e = get_type_by_node(db, node);
    return e ? e->ns : NULL;
}

struct SelvaFieldSchema *db_get_fs_by_ns(struct SelvaNodeSchema *ns, field_t field)
{
    if (field >= ns->nr_fields) {
        return NULL;
    }

    return &ns->field_schemas[field];
}

static struct SelvaFieldSchema *get_fs_by_node(struct SelvaDb *db, struct SelvaNode *node, field_t field)
{
    struct SelvaNodeSchema *ns;

    ns = db_get_ns_by_node(db, node);
    if (!ns) {
        return NULL;
    }

    return db_get_fs_by_ns(ns, field);
}

static struct SelvaNode *new_node(struct SelvaDb *db, struct SelvaTypeEntry *type, node_id_t id)
{
    struct SelvaNode *node = mempool_get(&type->nodepool);

    /* TODO Clean fields map */
    memset(node, 0, sizeof(*node));
    node->node_id = id;
    node->type = type->type;
    node->fields.nr_fields = 0; /* FIXME */

    RB_INSERT(SelvaNodeIndex, &type->nodes, node);
    return node;
}

void del_node(struct SelvaDb *db, struct SelvaNode *node)
{
    struct SelvaTypeEntry *e = get_type_by_node(db, node);

    RB_REMOVE(SelvaNodeIndex, &e->nodes, node);

    if (node->expire) {
        /* TODO clear expire */
    }

    /* TODO Destroy fields */
    mempool_return(&e->nodepool, node);
}

struct SelvaNode *db_get_node(struct SelvaDb *db, struct SelvaTypeEntry *type, node_id_t node_id, bool upsert)
{
    struct SelvaNode find = {
        .node_id = node_id,
    };
    struct SelvaNode *node;

    node = RB_FIND(SelvaNodeIndex, &type->nodes, &find);
    if (!node && upsert) {
        node = new_node(db, type, node_id);
    }

    return node;
}
