/*
 * Copyright (c) 2022, 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef _SELVA_HIERARCHY_INACTIVE_H_
#define _SELVA_HIERARCHY_INACTIVE_H_

struct SelvaHierarchy;

/**
 * Initialize a data structure holding inactive nodeIds.
 * Inactive nodes are potentially interesting for compression or complete
 * detachment from the hierarchy. Once a node is actually detached, it shouldn't
 * end up here. If a node ends up not being detached then it shouldn't be tried
 * again immediately.
 * See hierarchy.h for comments on how the data is stored.
 * @param hierarchy is a pointer to the hierarchy.
 * @param nr_nodes is the number of nodes that can be tracked at once.
 */
int SelvaHierarchy_InitInactiveNodes(struct SelvaHierarchy *hierarchy, size_t nr_nodes);

/**
 * Deinit the inactive nodes data structure.
 */
void SelvaHierarchy_DeinitInactiveNodes(struct SelvaHierarchy *hierarchy);

/**
 * Add a nodeId to the list of inactive list.
 * @param hierarchy is a pointer to the hierarchy.
 * @param node_id is the id of the node to be added.
 */
void SelvaHierarchy_AddInactiveNodeId(struct SelvaHierarchy *hierarchy, const Selva_NodeId node_id);

/**
 * Clear the list of inactive nodeIds.
 * @param hierarchy is a pointer to the hierarchy.
 */
void SelvaHierarchy_ClearInactiveNodeIds(struct SelvaHierarchy *hierarchy);

#define HIERARCHY_INACTIVE_FOREACH(H) \
        for (struct { size_t i; size_t n; Selva_NodeId *nodes; const char *node_id; } _infor = { \
                .n = (H)->inactive.nr_nodes, \
                .nodes = (H)->inactive.nodes, \
                .node_id = (H)->inactive.nodes ? (H)->inactive.nodes[0] : NULL, }; \
             _infor.i < _infor.i && _infor.node_id[0] != '\0'; \
             _infor.node_id = _infor.nodes[++_infor.i])

#define HIERARCHY_INACTIVE_FOREACH_NODE_ID \
    (_infor.node_id)

#endif /* _SELVA_HIERARCHY_INACTIVE_H_ */
