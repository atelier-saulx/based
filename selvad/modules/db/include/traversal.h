/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef SELVA_TRAVERSAL_H
#define SELVA_TRAVERSAL_H

struct SVector;
struct SelvaHierarchy;
struct SelvaHierarchyNode;
struct SelvaObject;
struct SelvaObjectAny;
struct finalizer;
struct selva_server_response_out;
struct selva_string;

/**
 * Hierarchy traversal order.
 */
enum SelvaTraversal {
    SELVA_HIERARCHY_TRAVERSAL_NONE =            0x00000, /*!< Do nothing. */
    SELVA_HIERARCHY_TRAVERSAL_NODE =            0x00001, /*!< Visit just the given node. */
    SELVA_HIERARCHY_TRAVERSAL_ALL =             0x80000, /*!< Traverse all nodes. */
    SELVA_HIERARCHY_TRAVERSAL_ARRAY =           0x00002, /*!< Traverse an array. */
    SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD =      0x00010, /*!< Visit nodes pointed by an edge field. */
    SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD =  0x01000, /*!< Traverse an edge field according to its constraints using BFS. */
    SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION =  0x02000, /*!< Traverse with an expression returning a set of field names. */
    SELVA_HIERARCHY_TRAVERSAL_EXPRESSION =      0x04000, /*!< Visit fields with an expression returning a set of field names. */
    SELVA_HIERARCHY_TRAVERSAL_FIELD =           0x08000, /*!< Traverse any hierarchy, edge, or object array field. */
    SELVA_HIERARCHY_TRAVERSAL_BFS_FIELD =       0x10000, /*!< Traverse any hierarchy, edge, or object array field using BFS. */
};

/**
 * Merge strategy used with find.
 */
enum SelvaMergeStrategy {
    MERGE_STRATEGY_NONE = 0, /* No merge. */
    MERGE_STRATEGY_ALL,
    MERGE_STRATEGY_NAMED,
    MERGE_STRATEGY_DEEP,
};

enum SelvaHierarchyTraversalSVecPtag {
    /*!<
     * First node if is NULL, no source;
     * if p is non-NULL then the source is unknown or can't be described.
     */
    SELVA_TRAVERSAL_SVECTOR_PTAG_NONE = 0,
    SELVA_TRAVERSAL_SVECTOR_PTAG_EDGE = 3, /*!< Edge field SVector. */
};

/**
 * Traversal metadata for child/adjacent nodes.
 * Note that SelvaTraversalOrder expects this to be copyable.
 */
struct SelvaHierarchyTraversalMetadata {
    /**
     * A tagged pointer to the origin field SVector.
     * The tag is one of SelvaHierarchyTraversalSVecPtag.
     */
    const void *origin_field_svec_tagp;
    long long depth;
};

/**
 * Traversal result order.
 */
enum SelvaResultOrder {
    /**
     * Result is not ordered by any field but can be usually expected to have a
     * deterministic order.
     */
    SELVA_RESULT_ORDER_NONE = 0,
    /**
     * Ascending order.
     */
    SELVA_RESULT_ORDER_ASC,
    /**
     * Descending order.
     */
    SELVA_RESULT_ORDER_DESC,
};

/**
 * Traversal order item type.
 * As a TraversalOrderItem can contain data of different types, this enum
 * encodes the type to help finding the right way to compare two items.
 */
enum TraversalOrderItemType {
    ORDER_ITEM_TYPE_EMPTY = 0,
    ORDER_ITEM_TYPE_TEXT,
    ORDER_ITEM_TYPE_DOUBLE,
};

/**
 * Tag type for tagp in struct TraversalOrderItem.
 */
enum TraversalOrderItemPtype {
    TRAVERSAL_ORDER_ITEM_PTYPE_NULL = 0,
    /**
     * A pointer to a node.
     */
    TRAVERSAL_ORDER_ITEM_PTYPE_NODE = 1,
    /**
     * A pointer to a SelvaObject.
     */
    TRAVERSAL_ORDER_ITEM_PTYPE_OBJ = 2,
};

/**
 * Traversal order item.
 * These are usually stored in an SVector initialized by
 * SelvaTraversalOrder_InitOrderResult().
 */
struct TraversalOrderItem {
    /**
     * Value type of this ordered item.
     */
    enum TraversalOrderItemType type;
    struct SelvaHierarchyTraversalMetadata traversal_metadata;
    /**
     * Associated NodeId of this item.
     */
    Selva_NodeId node_id;
    /**
     * A pointer tagged with TraversalOrderItemPtype.
     */
    void *tagp;
    /**
     * Double value.
     */
    double d;
    /**
     * Sortable data for ORDER_ITEM_TYPE_TEXT.
     */
    char data[];
};

/**
 * Called for each node found during a traversal.
 * @param node a pointer to the node.
 * @param arg a pointer to node_arg give in SelvaHierarchyCallback structure.
 * @returns 0 to continue the traversal; 1 to interrupt the traversal.
 */
typedef int (*SelvaHierarchyNodeCallback)(
        struct SelvaHierarchy *hierarchy,
        const struct SelvaHierarchyTraversalMetadata *metadata,
        struct SelvaHierarchyNode *node,
        void *arg);

/**
 * Calculate skip.
 *  -1 = Always include the starting node.
 *   0 = No action
 * > 0 = Skip nodes.
 */
int SelvaTraversal_GetSkip(enum SelvaTraversal dir, ssize_t skip);

const char *SelvaTraversal_Dir2str(enum SelvaTraversal dir);

/**
 * Init an SVector for storing TraversalOrderItems.
 * @param order_result is a pointer to the SVector to be initialized.
 * @param order is the order requested.
 * @param limit is the expected length for the final SVector. Generally this can be the same as limit size of the response. 0 = auto.
 */
void SelvaTraversalOrder_InitOrderResult(struct SVector *order_result, enum SelvaResultOrder order, ssize_t limit);

/**
 * Destroy an order_result SVector and free its items properly.
 * If SelvaTraversalOrder_Create*OrderItem() was called with a ctx then ctx this
 * function should be called with a ctx too. Alternatively the order_result
 * SVector can be declared with SVECTOR_AUTOFREE().
 */
void SelvaTraversalOrder_DestroyOrderResult(struct finalizer *fin, struct SVector *order_result);

/**
 * Create a new node based TraversalOrderItem that can be sorted.
 * @param[in] fin if given the item will be freed when the finalizer is executed; if NULL the caller must free the item returned.
 * @returns Returns a TraversalOrderItem if succeed; Otherwise a NULL pointer is returned.
 */
struct TraversalOrderItem *SelvaTraversalOrder_CreateNodeOrderItem(
        struct finalizer *fin,
        struct selva_string *lang,
        const struct SelvaHierarchyTraversalMetadata *traversal_metadata,
        struct SelvaHierarchyNode *node,
        const struct selva_string *order_field);

/**
 * Create a new node based TraversalOrderItem that can be sorted with user defined value.
 * @param[in] fin if given the item will be freed when the finalizer is executed; if NULL the caller must free the item returned.
 * @returns Returns a TraversalOrderItem if succeed; Otherwise a NULL pointer is returned.
 */
struct TraversalOrderItem *SelvaTraversalOrder_CreateAnyNodeOrderItem(
        struct finalizer *fin,
        struct SelvaHierarchyNode *node,
        struct SelvaObjectAny *any);

/**
 * Create a new SelvaObject based TraversalOrderItem that can be sorted.
 * This function can be used to determine an order for several SelvaObjects.
 * @param[in] fin if given the item will be freed when the finalizer is executed; if NULL the caller must free the item returned.
 * @param lang is the language for text fields.
 * @param order_field is a field on obj.
 * @returns Returns a TraversalOrderItem if succeed; Otherwise a NULL pointer is returned.
 */
struct TraversalOrderItem *SelvaTraversalOrder_CreateObjectOrderItem(
        struct finalizer *fin,
        struct selva_string *lang,
        struct SelvaObject *obj,
        const struct selva_string *order_field);

/**
 * Destroy TraversalOrderItem created by SelvaTraversalOrder_Create*OrderItem().
 * This function should be only used if finalizer was not used when creating the item.
 */
void SelvaTraversalOrder_DestroyOrderItem(struct TraversalOrderItem *item);

#endif /* SELVA_TRAVERSAL_H */
