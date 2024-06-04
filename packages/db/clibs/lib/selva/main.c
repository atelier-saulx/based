/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <string.h>
#include "jemalloc.h"
#include "selva_object.h"
#include "selva.h"

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

struct SelvaDb *selva_db_create(void)
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

void selva_db_delete(struct SelvaDb *db)
{
    /* FIXME */
}

int selva_db_schema_update(struct SelvaDb *db, char *schema_buf, size_t schema_len)
{
    struct SelvaTypeEntry *e = selva_calloc(1, sizeof(*e));
    size_t emb_fields_size = 0; /* FIXME */

    RB_INIT(&e->nodes);
    SelvaObject_Init(e->aliases._obj_data, 0);
    mempool_init(&e->nodepool, NODEPOOL_SLAB_SIZE, sizeof(struct SelvaNode) + emb_fields_size, alignof(size_t));

    RB_INSERT(SelvaTypeIndex, &db->types.index, e);
    return 0;
}

static struct SelvaTypeEntry *get_type_by_index(struct SelvaDb *db, node_type_t type)
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

static struct SelvaNodeSchema *get_ns_by_node(struct SelvaDb *db, struct SelvaNode *node)
{
    struct SelvaTypeEntry *e = get_type_by_node(db, node);
    return e ? e->ns : NULL;
}

static struct SelvaNode *new_node(struct SelvaDb *db, struct SelvaTypeEntry *type, node_id_t id)
{
    struct SelvaNode *node = mempool_get(&type->nodepool);

    memset(node, 0, sizeof(*node) + type->ns->emb_fields_size);
    node->node_id = id;
    node->type = type->type;

    RB_INSERT(SelvaNodeIndex, &type->nodes, node);
    return node;
}

static void del_node(struct SelvaDb *db, struct SelvaNode *node)
{
    struct SelvaTypeEntry *e = get_type_by_node(db, node);

    RB_REMOVE(SelvaNodeIndex, &e->nodes, node);

    if (node->expire) {
        /* TODO clear expire */
    }

    SelvaObject_Destroy(node->dyn_fields);
    mempool_return(&e->nodepool, node);
}
