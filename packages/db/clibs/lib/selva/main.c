/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include "jemalloc.h"
#include "selva.h"

RB_PROTOTYPE_STATIC(SelvaNodeIndex, SelvaNode, _index_entry, SelvaNode_Compare)

static int SelvaNode_Compare(const struct SelvaNode *a, const struct SelvaNode *b) {
    return a->node_id - b->node_id;
}

RB_GENERATE_STATIC(SelvaNodeIndex, SelvaNode, _index_entry, SelvaNode_Compare)

struct SelvaDb *selva_db_create(char *schema_buf, size_t schema_len)
{
    struct SelvaDb *db = selva_calloc(1, sizeof(struct SelvaDb));

#if 0
    /* TODO Apply schema */

    /* TODO For each type */
    init_nodepools(hierarchy);
    RB_INIT(&hierarchy->index_head);
    SelvaObject_Init(hierarchy->aliases._obj_data, 0);

    SVector_Init(&hierarchy->expiring.list, 0, SVector_HierarchyNode_expire_compare);
    hierarchy->expiring.next = HIERARCHY_EXPIRING_NEVER;
    hierarchy->expiring.tim_id = evl_set_timeout(&hierarchy_expire_period, hierarchy_expire_tim_proc, hierarchy);
#endif

    return db;
}

void selva_db_delete(struct SelvaDb *db)
{
}
