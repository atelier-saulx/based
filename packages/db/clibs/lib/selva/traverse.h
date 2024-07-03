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
 * @returns 0 to continue the traversal; 1 to interrupt the traversal.
 */
typedef int (*SelvaTraversalNodeCallback)(
        struct SelvaDb *db,
        const struct SelvaTraversalMetadata *metadata,
        struct SelvaNode *node,
        void *arg);

/**
 * Callback descriptor used for traversals.
 */
struct SelvaTraversalCallback {
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
     * The return value of this function is typically ignored/discarded.
     */
    SelvaTraversalNodeCallback child_cb;
    void *child_arg;
};


int selva_traverse_bfs(
        struct SelvaDb *db,
        struct SelvaNode *head,
        field_t field,
        const struct SelvaTraversalCallback *cb);
