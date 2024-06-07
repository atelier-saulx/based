/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include "selva_error.h"
#include "selva.h"

void edge_add(void)
{
}

void edge_del(void)
{
}

int edge_get_meta_obj(struct SelvaDb *db, struct SelvaNode *node, field_t field, node_id_t node_id, bool create, struct SelvaObject **meta_out)
{
}

void EdgeFieldSingle_Free(void *p)
{
}

void EdgeFieldMulti_Free(void *p)
{
}

size_t EdgeFieldSingle_Len(void *p)
{
    struct EdgeFieldSingle *ef = (struct EdgeFieldSingle *)p;

    return !!ef->dst;
}

size_t EdgeFieldMulti_Len(void *p)
{
    struct EdgeFieldMulti *ef = (struct EdgeFieldMulti *)p;

    return SVector_Size(&ef->arcs);
}
