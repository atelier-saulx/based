/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include "selva.h"

void edge_add(void)
{
}

void edge_del(void)
{
}

void edge_get_meta_obj(void)
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

static const struct SelvaObjectPointerOpts obj_edge_single_opts = {
    .ptr_type_id = SELVA_OBJECT_POINTER_EDGE_SINGLE,
#if 0
    .ptr_reply = EdgeField_Reply,
#endif
    .ptr_free = EdgeFieldSingle_Free,
    .ptr_len = EdgeFieldSingle_Len,
#if 0
    .ptr_save = EdgeField_Save,
    .ptr_load = EdgeField_Load,
#endif
};
SELVA_OBJECT_POINTER_OPTS(obj_edge_single_opts);

static const struct SelvaObjectPointerOpts obj_edge_multi_opts = {
    .ptr_type_id = SELVA_OBJECT_POINTER_EDGE_MULTI,
#if 0
    .ptr_reply = EdgeField_Reply,
#endif
    .ptr_free = EdgeFieldMulti_Free,
    .ptr_len = EdgeFieldMulti_Len,
#if 0
    .ptr_save = EdgeField_Save,
    .ptr_load = EdgeField_Load,
#endif
};
SELVA_OBJECT_POINTER_OPTS(obj_edge_multi_opts);
