/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

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

/**
 * Called for each node found during a traversal.
 * @param node a pointer to the node.
 * @param arg a pointer to node_arg give in SelvaTraversalCallback structure.
 * @returns -2 to interrupt the whole traversal; -1 don't visit any field of this node.
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
     * A return value greater than 0 is ignored and a return value of less than zero stops the traversal.
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
     * The return value of this function is ignored.
     */
    SelvaTraversalNodeCallback child_cb;
    void *child_arg;
};


int traverse_field_bfs(
        struct SelvaDb *db,
        struct SelvaNode *head,
        const struct SelvaTraversalParam *cb);
