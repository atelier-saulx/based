/*
 * Copyright (c) 2022-2024 SAULX
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
    r = !!((SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION |
            SELVA_HIERARCHY_TRAVERSAL_BFS_FIELD) & dir);

    return (skip <= -1) ? 0 : r + skip;
}

const char *SelvaTraversal_Dir2str(enum SelvaTraversal dir)
{
    switch (dir) {
    case SELVA_HIERARCHY_TRAVERSAL_NONE:
        return (const char *)"none";
    case SELVA_HIERARCHY_TRAVERSAL_NODE:
        return (const char *)"node";
    case SELVA_HIERARCHY_TRAVERSAL_ALL:
        return (const char *)"all";
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
