/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <sys/types.h>
#include "selva_db.h"
#include "traversal.h"

int SelvaTraversal_GetSkip(enum SelvaTraversal dir, ssize_t skip)
{
    ssize_t r;

    /*
     * Find needs to skip the head node of the traverse for some types as we
     * are not interested in the node we already know.
     */
    r = !!((SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS |
            SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS |
            SELVA_HIERARCHY_TRAVERSAL_DFS_ANCESTORS |
            SELVA_HIERARCHY_TRAVERSAL_DFS_ANCESTORS |
            SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION) & dir);

    return (skip <= -1) ? 0 : r + skip;
}

const char *SelvaTraversal_Dir2str(enum SelvaTraversal dir)
{
    switch (dir) {
    case SELVA_HIERARCHY_TRAVERSAL_NONE:
        return (const char *)"none";
    case SELVA_HIERARCHY_TRAVERSAL_NODE:
        return (const char *)"node";
    case SELVA_HIERARCHY_TRAVERSAL_ARRAY:
        return (const char *)"array";
    case SELVA_HIERARCHY_TRAVERSAL_SET:
        return (const char *)"set";
    case SELVA_HIERARCHY_TRAVERSAL_CHILDREN:
        return (const char *)"children";
    case SELVA_HIERARCHY_TRAVERSAL_PARENTS:
        return (const char *)"parents";
    case SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS:
        return (const char *)"bfs_ancestors";
    case SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS:
        return (const char *)"bfs_descendants";
    case SELVA_HIERARCHY_TRAVERSAL_DFS_ANCESTORS:
        return (const char *)"dfs_ancestors";
    case SELVA_HIERARCHY_TRAVERSAL_DFS_DESCENDANTS:
        return (const char *)"dfs_descendants";
    case SELVA_HIERARCHY_TRAVERSAL_DFS_FULL:
        return (const char *)"dfs_full";
    case SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD:
        return (const char *)"edge_field";
    case SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD:
        return (const char *)"bfs_edge_field";
    case SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION:
        return (const char *)"bfs_expression";
    case SELVA_HIERARCHY_TRAVERSAL_EXPRESSION:
        return (const char *)"expression";
    case SELVA_HIERARCHY_TRAVERSAL_FIELD:
        return (const char *)"field";
    case SELVA_HIERARCHY_TRAVERSAL_BFS_FIELD:
        return (const char *)"bfs_field";
    default:
        return "invalid";
    }
}
