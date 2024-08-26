/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <sys/types.h>
#include "util/svector.h"
#include "selva/fields.h"
#include "selva_error.h"
#include "db.h"
#include "selva/traverse.h"

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

#define BFS_TRAVERSE_BEGIN(hierarchy, head, cb) \
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
    if (head_cb((hierarchy), &(const struct SelvaTraversalMetadata){ .depth = _bfs_depth.cur_depth }, (head), (cb)->head_arg) < 0) { Trx_End(&(hierarchy)->trx_state, &trx_cur); return 0; } \
    while (SVector_Size(&_bfs_q) > 0) { \
        struct SelvaNode *node = SVector_Shift(&_bfs_q); \
        struct SelvaTraversalMetadata _node_cb_metadata = { \
            .edge_data = SVector_Shift(&_bfs_sq), \
            .depth = _bfs_depth.cur_depth, \
        };

#define BFS_VISIT_NODE(hierarchy, cb) ({ \
        /* Note that Trx_Visit() has been already called for this node. */ \
        int res = node_cb((hierarchy), &_node_cb_metadata, node, (cb)->node_arg); \
        if (res == SELVA_TRAVERSAL_ABORT) { \
            Trx_End(&(hierarchy)->trx_state, &trx_cur); return 0; \
        } res; \
    })

#define BFS_VISIT_ADJACENT(hierarchy, cb, edge_data, adj_node) do { \
        if (Trx_Visit(&trx_cur, &(adj_node)->trx_label)) { \
            static_assert(__builtin_types_compatible_p(typeof(edge_data), struct SelvaFields *)); \
            const struct SelvaTraversalMetadata _child_cb_metadata = { \
                .edge_data = (edge_data), \
                .depth = _bfs_depth.cur_depth, \
            }; \
            int res = child_cb((hierarchy), &_child_cb_metadata, (adj_node), (cb)->child_arg); \
            if ( res == SELVA_TRAVERSAL_STOP) { \
                /* NOP */ \
            } else if (res == SELVA_TRAVERSAL_ABORT) { \
                Trx_End(&(hierarchy)->trx_state, &trx_cur); return 0; \
            } else { \
                SVector_Insert(&_bfs_q, (adj_node)); \
                SVector_Insert(&_bfs_sq, (edge_data)); \
            } \
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

int traverse_field_bfs(
        struct SelvaDb *db,
        struct SelvaNode *head,
        const struct SelvaTraversalParam *cb) {
    BFS_TRAVERSE_BEGIN(db, head, cb) {
        struct SelvaFieldsAny any;
        int res, err;

        res = BFS_VISIT_NODE(db, cb);
        if (res >= 0) {
            /* We assume that it's a valid field id. */
            field_t field = (field_t)res;

            err = selva_fields_get(&node->fields, field, &any);
            if (err || any.type == SELVA_FIELD_TYPE_NULL) {
                continue;
            }

            if (any.type == SELVA_FIELD_TYPE_REFERENCE) {
                struct SelvaFields *edge_data = any.reference->meta;
                struct SelvaNode *adj = any.reference->dst;

                if (adj) {
                    BFS_VISIT_ADJACENT(db, cb, edge_data, adj);
                }
            } else if (any.type == SELVA_FIELD_TYPE_REFERENCES) {
                if (any.references && any.references->refs) {
                    const size_t nr_refs = any.references->nr_refs;

                    for (size_t i = 0; i < nr_refs; i++) {
                        struct SelvaNodeReference *ref = &any.references->refs[i];
                        struct SelvaFields *edge_data = ref->meta;
                        struct SelvaNode *adj = ref->dst;

                        if (adj) {
                            BFS_VISIT_ADJACENT(db, cb, edge_data, adj);
                        }
                    }
                }
            } else if (any.type == SELVA_FIELD_TYPE_WEAK_REFERENCE) {
                /* TODO */
            } else if (any.type == SELVA_FIELD_TYPE_WEAK_REFERENCES) {
                /* TODO */
            } else {
                return SELVA_EINTYPE;
            }
        }
    } BFS_TRAVERSE_END(db);

    return 0;
}
