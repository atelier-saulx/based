/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef _SELVA_HIERARCHY_H_
#define _SELVA_HIERARCHY_H_

#include <stdint.h>
#include "linker_set.h"
#include "selva_db.h"
#include "util/svector.h"
#include "util/mempool.h"
#include "util/trx.h"
#include "util/poptop.h"
#include "tree.h"
#include "edge.h"
#include "selva_object.h"
#include "selva_set.h"
#include "subscriptions.h"

#define HIERARCHY_ENCODING_VERSION  6

/**
 * Hierarchy node pool sizes with a varying number of embedded fields.
 */
#define HIERARCHY_NODEPOOL_SIZES(apply) \
    apply(2) \
    apply(5) \
    apply(10) \
    apply(15)

#define HIERARCHY_NODEPOOL_COUNT_1(v) \
    + 1

#define HIERARCHY_NODEPOOL_COUNT \
    (0 + HIERARCHY_NODEPOOL_SIZES(HIERARCHY_NODEPOOL_COUNT_1))

/* Forward declarations */
struct SelvaHierarchy;
struct SelvaHierarchyNode;
struct Selva_Subscription;
struct ida;
struct selva_server_response_out;
struct selva_string;
/* End of forward declarations */

typedef struct SelvaHierarchy SelvaHierarchy;

/**
 * Hierarchy node metadata.
 * This structure should contain primitive data types or pointers to forward
 * declared structures.
 */
struct SelvaHierarchyMetadata {
    /**
     * Subscription markers.
     */
    struct Selva_SubscriptionMarkers sub_markers;
    struct EdgeFieldContainer edge_fields;
};

typedef void SelvaHierarchyMetadataConstructorHook(
        const Selva_NodeId id,
        struct SelvaHierarchyMetadata *metadata);
typedef void SelvaHierarchyMetadataDestructorHook(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        struct SelvaHierarchyMetadata *metadata);

/**
 * Hierarchy node metadata constructor.
 * Declare a hook function that should be called when a new node is being
 * created. The function signature is SelvaHierarchyMetadataConstructorHook.
 */
#define SELVA_MODIFY_HIERARCHY_METADATA_CONSTRUCTOR(fun) \
    DATA_SET(selva_HMCtor, fun)

/**
 * Hierarchy node metadata destructor.
 * Declare a hook function that should be called when a node is being
 * destroyed. The function signature is SelvaHierarchyMetadataDestructorHook.
 */
#define SELVA_MODIFY_HIERARCHY_METADATA_DESTRUCTOR(fun) \
    DATA_SET(selva_HMDtor, fun)

RB_HEAD(hierarchy_index_tree, SelvaHierarchyNode);
RB_HEAD(hierarchy_subscriptions_tree, Selva_Subscription);
RB_HEAD(hierarchy_subscription_markers_tree, Selva_SubscriptionMarker);

/**
 * Node flags changing the node behavior.
 */
enum SelvaNodeFlags {
    /**
     * Detached node.
     * When set this is the head of a compressed subtree stored in
     * hierarchy_detached. Some information has been removed from the node
     * and the subtree must be restored to make this node usable.
     */
    SELVA_NODE_FLAGS_DETACHED = 0x01,
    /**
     * Implicitly created node.
     * Nodes that are created through child or references lists are implicit.
     * The flag should be cleared when the node is actually taken into use.
     */
    SELVA_NODE_FLAGS_IMPLICIT = 0x02,
} __packed;

/**
 * The core type of Selva hierarchy.
 */
typedef struct SelvaHierarchyNode {
    Selva_NodeId id; /* Must be first. */
    enum SelvaNodeFlags flags;
    /**
     * Expiration timestamp for this node.
     * epoch = UNIX 2023-01-01T00:00:00Z = 1672531200000 (UNIX)
     * 0 = never expires
     * As this is a 32-bit unsigned integer, it means that we should be good
     * until the year 2106.
     * 1970+(2^32)/60/60/24/365 = 2106
     */
    uint32_t expire;
    struct trx_label trx_label;
    struct SelvaHierarchyMetadata metadata;
    RB_ENTRY(SelvaHierarchyNode) _index_entry;
    STATIC_SELVA_OBJECT(_obj_data);
} SelvaHierarchyNode;

struct SelvaHierarchy {
    /**
     * Global transaction state.
     */
    struct trx_state trx_state;

    int flag_isSaving;

    /**
     * Index of all hierarchy nodes by ID.
     */
    struct hierarchy_index_tree index_head;
    struct mempool nodepool[HIERARCHY_NODEPOOL_COUNT];

    /**
     * Root node.
     */
    struct SelvaHierarchyNode root;
    char root_emb_fields[SELVA_OBJECT_EMB_SIZE(2)]; /* TODO Needs #define for schema */

    /*
     * Schema.
     */
    char *types; /*!< List of all type prefixes terminated with the SELVA_NULL_TYPE. */
    struct SelvaHierarchySchema {
        size_t count;
        struct SelvaHierarchySchemaNode {
            struct {
                uint32_t nr_emb_fields: 16;
                uint32_t created_en: 1;
                uint32_t updated_en: 1;
                uint32_t _spare: 14;
            };
            struct EdgeFieldConstraints efc;
        } node[] __counted_by(count);
    } *schema;

    /**
     * Aliases.
     */
    struct {
        STATIC_SELVA_OBJECT(_obj_data);
    } aliases;

    struct {
        /**
         * A tree of all subscriptions applying to this tree.
         */
        struct hierarchy_subscriptions_tree subs_head;

        /**
         * A tree of all markers.
         */
        struct hierarchy_subscription_markers_tree mrks_head;

        /**
         * Subscription markers for missing accessors (nodeIds and aliases).
         *
         * These are single-shot markers that will be deleted once the
         * condition is met. The markers are stored only in this object in
         * the following format:
         *
         * ```
         * {
         *   nodeIdOrAlias.subId => struct Selva_Subscription *
         * }
         * ```
         *
         * When a subscription is removed the markers for missing nodes should
         * be deleted.
         */
        struct {
            STATIC_SELVA_OBJECT(_obj_data);
        } missing;

        /**
         * Special subscription markers.
         * Possible reasons to add a subscription marker to this list are:
         * - the marker is applying to all nodes starting from the root node
         *   towards descendants
         * - the marker is applying to all nodes
         * - the marker is applying to new nodes
         * - the marker is applying to deletions
         */
        struct Selva_SubscriptionMarkers detached_markers;

        /**
         * Deferred subscription events.
         * The events are deduplicated by subscription ID and the events will
         * be sent out when SelvaSubscriptions_SendDeferredEvents() is called.
         *
         * The intended type in this list is struct Selva_Subscription.
         */
        struct SelvaSubscriptions_DeferredEvents deferred_events;
    } subs;

    struct {
        int nr_indices; /*!< Total number of active indices. */
        int proc_timer_active; /*!< The indexing decission proc timer is active. */
        int proc_timer_id; /*!< The indexing decission proc timer id. */
        struct ida *ida; /*!< Id allocator for subscription marker ids. */
        struct poptop top_indices; /*!< A list of top requested indices. */
        struct SelvaObject *index_map;
    } dyn_index;

    /**
     * State for inactive nodes tracking.
     * These are nodes potentially moving to the detached hierarchy.
     */
    struct {
        /**
         * A timer used by auto compression.
         */
        int auto_compress_timer;
        size_t nr_nodes; /*!< Size of nodes. */
        /**
         * Inactive nodeIds.
         * Inactive node ids are listed here during serialization for further
         * processing. This is a pointer to a memory region shared with the
         * serialization child process. We can access it lock free because we
         * know exactly when it's being read and thus can avoid writing it at
         * those times. NodeIds listed here have been inactive for a long time
         * and are potential candidates for compression.
         */
        Selva_NodeId *nodes __counted_by(nr_nodes);
        size_t next; /*!< Next empty slot in inactive_nodes. */
    } inactive;

    /**
     * Storage descriptor for detached nodes.
     * It's possible to determine if a node exists in a detached subtree and restore
     * the node and its subtree using this structure.
     */
    struct {
        /**
         * The object maps each detached nodeId to a pointer that describes where
         * the detached subtree containing the nodeId is located. E.g. it can be
         * a tagged pointer to a selva_string that contains a compressed
         * subtree string.
         */
        struct SelvaObject *obj;
    } detached;

    /**
     * Expiring nodes.
     */
    struct {
        int tim_id; /*!< 1 sec timer. */
        SVector list; /*!< List of all expiring nodes. */
#define HIERARCHY_EXPIRING_NEVER UINT32_MAX
        /**
         * Timestamp of the node expiring next.
         * Set to HIERARCHY_EXPIRING_NEVER if nothing is expiring.
         */
        uint32_t next;
    } expiring;
};

/**
 * Callback descriptor used for traversals.
 */
struct SelvaHierarchyCallback {
    /**
     * Called for each orphan head in the hierarchy.
     */
    SelvaHierarchyNodeCallback head_cb;
    void *head_arg;

    /**
     * Called for each node in the hierarchy.
     */
    SelvaHierarchyNodeCallback node_cb;
    void *node_arg;

    /**
     * Called for each child of current node.
     * The return value of this function is typically ignored/discarded.
     */
    SelvaHierarchyNodeCallback child_cb;
    void *child_arg;

    enum SelvaHierarchyCallbackFlags {
        SELVA_HIERARCHY_CALLBACK_FLAGS_INHIBIT_RESTORE = 0x01,
    } flags;
};

/**
 * Flags for SelvaModify_DelHierarchyNode().
 */
enum SelvaModify_DelHierarchyNodeFlag {
    DEL_HIERARCHY_NODE_FORCE = 0x01, /*!< Force delete regardless of existing parents and external edge references. */
    DEL_HIERARCHY_NODE_DETACH = 0x02, /*!< Delete, mark as detached. Note that this doesn't disable sending subscription events. */
    DEL_HIERARCHY_NODE_REPLY_IDS = 0x04, /*!< Send the deleted nodeIds as a reply to the client. */
};

/**
 * Create a new hierarchy.
 */
SelvaHierarchy *SelvaModify_NewHierarchy(void);

/**
 * Free a hierarchy.
 */
void SelvaHierarchy_Destroy(SelvaHierarchy *hierarchy);

struct SelvaHierarchySchemaNode *SelvaHierarchy_FindNodeSchema(struct SelvaHierarchy *hierarchy, const Selva_NodeType type);

/**
 * Copy nodeId to a buffer.
 * @param[out] id is a pointer to a Selva_NodeId.
 * @param node is a pointer to a hierarchy node.
 * @returns id.
 */
static inline char *SelvaHierarchy_GetNodeId(Selva_NodeId id, const struct SelvaHierarchyNode *node) {
    const char *buf = (const char *)node;

    /* We know the id is the first thing in the struct. */
    __builtin_memcpy(id, buf, SELVA_NODE_ID_SIZE);

    return id;
}

/**
 * Get the type of a node.
 * @param[out] type is a pointer to char array that can hold a node type.
 * @param node is a pointer to a hierarchy node.
 * @returns type.
 */
static inline char *SelvaHierarchy_GetNodeType(char type[SELVA_NODE_TYPE_SIZE], const struct SelvaHierarchyNode *node) {
    const char *buf = (const char *)node;

    __builtin_memcpy(type, buf, SELVA_NODE_TYPE_SIZE);

    return type;
}

/**
 * Get the SelvaObject of a hierarchy node.
 * @returns a pointer to the SelvaObject of node.
 */
struct SelvaObject *SelvaHierarchy_GetNodeObject(const struct SelvaHierarchyNode *node);

const struct SelvaHierarchyMetadata *_SelvaHierarchy_GetNodeMetadataByConstPtr(const struct SelvaHierarchyNode *node)
    __attribute__((pure, access(read_only, 1)));
struct SelvaHierarchyMetadata *_SelvaHierarchy_GetNodeMetadataByPtr(struct SelvaHierarchyNode *node)
    __attribute__((pure, access(read_only, 1)));
/**
 * Get node metadata by a pointer to the node.
 */
#define SelvaHierarchy_GetNodeMetadataByPtr(node) _Generic((node), \
        const struct SelvaHierarchyNode *: _SelvaHierarchy_GetNodeMetadataByConstPtr, \
        struct SelvaHierarchyNode *: _SelvaHierarchy_GetNodeMetadataByPtr \
        )(node)

/**
 * Get node metadata by nodeId.
 */
struct SelvaHierarchyMetadata *SelvaHierarchy_GetNodeMetadata(
        SelvaHierarchy *hierarchy,
        const Selva_NodeId id)
    __attribute__((access(read_only, 2)));

/**
 * Get edge metadata.
 * Supports both hierarchy parents/children metadata as well as Edge metadata.
 */
int SelvaHierarchy_GetEdgeMetadata(
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        const Selva_NodeId dst_node_id,
        bool delete_all,
        bool create,
        struct SelvaObject **out)
    __attribute__((access(read_only, 2, 3), access(read_only, 4), access(write_only, 7)));

struct SelvaObject *SelvaHierarchy_GetEdgeMetadataByTraversal(
        const struct SelvaHierarchyTraversalMetadata *traversal_metadata,
        struct SelvaHierarchyNode *node);

int SelvaHierarchy_ClearNodeFlagImplicit(struct SelvaHierarchyNode *node)
    __attribute((access(read_write, 1)));

/**
 * Clear all user fields of a node SelvaObject.
 */
void SelvaHierarchy_ClearNodeFields(struct SelvaObject *obj)
    __attribute__((access(read_write, 1)));

enum SelvaModify_SetFlags {
    SELVA_MODIFY_SET_FLAG_NO_ROOT = 0x01,
};

/**
 * Set node relationships relative to other existing nodes.
 * Previously existing connections to and from other nodes are be removed.
 * If a node with id doesn't exist it will be created.
 * TODO This should be removed in favor of UsertNode().
 * @param parents   Sets these nodes and only these nodes as parents of this node.
 * @param children  Sets these nodes and only these nodes as children of this node.
 */
int SelvaModify_SetHierarchy(
        SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        enum SelvaModify_SetFlags flags,
        struct SelvaHierarchyNode **node_out)
    __attribute__((access(read_write, 1), access(read_only, 2), access(read_only, 4, 3), access(read_only, 6, 5), access(write_only, 8)));

int SelvaHierarchy_UpsertNode(
        SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        struct SelvaHierarchyNode **out)
    __attribute__((access(read_write, 1), access(read_only, 2), access(write_only, 3)));

/**
 * Delete a node from the hierarchy.
 * @param flags if force is set then even children that have other relationships
 *              will be deleted.
 * @returns The total number of nodes deleted; Otherwise an error code is returned.
 */
int SelvaModify_DelHierarchyNode(
        struct selva_server_response_out *resp,
        SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        enum SelvaModify_DelHierarchyNodeFlag flags)
    __attribute__((access(read_write, 2), access(read_only, 3)));

/**
 * Get an opaque pointer to a hierarchy node.
 * Do not use this function unless you absolutely need it as the safest and
 * better supporter way to refer to hierarchy nodes is by using nodeId.
 */
struct SelvaHierarchyNode *SelvaHierarchy_FindNode(SelvaHierarchy *hierarchy, const Selva_NodeId id)
    __attribute__((access(read_only, 2)));

/**
 * Check if node exists.
 */
static inline int SelvaHierarchy_NodeExists(SelvaHierarchy *hierarchy, const Selva_NodeId id) {
    return SelvaHierarchy_FindNode(hierarchy, id) != NULL;
}

/**
 * Alias to node_id.
 */
int get_alias_str(struct SelvaHierarchy *hierarchy, const char *ref_str, size_t ref_len, Selva_NodeId node_id)
    __attribute__((access(read_only, 2, 3), access(write_only, 4)));

/**
 * Alias to node_id.
 */
int get_alias(struct SelvaHierarchy *hierarchy, const struct selva_string *ref, Selva_NodeId node_id)
    __attribute__((access(read_only, 2), access(write_only, 3)));

/**
 * Remove an alias.
 * Caller must update the node aliases if necessary.
 */
int delete_alias(struct SelvaHierarchy *hierarchy, struct selva_string *ref)
    __attribute__((access(read_write, 1), access(read_only, 2)));

/**
 * Delete all aliases of the node.
 */
void delete_all_node_aliases(SelvaHierarchy *hierarchy, struct SelvaObject *node_obj)
    __attribute__((access(read_write, 1), access(read_write, 2)));

/**
 * Update alias into the aliases key and remove the previous alias.
 * Caller must set the alias to the new node.
 */
void update_alias(SelvaHierarchy *hierarchy, const Selva_NodeId node_id, const struct selva_string *ref)
    __attribute__((access(read_write, 1), access(read_only, 2), access(read_only, 3)));

int SelvaHierarchy_TraverseAll(struct SelvaHierarchy *hierarchy, const struct SelvaHierarchyCallback *cb);

/**
 * Traverse the hierarchy.
 * Implements:
 * - SELVA_HIERARCHY_TRAVERSAL_NONE
 * - SELVA_HIERARCHY_TRAVERSAL_NODE
 * - SELVA_HIERARCHY_TRAVERSAL_ALL
 */
int SelvaHierarchy_Traverse(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        enum SelvaTraversal dir,
        const struct SelvaHierarchyCallback *cb)
    __attribute__((access(read_only, 2)));

/**
 * Traverse an edge field.
 * Implements:
 * - SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD
 */
int SelvaHierarchy_TraverseEdgeField(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        const char *ref_field_str,
        size_t ref_field_len,
        const struct SelvaHierarchyCallback *cb)
    __attribute__((access(read_only, 2), access(read_only, 3, 4)));

/**
 * Traverse an edge field using BFS.
 * Implements:
 * - SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD
 */
int SelvaHierarchy_TraverseEdgeFieldBfs(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        const char *field_name_str,
        size_t field_name_len,
        const struct SelvaHierarchyCallback *cb)
    __attribute__((access(read_only, 2), access(read_only, 3, 4)));

/**
 * Traverse a field by first doing a full lookup.
 * Implements:
 * - SELVA_HIERARCHY_TRAVERSAL_FIELD
 * Supported callbacks:
 * - head_cb
 * - node_cb
 * - ary_cb
 */
int SelvaHierarchy_TraverseField2(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId node_id,
        const char *ref_field_str,
        size_t ref_field_len,
        const struct SelvaHierarchyCallback *hcb)
    __attribute__((access(read_only, 2), access(read_only, 3, 4)));

/**
 * Traverse fields by first doing a full lookup and using BFS.
 * Implements:
 * - SELVA_HIERARCHY_TRAVERSAL_BFS_FIELD
 */
int SelvaHierarchy_TraverseField2Bfs(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId node_id,
        const char *ref_field_str,
        size_t ref_field_len,
        const struct SelvaHierarchyCallback *hcb)
    __attribute__((access(read_only, 2), access(read_only, 3, 4)));

/**
 * Traverse a field by expression.
 * Implements:
 * - SELVA_HIERARCHY_TRAVERSAL_EXPRESSION
 */
int SelvaHierarchy_TraverseExpression(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        struct rpn_ctx *rpn_ctx,
        const struct rpn_expression *rpn_expr,
        struct rpn_ctx *edge_filter_ctx,
        const struct rpn_expression *edge_filter,
        const struct SelvaHierarchyCallback *cb)
    __attribute__((access(read_only, 2)));

/**
 * Traverse a field by expression using BFS.
 * Implements:
 * - SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION
 */
int SelvaHierarchy_TraverseExpressionBfs(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        struct rpn_ctx *rpn_ctx,
        const struct rpn_expression *rpn_expr,
        struct rpn_ctx *edge_filter_ctx,
        const struct rpn_expression *edge_filter,
        const struct SelvaHierarchyCallback *cb)
    __attribute__((access(read_only, 2)));

/**
 * Foreach value in a set field.
 */
int SelvaHierarchy_TraverseSet(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        const char *field_str,
        size_t field_len,
        const struct SelvaObjectSetForeachCallback *cb)
    __attribute__((access(read_only, 2), access(read_only, 3, 4)));

/**
 * Foreach value in a set-like field.
 * Traverse each value (foreach) in a field.
 * Supported fields:
 * - parents
 * - children
 * - ancestors
 * - descendants
 * - string and numeric array fields
 * - string and numeric set fields
 */
int SelvaHierarchy_ForeachInField(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        const struct SelvaObjectSetForeachCallback *cb)
    __attribute__((access(read_only, 3, 4)));

/**
 * Check if the field is a non-empty hierarchy field.
 */
int SelvaHierarchy_IsNonEmptyField(const struct SelvaHierarchyNode *node, const char *field_str, size_t field_len)
    __attribute((access(read_only, 2, 3)));

/*
 * hierarchy_reply.c
 */

/**
 * Reply with a hierarchy traversal.
 * [nodeId1, nodeId2,.. nodeIdn]
 */
int HierarchyReply_WithTraversal(
        struct selva_server_response_out *resp,
        SelvaHierarchy *hierarchy,
        const Selva_NodeId nodeId,
        size_t nr_types,
        const Selva_NodeType types[nr_types],
        enum SelvaTraversal dir)
    __attribute__((access(read_only, 3), access(read_only, 5, 4)));

SelvaHierarchy *Hierarchy_Load(struct selva_io *io);
void Hierarchy_Save(struct selva_io *io, SelvaHierarchy *hierarchy);

extern SelvaHierarchy *main_hierarchy;

#endif /* _SELVA_HIERARCHY_H_ */
