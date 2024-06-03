/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <string.h>
#include "jemalloc.h"
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

    return db;
}

void selva_db_delete(struct SelvaDb *db)
{
    /* FIXME */
}

int selva_db_schema_update(struct SelvaDb *db, char *schema_buf, size_t schema_len)
{
    struct SelvaTypeEntry *e = selva_calloc(1, sizeof(*e));
    size_t dyn_fields_size = 0; /* FIXME */

    RB_INIT(&e->nodes);

    RB_INIT(&e->nodes);
    /* FIXME aliases */
#if 0
    SelvaObject_Init(e->aliases._obj_data, 0);
#endif
    mempool_init(&e->nodepool, NODEPOOL_SLAB_SIZE, sizeof(struct SelvaNode) + dyn_fields_size, alignof(size_t));

    RB_INSERT(SelvaTypeIndex, &db->types.index, e);
    return 0;
}
