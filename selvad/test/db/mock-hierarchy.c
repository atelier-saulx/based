/*
 * Copyright (c) 2023 SAULX
 *
 * SPDX-License-Identifier: MIT
 */
#include <sys/types.h>
#include <stddef.h>
#include "selva_error.h"
#include "hierarchy.h"
#include "selva_db.h"

int SelvaHierarchy_IsNonEmptyField(const struct SelvaHierarchyNode *node, const char *field_str, size_t field_len) {
    return SELVA_ENOENT;
}

struct SelvaObject *SelvaHierarchy_GetNodeObject(const struct SelvaHierarchyNode *node) {
    return NULL;
}

const struct SelvaHierarchyMetadata *_SelvaHierarchy_GetNodeMetadataByConstPtr(const struct SelvaHierarchyNode *node) {
    return NULL; /* TODO Shouldn't be NULL! */
}

struct SelvaHierarchyMetadata *_SelvaHierarchy_GetNodeMetadataByPtr(struct SelvaHierarchyNode *node) {
    return NULL; /* TODO Shouldn't be NULL! */
}

int SelvaHierarchy_ForeachInField(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        const struct SelvaObjectSetForeachCallback *cb) {
    return 0;
}

struct SelvaObject *SelvaHierarchy_GetEdgeMetadataByTraversal(const struct SelvaHierarchyTraversalMetadata *traversal_metadata, struct SelvaHierarchyNode *node) {
    return NULL;
}
