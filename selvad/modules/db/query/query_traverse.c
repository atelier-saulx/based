/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <stddef.h>
#include <string.h>
#include <sys/types.h>
#include "selva_error.h"
#include "selva_log.h"
#include "selva_trace.h"
#include "selva_db.h"
#include "traversal.h"
#include "hierarchy.h"
#include "query.h"

/*
 * Trace handles.
 */
SELVA_TRACE_HANDLE(query_traverse_array);
SELVA_TRACE_HANDLE(query_traverse_refs);
SELVA_TRACE_HANDLE(query_traverse_bfs_edge_field);
SELVA_TRACE_HANDLE(query_traverse_traversal_expression);
SELVA_TRACE_HANDLE(query_traverse_traversal_field);
SELVA_TRACE_HANDLE(query_traverse_rest);

int query_traverse(struct SelvaHierarchy *hierarchy, Selva_NodeId node_id, struct query_traverse *qt, void *args)
{
    int err;

    if (qt->dir == SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD && qt->dir_opt_str) {
        const struct SelvaHierarchyCallback cb = {
            .node_cb = qt->node_cb,
            .node_arg = args,
        };
        const char *ref_field_str = qt->dir_opt_str;
        size_t ref_field_len = qt->dir_opt_len;

        SELVA_TRACE_BEGIN(query_traverse_refs);
        err = SelvaHierarchy_TraverseEdgeField(hierarchy, node_id, ref_field_str, ref_field_len, &cb);
        SELVA_TRACE_END(query_traverse_refs);
    } else if (qt->dir == SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD && qt->dir_opt_str) {
        const struct SelvaHierarchyCallback cb = {
            .node_cb = qt->node_cb,
            .node_arg = args,
        };
        const char *ref_field_str = qt->dir_opt_str;
        size_t ref_field_len = qt->dir_opt_len;

        SELVA_TRACE_BEGIN(query_traverse_bfs_edge_field);
        err = SelvaHierarchy_TraverseEdgeFieldBfs(hierarchy, node_id, ref_field_str, ref_field_len, &cb);
        SELVA_TRACE_END(query_traverse_bfs_edge_field);
    } else if (qt->dir & (SELVA_HIERARCHY_TRAVERSAL_EXPRESSION |
                          SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION)) {
        const struct SelvaHierarchyCallback cb = {
            .node_cb = qt->node_cb,
            .node_arg = args,
        };

        SELVA_TRACE_BEGIN(query_traverse_traversal_expression);
        err = (qt->dir == SELVA_HIERARCHY_TRAVERSAL_EXPRESSION)
            ? SelvaHierarchy_TraverseExpression(hierarchy, node_id, qt->traversal_rpn_ctx, qt->traversal_expression, qt->edge_filter_ctx, qt->edge_filter, &cb)
            :SelvaHierarchy_TraverseExpressionBfs(hierarchy, node_id, qt->traversal_rpn_ctx, qt->traversal_expression, qt->edge_filter_ctx, qt->edge_filter, &cb);
        SELVA_TRACE_END(query_traverse_traversal_expression);
    } else if (qt->dir & (SELVA_HIERARCHY_TRAVERSAL_FIELD |
                          SELVA_HIERARCHY_TRAVERSAL_BFS_FIELD)) {
        const struct SelvaHierarchyCallback hcb = {
            .node_cb = qt->node_cb,
            .node_arg = args,
        };

        SELVA_TRACE_BEGIN(query_traverse_traversal_field);
        err = (qt->dir == SELVA_HIERARCHY_TRAVERSAL_FIELD)
            ? SelvaHierarchy_TraverseField2(hierarchy, node_id, qt->dir_opt_str, qt->dir_opt_len, &hcb)
            : SelvaHierarchy_TraverseField2Bfs(hierarchy, node_id, qt->dir_opt_str, qt->dir_opt_len, &hcb);
        SELVA_TRACE_END(query_traverse_traversal_field);
    } else {
        const struct SelvaHierarchyCallback cb = {
            .node_cb = qt->node_cb,
            .node_arg = args,
        };

        SELVA_TRACE_BEGIN(query_traverse_rest);
        err = SelvaHierarchy_Traverse(hierarchy, node_id, qt->dir, &cb);
        SELVA_TRACE_END(query_traverse_rest);
    }

    return err;
}
