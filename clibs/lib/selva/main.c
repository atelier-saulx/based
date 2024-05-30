/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include "selva.h"

RB_PROTOTYPE_STATIC(SelvaNodeIndex, SelvaNode, _index_entry, SelvaNode_Compare)

static int SelvaNode_Compare(const struct SelvaNode *a, const struct SelvaNode *b) {
    return a->node_id - b->node_id;
}

RB_GENERATE_STATIC(SelvaNodeIndex, SelvaNode, _index_entry, SelvaNode_Compare)

__attribute__((visibility("default"))) int best(void)
{
    return 2;
}
