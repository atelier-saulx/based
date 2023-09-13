/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef SELVA_TRAVERSAL_H
#define SELVA_TRAVERSAL_H

struct FindCommand_Args;
struct SVector;
struct SelvaHierarchy;
struct SelvaHierarchyNode;
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
    SELVA_HIERARCHY_TRAVERSAL_ARRAY =           0x00002, /*!< Traverse an array. */
    SELVA_HIERARCHY_TRAVERSAL_SET =             0x00004, /*!< Traverse a set. */
    SELVA_HIERARCHY_TRAVERSAL_REF =             0x00008, /*!< Visit nodes pointed by a string ref field. */
    SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD =      0x00010, /*!< Visit nodes pointed by an edge field. */
    SELVA_HIERARCHY_TRAVERSAL_CHILDREN =        0x00020, /*!< Visit children of the given node. */
    SELVA_HIERARCHY_TRAVERSAL_PARENTS =         0x00040, /*!< Visit parents of the given node. */
    SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS =   0x00080, /*!< Visit ancestors of the given node using BFS. */
    SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS = 0x00100, /*!< Visit descendants of the given node using BFS. */
    SELVA_HIERARCHY_TRAVERSAL_DFS_ANCESTORS =   0x00200, /*!< Visit ancestors of the given node using DFS. */
    SELVA_HIERARCHY_TRAVERSAL_DFS_DESCENDANTS = 0x00400, /*!< Visit descendants of the given node using DFS. */
    SELVA_HIERARCHY_TRAVERSAL_DFS_FULL =        0x00800, /*!< Full DFS traversal of the whole hierarchy. */
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

struct SelvaNodeSendParam {
    /*
     * Order-by information is needed if the sorting is made in the
     * postprocessing step, i.e. when the args->result SVector isn't
     * sorted.
     */
    enum SelvaResultOrder order; /*!< Result order. */
    const struct selva_string *order_field; /*!< Order by field name; Otherwise NULL. */

    /**
     * Merge strategy.
     * A merge is executed if this field is set to other than MERGE_STRATEGY_NONE.
     */
    enum SelvaMergeStrategy merge_strategy;
    struct selva_string *merge_path;

    /**
     * Field names.
     * If set the callback should return the value of these fields instead of
     * node IDs.
     *
     * fields selected in cmd args:
     * ```
     * {
     *   '0': ['field1', 'field2'],
     *   '1': ['field3', 'field4'],
     * }
     * ```
     *
     * merge && no fields selected in cmd args:
     * {
     * }
     *
     * and the final callback will use this as a scratch space to mark which
     * fields have been already sent.
     */
    struct SelvaObject *fields;

    /**
     * Inherit specific fields.
     */
    struct selva_string **inherit_fields;
    size_t nr_inherit_fields; /*!< Number of fields in inherit_fields. */

    /**
     * Fields that should be excluded when `fields` contains a wildcard.
     * The list should delimit the excluded fields in the following way:
     * ```
     * field1\nfield2\n
     * ```
     * NULL if not used.
     */
    struct selva_string *excluded_fields;

    /**
     * Field names expression context for `fields_expression`.
     */
    struct rpn_ctx *fields_rpn_ctx;

    /**
     * Field names expression.
     * Another way to select which fields should be returned to the client is
     * using an RPN expression that returns a set on field names.
     * If this is set then fields, inherit_fields, and excluded_fields should be NULL.
     */
    struct rpn_expression *fields_expression;
};

/**
 * Type of a function to process each node in a query.
 */
typedef int (*SelvaFind_ProcessNode)(
        struct SelvaHierarchy *hierarchy,
        struct FindCommand_Args *args,
        struct SelvaHierarchyNode *node);
/**
 * Type of a function to process each object in a query when traversing an array of objects.
 */
typedef int (*SelvaFind_ProcessObject)(
        struct FindCommand_Args *args,
        struct SelvaObject *obj);
/**
 * Post processing callback in a query.
 */
typedef void (*SelvaFind_Postprocess)(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct SelvaHierarchy *hierarchy,
        struct selva_string *lang,
        ssize_t offset,
        ssize_t limit,
        struct SelvaNodeSendParam *args,
        struct SVector *result);

struct FindCommand_Args {
    struct finalizer *fin;
    struct selva_server_response_out *resp;
    struct selva_string *lang;

    ssize_t *nr_nodes; /*!< Number of nodes in the result. */
    ssize_t skip; /*!< Start processing from nth node. */
    ssize_t offset; /*!< Start processing from nth node. */
    ssize_t *limit; /*!< Limit the number of result. */

    struct rpn_ctx *rpn_ctx;
    const struct rpn_expression *filter;

    struct SelvaNodeSendParam send_param;

#if 0
    enum SelvaResultOrder order; /*!< Result order. */
#endif
    struct SVector *result; /*!< Results of the find for postprocessing. Wrapped in TraversalOrderItem structs if sorting is requested. */

    struct Selva_SubscriptionMarker *marker; /*!< Used by FindInSub. */

    /* Accounting */
    size_t acc_take; /*!< Numer of nodes selected during the traversal. */
    size_t acc_tot; /*!< Total number of nodes visited during the traversal. */

    /*
     * Process callbacks.
     * While we'll only see either nodes or objects we don't necessarily know
     * which one it will be before we are in query_traverse().
     * E.g. SELVA_HIERARCHY_TRAVERSAL_FIELD makes the decission based on the
     * what is resolved from the given field path.
     */
    SelvaFind_ProcessNode process_node;
    SelvaFind_ProcessObject process_obj;
};

/**
 * See skip in FindCommand_Args.
 */
static inline int SelvaTraversal_ProcessSkip(struct FindCommand_Args *args)
{
    const int take = (args->skip > 0) ? !args->skip-- : 1;

    return take;
}

/**
 * See offset in FindCommand_Args.
 */
static inline int SelvaTraversal_ProcessOffset(struct FindCommand_Args *args)
{
    const int take = (args->offset > 0) ? !args->offset-- : 1;

    return take;
}

/**
 * Called for the first node in the traversal.
 * This is typically the node that was given as an argument to a traversal function.
 * @param node a pointer to the node.
 * @param arg a pointer to head_arg give in SelvaHierarchyCallback structure.
 */
typedef int (*SelvaHierarchyHeadCallback)(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        void *arg);

/**
 * Called for each node found during a traversal.
 * @param node a pointer to the node.
 * @param arg a pointer to node_arg give in SelvaHierarchyCallback structure.
 * @returns 0 to continue the traversal; 1 to interrupt the traversal.
 */
typedef int (*SelvaHierarchyNodeCallback)(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        void *arg);

/**
 * Traversal metadata for child/adjacent nodes.
 */
struct SelvaHierarchyTraversalMetadata {
    const char *origin_field_str;
    size_t origin_field_len;
    struct SelvaHierarchyNode *origin_node;
};

/**
 * Called for each adjacent node during a traversal.
 * @param node a pointer to the node.
 * @param arg a pointer to child_arg give in SelvaHierarchyCallback structure.
 */
typedef void (*SelvaHierarchyChildCallback)(
        struct SelvaHierarchy *hierarchy,
        const struct SelvaHierarchyTraversalMetadata *metadata,
        struct SelvaHierarchyNode *child,
        void *arg);

int SelvaTraversal_FieldsContains(struct SelvaObject *fields, const char *field_name_str, size_t field_name_len);

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
