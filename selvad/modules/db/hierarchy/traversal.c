/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <string.h>
#include <sys/types.h>
#include "util/selva_string.h"
#include "util/svector.h"
#include "selva_object.h"
#include "traversal.h"

int SelvaTraversal_FieldsContains(struct SelvaObject *fields, const char *field_name_str, size_t field_name_len)
{
    void *iterator;
    const SVector *vec;

    iterator = SelvaObject_ForeachBegin(fields);
    while ((vec = SelvaObject_ForeachValue(fields, &iterator, NULL, SELVA_OBJECT_ARRAY))) {
        struct SVectorIterator it;
        const struct selva_string *s;

        SVector_ForeachBegin(&it, vec);
        while ((s = SVector_Foreach(&it))) {
            TO_STR(s);

            if (s_len == field_name_len && !memcmp(s_str, field_name_str, s_len)) {
                return 1;
            }
        }
    }

    return 0;
}

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
    case SELVA_HIERARCHY_TRAVERSAL_REF:
        return (const char *)"ref";
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
