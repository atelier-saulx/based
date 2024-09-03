/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "selva/_export.h"

struct SelvaNode;
struct SelvaDb;

/**
 * Traversal metadata for child/adjacent nodes.
 * Note that SelvaTraversalOrder expects this to be copyable.
 */
struct SelvaTraversalMetadata {
    const struct SelvaFields *edge_data; /*!< Edge metadata. */
    long long depth;
};

#define SELVA_TRAVERSAL_ABORT (-2)
#define SELVA_TRAVERSAL_STOP (-1)

/**
 * Called for each node found during a traversal.
 * @param node a pointer to the node.
 * @param arg a pointer to node_arg give in SelvaTraversalCallback structure.
 */
typedef int (*SelvaTraversalNodeCallback)(
        struct SelvaDb *db,
        const struct SelvaTraversalMetadata *metadata,
        struct SelvaNode *node,
        void *arg);

/**
 * Callback descriptor used for traversals.
 */
struct SelvaTraversalParam {
    /**
     * Called for each orphan head in the hierarchy.
     */
    SelvaTraversalNodeCallback head_cb;
    void *head_arg;

    /**
     * Called for each node in the hierarchy.
     */
    SelvaTraversalNodeCallback node_cb;
    void *node_arg;

    /**
     * Called for each child of current node.
     */
    SelvaTraversalNodeCallback child_cb;
    void *child_arg;
};

SELVA_EXPORT
int selva_traverse_field_bfs(
        struct SelvaDb *db,
        struct SelvaNode *head,
        const struct SelvaTraversalParam *cb);

SELVA_EXPORT
int selva_traverse_type(struct SelvaDb *db, struct SelvaTypeEntry *te, SelvaTraversalNodeCallback node_cb, void *node_arg);
