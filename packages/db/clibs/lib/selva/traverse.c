/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <sys/types.h>
#include "util/svector.h"
#include "selva_error.h"
#include "selva.h"
#include "fields.h"

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

[[maybe_unused]]
static int head_callback_stub(
        struct SelvaDb *,
        const struct SelvaTraversalMetadata *,
        struct SelvaNode *,
        void *arg __unused) {
    return 0;
}

[[maybe_unused]]
static int node_callback_stub(
        struct SelvaDb *,
        const struct SelvaTraversalMetadata *,
        struct SelvaNode *,
        void *arg __unused) {
    return 0;
}

[[maybe_unused]]
static int child_callback_stub(
        struct SelvaDb *,
        const struct SelvaTraversalMetadata *,
        struct SelvaNode *,
        void *arg __unused) {
    return 0;
}

#define BFS_SVEC_INIT_SIZE 100

#define BFS_TRAVERSE(hierarchy, head, cb) \
    SelvaTraversalNodeCallback head_cb = (cb)->head_cb ? (cb)->head_cb : head_callback_stub; \
    SelvaTraversalNodeCallback node_cb = (cb)->node_cb ? (cb)->node_cb : node_callback_stub; \
    SelvaTraversalNodeCallback child_cb = (cb)->child_cb ? (cb)->child_cb : child_callback_stub; \
    \
    SVECTOR_AUTOFREE(_bfs_q); \
    SVECTOR_AUTOFREE(_bfs_sq); \
    SVector_Init(&_bfs_q,  BFS_SVEC_INIT_SIZE, NULL); \
    SVector_Init(&_bfs_sq, BFS_SVEC_INIT_SIZE, NULL); \
    struct { \
        long long cur_depth; /*!< Current depth. */ \
        long long count; /*!< Elements left to next depth increment. */ \
        long long next_count; /*!< Next initial count. */ \
    } _bfs_depth = { 0, 1, 0 }; \
    struct trx trx_cur; \
    if (Trx_Begin(&(hierarchy)->trx_state, &trx_cur)) { \
        return SELVA_HIERARCHY_ETRMAX; \
    } \
    \
    Trx_Visit(&trx_cur, &(head)->trx_label); \
    SVector_Insert(&_bfs_q, (head)); \
    SVector_Insert(&_bfs_sq, NULL); \
    if (head_cb((hierarchy), &(const struct SelvaTraversalMetadata){ .depth = _bfs_depth.cur_depth }, (head), (cb)->head_arg)) { Trx_End(&(hierarchy)->trx_state, &trx_cur); return 0; } \
    while (SVector_Size(&_bfs_q) > 0) { \
        struct SelvaNode *node = SVector_Shift(&_bfs_q); \
        struct SelvaTraversalMetadata _node_cb_metadata = { \
            .edge_data = SVector_Shift(&_bfs_sq), \
            .depth = _bfs_depth.cur_depth, \
        };

#define BFS_VISIT_NODE(hierarchy, cb) do { \
        /* Note that Trx_Visit() has been already called for this node. */ \
        if (node_cb((hierarchy), &_node_cb_metadata, node, (cb)->node_arg)) { \
            Trx_End(&(hierarchy)->trx_state, &trx_cur); \
            return 0; \
        } \
    } while (0)

#define BFS_VISIT_ADJACENT(hierarchy, cb, edge_data, adj_node) do { \
        if (Trx_Visit(&trx_cur, &(adj_node)->trx_label)) { \
            static_assert(__builtin_types_compatible_p(typeof(edge_data), struct SelvaFields *)); \
            const struct SelvaTraversalMetadata _child_cb_metadata = { \
                .edge_data = (edge_data), \
                .depth = _bfs_depth.cur_depth, \
            }; \
            (void)child_cb((hierarchy), &_child_cb_metadata, (adj_node), (cb)->child_arg); \
            SVector_Insert(&_bfs_q, (adj_node)); \
            SVector_Insert(&_bfs_sq, (edge_data)); \
            _bfs_depth.next_count++; \
        } \
    } while (0)

#define BFS_TRAVERSE_END(hierarchy) \
        if (--_bfs_depth.count == 0) { \
            _bfs_depth = (typeof(_bfs_depth)){ \
                .cur_depth = _bfs_depth.cur_depth + 1, \
                .count = _bfs_depth.count = _bfs_depth.next_count, \
                .next_count = 0, \
            }; \
        } \
    } \
    Trx_End(&(hierarchy)->trx_state, &trx_cur)

static int bfs_edge(
        struct SelvaDb *db,
        struct SelvaNode *head,
        field_t field,
        const struct SelvaTraversalCallback *cb) {
    BFS_TRAVERSE(db, head, cb) {
        struct SelvaFieldsAny any;
        int err;

        BFS_VISIT_NODE(db, cb);

        err = selva_fields_get(node, field, &any);
        if (err) {
            continue;
        }

        if (any.type == SELVA_FIELD_TYPE_REFERENCE) {
            struct SelvaFields *edge_data = any.reference->meta;
            struct SelvaNode *adj = any.reference->dst;

            BFS_VISIT_ADJACENT(db, cb, edge_data, adj);
        } else if (any.type == SELVA_FIELD_TYPE_REFERENCES) {
            if (any.references && any.references->refs) {
                const size_t nr_refs = any.references->nr_refs;

                for (size_t i = 0; i < nr_refs; i++) {
                    struct SelvaNodeReference *ref = &any.references->refs[i];
                    struct SelvaFields *edge_data = ref->meta;
                    struct SelvaNode *adj = ref->dst;

                    BFS_VISIT_ADJACENT(db, cb, edge_data, adj);
                }
            }
        } else if (any.type == SELVA_FIELD_TYPE_WEAK_REFERENCE) {
            /* TODO */
        } else if (any.type == SELVA_FIELD_TYPE_WEAK_REFERENCES) {
            /* TODO */
        } else {
            return SELVA_EINTYPE;
        }

    } BFS_TRAVERSE_END(db);

    return 0;
}
