/*
 * Copyright (c) 2023 SAULX
 *
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <string.h>
#include <sys/types.h>
#include "hierarchy.h"
#include "edge.h"

struct EdgeField *Edge_GetField(const struct SelvaHierarchyNode *node, const char *key_name_str, size_t key_name_len) {
    return NULL;
}

int Edge_GetFieldEdgeMetadata(struct EdgeField *edge_field, const Selva_NodeId dst_node_id, bool create, struct SelvaObject **out) {
    return 0;
}

size_t Edge_Refcount(const struct SelvaHierarchyNode *node) {
    return 0;
}

void Edge_InitEdgeFieldConstraints(struct EdgeFieldConstraints *data) {
    memset(data, 0, sizeof(*data));
}

void Edge_DeinitEdgeFieldConstraints(struct EdgeFieldConstraints *data) {
    memset(data, 0, sizeof(*data));
}

int Edge_Usage(const struct SelvaHierarchyNode *node) {
    return 0;
}

int Edge_DerefSingleRef(const struct EdgeField *edge_field, struct SelvaHierarchyNode **node_out) {
    return 0;
}
