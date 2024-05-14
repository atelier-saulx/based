/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#define SELVA_IO_TYPE
#include <alloca.h>
#include <assert.h>
#include <errno.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <time.h>
#include "jemalloc.h"
#include "util/auto_free.h"
#include "util/backoff_timeout.h"
#include "util/ctime.h"
#include "util/finalizer.h"
#include "util/ptag.h"
#include "util/selva_proto_builder.h"
#include "util/selva_string.h"
#include "util/svector.h"
#include "util/timestamp.h"
#include "sha3iuf/sha3.h"
#include "event_loop.h"
#include "selva_db.h"
#include "selva_error.h"
#include "selva_io.h"
#include "selva_log.h"
#include "selva_proto.h"
#include "selva_server.h"
#include "db_config.h"
#include "edge.h"
#include "field_lookup.h"
#include "parsers.h"
#include "rpn.h"
#include "selva_index.h"
#include "selva_object.h"
#include "selva_onload.h"
#include "selva_set.h"
#include "selva_trace.h"
#include "subscriptions.h"
#include "traversal.h"
#include "schema.h"
#include "hierarchy.h"

#define TO_EXPIRE(_ts_) ((uint32_t)((_ts_) - SELVA_HIERARCHY_EXPIRE_EPOCH))
#define FROM_EXPIRE(_expire_) ((time_t)(_expire_) + SELVA_HIERARCHY_EXPIRE_EPOCH)
#define IS_EXPIRED(_expire_, _now_) ((time_t)(_expire_) + SELVA_HIERARCHY_EXPIRE_EPOCH <= (time_t)(_now_))

/**
 * Filter struct used for RB searches from hierarchy_index_tree.
 * This should somewhat match to SelvaHierarchyNode to the level necessary for
 * comparing nodes.
 */
struct SelvaHierarchySearchFilter {
    Selva_NodeId id;
};

/**
 * Structure for traversal cb of verifyDetachableSubtree().
 */
struct verifyDetachableSubtree {
    const char *err; /*!< Set to a reason string if subtree doesn't verify. */
    struct trx trx_cur; /*!< This is used to check if the children of node form a true subtree. */
    SelvaHierarchyNode *head;
    struct SelvaSet edge_origin_node_ids;
};

/**
 * HierarchySaveNode() args struct.
 */
struct HierarchySaveNode {
    struct selva_io *io;
};

/**
 * Period to check for expiring nodes.
 * The resolution of the expire property is 1 sec.
 */
static const struct timespec hierarchy_expire_period = {
    .tv_sec = 1,
};

static void SelvaHierarchy_DestroyNode(
        SelvaHierarchy *hierarchy,
        SelvaHierarchyNode *node);
static void hierarchy_expire_tim_proc(struct event *e __unused, void *data);
static void hierarchy_set_expire(struct SelvaHierarchy *hierarchy, SelvaHierarchyNode *node, time_t expire);
RB_PROTOTYPE_STATIC(hierarchy_index_tree, SelvaHierarchyNode, _index_entry, SelvaHierarchyNode_Compare)

/* Node metadata constructors. */
SET_DECLARE(selva_HMCtor, SelvaHierarchyMetadataConstructorHook);
/* Node metadata destructors. */
SET_DECLARE(selva_HMDtor, SelvaHierarchyMetadataDestructorHook);

__nonstring static const Selva_NodeId HIERARCHY_SERIALIZATION_EOF;

SelvaHierarchy *main_hierarchy;

SELVA_TRACE_HANDLE(find_inmem);
SELVA_TRACE_HANDLE(traverse_edge_field);
SELVA_TRACE_HANDLE(traverse_bfs_ancestors);
SELVA_TRACE_HANDLE(traverse_bfs_descendants);
SELVA_TRACE_HANDLE(traversal_array);

/**
 * A pointer to the hierarchy subtree being loaded.
 * Redis doesn't allow passing any pointers when loading a stringified RDB so a
 * global variable is needed for Hierarchy_SubtreeLoad().
 */
static int isDecompressingSubtree;
static int flag_isLoading;

static int isLoading(void) {
    return flag_isLoading || isDecompressingSubtree;
}

static int SVector_HierarchyNode_expire_compare(const void ** restrict a_raw, const void ** restrict b_raw) {
    const SelvaHierarchyNode *a = *(const SelvaHierarchyNode **)a_raw;
    const SelvaHierarchyNode *b = *(const SelvaHierarchyNode **)b_raw;
    int diff;

    assert(a && b);

    diff = a->expire - b->expire;
    if (diff) {
        return diff;
    }

    return memcmp(a->id, b->id, SELVA_NODE_ID_SIZE);
}

static int SelvaHierarchyNode_Compare(const SelvaHierarchyNode *a, const SelvaHierarchyNode *b) {
    return memcmp(a->id, b->id, SELVA_NODE_ID_SIZE);
}

RB_GENERATE_STATIC(hierarchy_index_tree, SelvaHierarchyNode, _index_entry, SelvaHierarchyNode_Compare)

static void init_nodepools(struct SelvaHierarchy *hierarchy) {
#define DECLARE_NODE_SIZE(v) \
    struct node_size##v { \
        struct SelvaHierarchyNode node; \
        char emb_fields[SELVA_OBJECT_EMB_SIZE(v)]; \
    };

    HIERARCHY_NODEPOOL_SIZES(DECLARE_NODE_SIZE)

#define NODEPOOL_SIZE_EL(v) \
    sizeof(struct node_size##v),
#define NODEPOOL_ALIGN_EL(v) \
    _Alignof(struct node_size##v),

    size_t sizes[] = {
        HIERARCHY_NODEPOOL_SIZES(NODEPOOL_SIZE_EL)
    };
    size_t aligns[] = {
        HIERARCHY_NODEPOOL_SIZES(NODEPOOL_ALIGN_EL)
    };

    for (size_t i = 0; i < HIERARCHY_NODEPOOL_COUNT; i++) {
        mempool_init(&hierarchy->nodepool[i], HIERARCHY_SLAB_SIZE, sizes[i], aligns[i]);
    }

#undef DECLARE_NODE_SIZE
#undef NODEPOOL_SIZE_EL
#undef NODEPOOL_ALIGN_EL
}

static void deinit_nodepools(struct SelvaHierarchy *hierarchy) {
    for (size_t i = 0; i < HIERARCHY_NODEPOOL_COUNT; i++) {
        mempool_destroy(&hierarchy->nodepool[i]);
    }
}

SelvaHierarchy *SelvaModify_NewHierarchy(void) {
    struct SelvaHierarchy *hierarchy = selva_calloc(1, sizeof(*hierarchy));

    init_nodepools(hierarchy);
    RB_INIT(&hierarchy->index_head);
    SelvaObject_Init(hierarchy->aliases._obj_data, 0);
    SelvaSchema_SetDefaultSchema(hierarchy);
    SelvaSubscriptions_InitHierarchy(hierarchy);
    SelvaIndex_Init(hierarchy);

    SVector_Init(&hierarchy->expiring.list, 0, SVector_HierarchyNode_expire_compare);
    hierarchy->expiring.next = HIERARCHY_EXPIRING_NEVER;
    hierarchy->expiring.tim_id = evl_set_timeout(&hierarchy_expire_period, hierarchy_expire_tim_proc, hierarchy);

    return hierarchy;
}

void SelvaHierarchy_Destroy(SelvaHierarchy *hierarchy) {
    SelvaHierarchyNode *node;
    SelvaHierarchyNode *next;

    /*
     * Destroy expire control.
     */
    evl_clear_timeout(hierarchy->expiring.tim_id, NULL);
    SVector_Destroy(&hierarchy->expiring.list);

    for (node = RB_MIN(hierarchy_index_tree, &hierarchy->index_head); node != NULL; node = next) {
        next = RB_NEXT(hierarchy_index_tree, &hierarchy->index_head, node);
        RB_REMOVE(hierarchy_index_tree, &hierarchy->index_head, node);
        SelvaHierarchy_DestroyNode(hierarchy, node);
    }

    SelvaSubscriptions_DestroyAll(hierarchy);
    /*
     * If SelvaSubscriptions_DestroyAll() is ran first then we don't need to
     * bother about cleaning up subscriptions used by the indexing.
     */
    SelvaIndex_Deinit(hierarchy);
    selva_free(hierarchy->types);
    SelvaSchema_Destroy(hierarchy->schema);

    deinit_nodepools(hierarchy);

    memset(hierarchy, 0, sizeof(*hierarchy));
    selva_free(hierarchy);
}

/**
 * Create the default fields of a node object.
 */
static void create_node_object(struct SelvaHierarchy *hierarchy, struct SelvaHierarchyNode *node) {
    const long long now = ts_now();
    struct SelvaNodeSchema *ns;
    struct SelvaObject *obj;

    ns = SelvaSchema_FindNodeSchema(hierarchy, node->id);
    obj = SelvaObject_Init(node->_obj_data, SELVA_OBJECT_EMB_SIZE(ns->nr_emb_fields));

    if (ns->updated_field[0] != '\0') {
        SelvaObject_SetLongLongStr(obj, ns->updated_field, selva_short_field_len(ns->updated_field), now);
    }
    if (ns->created_field[0] != '\0') {
        SelvaObject_SetLongLongStr(obj, ns->created_field, selva_short_field_len(ns->created_field), now);
    }
}

/*
 * This function is not really necessary but we have it to make sure that
 * the metadata constructor linker set is always created.
 */
static void node_metadata_init(
        const Selva_NodeId id __unused,
        struct SelvaHierarchyMetadata *metadata __unused) {
    /* NOP */
}
SELVA_MODIFY_HIERARCHY_METADATA_CONSTRUCTOR(node_metadata_init);

static SelvaHierarchyNode *init_node(struct SelvaHierarchy *hierarchy, SelvaHierarchyNode *node, const Selva_NodeId id) {
    memset(node, 0, sizeof(*node));
    memcpy(node->id, id, SELVA_NODE_ID_SIZE);

#if 0
    SELVA_LOG(SELVA_LOGL_DBG, "Creating node %.*s",
              (int)SELVA_NODE_ID_SIZE, id);
#endif

    create_node_object(hierarchy, node);

    SelvaHierarchyMetadataConstructorHook **metadata_ctor_p;

    SET_FOREACH(metadata_ctor_p, selva_HMCtor) {
        SelvaHierarchyMetadataConstructorHook *ctor = *metadata_ctor_p;
        ctor(node->id, &node->metadata);
    }

    return node;
}

static struct mempool *get_nodepool_by_type(struct SelvaHierarchy *hierarchy, const Selva_NodeType type) {
    struct SelvaNodeSchema *ns = SelvaSchema_FindNodeSchema(hierarchy, type);
    size_t nr_emb_fields = ns->nr_emb_fields;
    size_t i = 0;

#define FIND_BEST_POOL(v) \
    if (nr_emb_fields <= v) return &hierarchy->nodepool[i]; else i++;

    HIERARCHY_NODEPOOL_SIZES(FIND_BEST_POOL)
    return &hierarchy->nodepool[HIERARCHY_NODEPOOL_COUNT - 1];

#undef FIND_BEST_POOL
}

/**
 * Create a new node.
 */
static SelvaHierarchyNode *newNode(struct SelvaHierarchy *hierarchy, const Selva_NodeId id) {
    if (!memcmp(id, EMPTY_NODE_ID, SELVA_NODE_ID_SIZE) ||
        !memcmp(id, HIERARCHY_SERIALIZATION_EOF, SELVA_NODE_ID_SIZE)) {
        SELVA_LOG(SELVA_LOGL_WARN, "An attempt to create a node with a reserved id");
        return NULL;
    }

    return init_node(hierarchy, mempool_get(get_nodepool_by_type(hierarchy, id)), id);
}

/**
 * Destroy node.
 */
static void SelvaHierarchy_DestroyNode(SelvaHierarchy *hierarchy, SelvaHierarchyNode *node) {
    Selva_NodeType type;
    SelvaHierarchyMetadataDestructorHook **dtor_p;

    memcpy(type, node->id, SELVA_NODE_TYPE_SIZE);

    hierarchy_set_expire(hierarchy, node, 0); /* Remove expire */

    SET_FOREACH(dtor_p, selva_HMDtor) {
        SelvaHierarchyMetadataDestructorHook *dtor = *dtor_p;
        dtor(hierarchy, node, &node->metadata);
    }

    SelvaObject_Destroy(SelvaHierarchy_GetNodeObject(node));
#if MEM_DEBUG
    memset(node, 0, sizeof(*node));
#endif

    mempool_return(get_nodepool_by_type(hierarchy, type), node);
}

/**
 * Search from the normal node index.
 */
static SelvaHierarchyNode *find_node_index(SelvaHierarchy *hierarchy, const Selva_NodeId id) {
    struct SelvaHierarchySearchFilter filter;
    SelvaHierarchyNode *node;

    memcpy(&filter.id, id, SELVA_NODE_ID_SIZE);
    node = RB_FIND(hierarchy_index_tree, &hierarchy->index_head, (SelvaHierarchyNode *)(&filter));

    return node;
}

SelvaHierarchyNode *SelvaHierarchy_FindNode(SelvaHierarchy *hierarchy, const Selva_NodeId id) {
    SelvaHierarchyNode *node;

    SELVA_TRACE_BEGIN(find_inmem);
    node = find_node_index(hierarchy, id);
    SELVA_TRACE_END(find_inmem);

    return node;
}

struct SelvaHierarchyMetadata *SelvaHierarchy_GetNodeMetadata(
        SelvaHierarchy *hierarchy,
        const Selva_NodeId id) {
    SelvaHierarchyNode *node;

    node = SelvaHierarchy_FindNode(hierarchy, id);

    return !node ? NULL : &node->metadata;
}

int SelvaHierarchy_GetEdgeMetadata(
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        const Selva_NodeId dst_node_id,
        bool delete_all,
        bool create,
        struct SelvaObject **out) {
    struct EdgeField *edge_field;

    edge_field = Edge_GetField(node, field_str, field_len);
    if (!edge_field) {
        return SELVA_HIERARCHY_ENOENT;
    }

    if (delete_all) {
        Edge_DeleteFieldMetadata(edge_field);
        if (!create) {
            *out = NULL;
            return 0;
        }
    }

    return Edge_GetFieldEdgeMetadata(edge_field, dst_node_id, create, out);
}

/**
 * Get edge metadata.
 * @param node is the destination node.
 * @param adj_vec is the source vector.
 */
static struct SelvaObject *get_edge_metadata(struct SelvaHierarchyNode *node, enum SelvaTraversal field_type, const SVector *adj_vec) {
    struct SelvaObject *edge_metadata = NULL;

    if (field_type == SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD) {
        struct EdgeField *edge_field = containerof(adj_vec, struct EdgeField, arcs);
        (void)Edge_GetFieldEdgeMetadata(edge_field, node->id, false, &edge_metadata);
    }

    return edge_metadata;
}

struct SelvaObject *SelvaHierarchy_GetEdgeMetadataByTraversal(const struct SelvaHierarchyTraversalMetadata *traversal_metadata, struct SelvaHierarchyNode *node) {
    const enum SelvaHierarchyTraversalSVecPtag tag = PTAG_GETTAG(traversal_metadata->origin_field_svec_tagp);
    enum SelvaTraversal field_type;

    switch (tag) {
    case SELVA_TRAVERSAL_SVECTOR_PTAG_EDGE:
        field_type = SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD;
        break;
    default:
        abort();
    }

    return get_edge_metadata(node, field_type, PTAG_GETP(traversal_metadata->origin_field_svec_tagp));
}

void SelvaHierarchy_ClearNodeFields(struct SelvaHierarchy *hierarchy, struct SelvaHierarchyNode *node) {
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(node);
    struct SelvaNodeSchema *ns = SelvaSchema_FindNodeSchema(hierarchy, node->id);
    const char *excluded_fields[] = {
        SELVA_ID_FIELD,
        SELVA_ALIASES_FIELD,
        NULL, /* TODO Created field */
        NULL, /* TODO Updated field */
        NULL,
    };
    size_t i = 2;

    if (ns->created_field[0] != '\0') {
        excluded_fields[i++] = ns->created_field;
    }
    if (ns->updated_field[0] != '\0') {
        excluded_fields[i++] = ns->updated_field;
    }

    SelvaObject_Clear(obj, excluded_fields);
}

static void del_node(SelvaHierarchy *hierarchy, SelvaHierarchyNode *node) {
    const int send_events = !isLoading();
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(node);

    if (send_events) {
        SelvaSubscriptions_DeferTriggerEvents(hierarchy, node, SELVA_SUBSCRIPTION_TRIGGER_TYPE_DELETED);
    }

    delete_all_node_aliases(hierarchy, obj);
    RB_REMOVE(hierarchy_index_tree, &hierarchy->index_head, node);
    SelvaHierarchy_DestroyNode(hierarchy, node);

    /* TODO Do this sometimes. */
#if 0
        for (size_t i = 0; i < HIERARCHY_NODEPOOL_COUNT; i++) {
            mempool_gc(&hierarchy->nodepool[i]);
        }
#endif
}

/**
 * Actions that must be executed for a new node.
 * Generally this must be always called after newNode().
 */
static void publishNewNode(SelvaHierarchy *hierarchy, SelvaHierarchyNode *node) {
    if (!isLoading()) {
        struct SelvaNodeSchema *ns;

        ns = SelvaSchema_FindNodeSchema(hierarchy, node->id);
        if (ns->created_field[0] != '\0') {
            SelvaSubscriptions_DeferFieldChangeEvents(hierarchy, node, ns->created_field, selva_short_field_len(ns->created_field));
        }
        if (ns->updated_field[0] != '\0') {
            SelvaSubscriptions_DeferFieldChangeEvents(hierarchy, node, ns->updated_field, selva_short_field_len(ns->updated_field));
        }
        SelvaSubscriptions_DeferMissingAccessorEvents(hierarchy, node->id, SELVA_NODE_ID_SIZE);
    }
}

static inline SelvaHierarchyNode *index_new_node(SelvaHierarchy *hierarchy, SelvaHierarchyNode *node) {
    return RB_INSERT(hierarchy_index_tree, &hierarchy->index_head, node);
}

int SelvaHierarchy_UpsertNode(
        SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        SelvaHierarchyNode **out) {
    SelvaHierarchyNode *node = SelvaHierarchy_FindNode(hierarchy, id);
    SelvaHierarchyNode *prev_node;

    if (node) {
        if (out) {
            *out = node;
        }

        return SELVA_HIERARCHY_EEXIST;
    }

     node = newNode(hierarchy, id);
     if (unlikely(!node)) {
         return SELVA_HIERARCHY_ENOMEM;
     }

     /*
      * All nodes must be indexed.
      */
     prev_node = index_new_node(hierarchy, node);
     assert(!prev_node);

     publishNewNode(hierarchy, node);

     if (out) {
         *out = node;
     }
     return 0;
}

#if 0
/**
 * Copy nodeIds from vec to dst array.
 * The dst array must be large enough.
 * @param dst is an array of Selva_NodeIds
 * @param vec is an SVector pointing to SelvaNodes.
 */
static void copy_nodeIds(Selva_NodeId *dst, const struct SVector *vec) {
    struct SVectorIterator it;
    const SelvaHierarchyNode *node;

    SVector_ForeachBegin(&it, vec);
    while ((node = SVector_Foreach(&it))) {
        memcpy(dst++, node->id, SELVA_NODE_ID_SIZE);
    }
}
#endif

/**
 * Delete a node and its children.
 * @param resp Set to alloc the caller to send deleted ids; Can be NULL if DEL_HIERARCHY_NODE_REPLY_IDS is not given.
 * @param flags controlling how the deletion is executed.
 * @param opt_arg is a pointer to an optional argument, depending on flags.
 */
static int SelvaHierarchy_DelNodeP(
        struct selva_server_response_out *resp,
        SelvaHierarchy *hierarchy,
        SelvaHierarchyNode *node,
        enum SelvaModify_DelHierarchyNodeFlag flags,
        void *opt_arg) {
    int nr_deleted = 0;

    assert(hierarchy);
    assert(node);

    SelvaSubscriptions_ClearAllMarkers(hierarchy, node);

    if ((flags & DEL_HIERARCHY_NODE_REPLY_IDS) != 0) {
        assert(resp);
        selva_send_str(resp, node->id, Selva_NodeIdLen(node->id));
    }
    del_node(hierarchy, node);

    return nr_deleted + 1;
}

static int SelvaHierarchy_DelNode(
        struct selva_server_response_out *resp,
        SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        enum SelvaModify_DelHierarchyNodeFlag flags) {
    SelvaHierarchyNode *node;

    node = SelvaHierarchy_FindNode(hierarchy, id);
    if (!node) {
        return SELVA_HIERARCHY_ENOENT;
    }

    return SelvaHierarchy_DelNodeP(resp, hierarchy, node, flags, NULL);
}

/**
 * Destroy the node if it's expiring.
 * @returns true if the node was expired.
 */
static bool expire_node(struct SelvaHierarchy *hierarchy, struct SelvaHierarchyNode *node, time_t now) {
    if (node->expire && !isLoading() && !hierarchy->flag_isSaving) {
        static_assert(sizeof(time_t) >= sizeof(int64_t));

        if (IS_EXPIRED(node->expire, now)) {
            const enum SelvaModify_DelHierarchyNodeFlag flags = 0;

            SELVA_LOG(SELVA_LOGL_DBG, "Expiring %.*s", (int)SELVA_NODE_ID_SIZE, node->id);
            (void)SelvaHierarchy_DelNodeP(NULL, hierarchy, node, flags, NULL);
            return true;
        }
    }

    return false;
}

static void hierarchy_set_expire(struct SelvaHierarchy *hierarchy, struct SelvaHierarchyNode *node, time_t expire) {
    bool updated = false;

    if (node->expire != 0) {
        (void)SVector_Remove(&hierarchy->expiring.list, node);
        updated = true;
    }

    node->expire = TO_EXPIRE(expire);
    if (expire != 0) {
        (void)SVector_Insert(&hierarchy->expiring.list, node);
        updated = true;
    }

    if (updated) {
        struct SelvaHierarchyNode *top;

        top = SVector_Peek(&hierarchy->expiring.list);
        hierarchy->expiring.next = (top) ? top->expire : HIERARCHY_EXPIRING_NEVER;
    }
}

/**
 * Process expiring nodes every 1 sec.
 */
static void hierarchy_expire_tim_proc(struct event *e __unused, void *data) {
    struct SelvaHierarchy *hierarchy = (struct SelvaHierarchy *)data;
    const enum replication_mode rmode = selva_replication_get_mode();

    hierarchy->expiring.tim_id = evl_set_timeout(&hierarchy_expire_period, hierarchy_expire_tim_proc, data);

    /*
     * Nodes are only expired on the origin and replicated to the replicas.
     */
    if (rmode == SELVA_REPLICATION_MODE_NONE ||
        rmode == SELVA_REPLICATION_MODE_ORIGIN) {
        struct timespec now;

        ts_monorealtime(&now);

        if (IS_EXPIRED(hierarchy->expiring.next, now.tv_sec)) {
            struct SelvaHierarchyNode *node;

            /*
             * Expire/destroy all expiring nodes.
             */
            if (rmode == SELVA_REPLICATION_MODE_ORIGIN) {
                /*
                 * We need to replicate expirations.
                 */
                while ((node = SVector_Peek(&hierarchy->expiring.list))) {
                    Selva_NodeId node_id;

                    memcpy(node_id, node->id, SELVA_NODE_ID_SIZE);

                    if (expire_node(hierarchy, node, now.tv_sec)) {
                        struct selva_proto_builder_msg msg;

                        selva_proto_builder_init(&msg, true);
                        selva_proto_builder_insert_string(&msg, NULL, 0);
                        selva_proto_builder_insert_string(&msg, node_id, SELVA_NODE_ID_SIZE);
                        selva_proto_builder_end(&msg);

                        /*
                         * Replicate expiration as a delete cmd.
                         */
                        selva_replication_replicate(ts_now(), CMD_ID_HIERARCHY_DEL, msg.buf, msg.bsize);
                        selva_proto_builder_deinit(&msg);
                    } else {
                        break;
                    }
                }
            } else {
                /*
                 * Non-replication mode code can be much simpler.
                 */
                while ((node = SVector_Peek(&hierarchy->expiring.list))) {
                    if (!expire_node(hierarchy, node, now.tv_sec)) {
                        break;
                    }
                }
            }

            SelvaSubscriptions_SendDeferredEvents(hierarchy);
        }
    }
}

static int SelvaHierarchyHeadCallback_Dummy(
        struct SelvaHierarchy *,
        const struct SelvaHierarchyTraversalMetadata *,
        SelvaHierarchyNode *head __unused,
        void *arg __unused) {
    return 0;
}

static int HierarchyNode_Callback_Dummy(
        struct SelvaHierarchy *,
        const struct SelvaHierarchyTraversalMetadata *,
        struct SelvaHierarchyNode *node __unused,
        void *arg __unused) {
    return 0;
}

static int SelvaHierarchyChildCallback_Dummy(
        struct SelvaHierarchy *,
        const struct SelvaHierarchyTraversalMetadata *,
        struct SelvaHierarchyNode *child __unused,
        void *arg __unused) {
    return 0;
}

#define BFS_TRAVERSE(hierarchy, head, cb) \
    SelvaHierarchyNodeCallback head_cb = (cb)->head_cb ? (cb)->head_cb : SelvaHierarchyHeadCallback_Dummy; \
    SelvaHierarchyNodeCallback node_cb = (cb)->node_cb ? (cb)->node_cb : HierarchyNode_Callback_Dummy; \
    SelvaHierarchyNodeCallback child_cb = (cb)->child_cb ? (cb)->child_cb : SelvaHierarchyChildCallback_Dummy; \
    \
    SVECTOR_AUTOFREE(_bfs_q); \
    SVECTOR_AUTOFREE(_bfs_sq); /*!< origin PTAG(<SVector>, p/c/e) */ \
    SVector_Init(&_bfs_q,  selva_glob_config.hierarchy_expected_resp_len, NULL); \
    SVector_Init(&_bfs_sq, selva_glob_config.hierarchy_expected_resp_len, NULL); \
    struct { \
        long long cur_depth; /*!< Current depth. */ \
        long long count; /*!< Elements left to next depth Increment. */ \
        long long next_count; /*!< Next initial cont. */ \
    } _bfs_depth = { 0, 1, 0 }; \
    \
    struct trx trx_cur; \
    if (Trx_Begin(&(hierarchy)->trx_state, &trx_cur)) { \
        return SELVA_HIERARCHY_ETRMAX; \
    } \
    \
    Trx_Visit(&trx_cur, &(head)->trx_label); \
    SVector_Insert(&_bfs_q, (head)); \
    SVector_Insert(&_bfs_sq, NULL); \
    if (head_cb((hierarchy), &(const struct SelvaHierarchyTraversalMetadata){ .depth = _bfs_depth.cur_depth }, (head), (cb)->head_arg)) { Trx_End(&(hierarchy)->trx_state, &trx_cur); return 0; } \
    while (SVector_Size(&_bfs_q) > 0) { \
        SelvaHierarchyNode *node = SVector_Shift(&_bfs_q); \
        struct SelvaHierarchyTraversalMetadata _node_cb_metadata = { \
            .origin_field_svec_tagp = SVector_Shift(&_bfs_sq), \
            .depth = _bfs_depth.cur_depth, \
        };

#define BFS_VISIT_NODE(hierarchy, cb) do { \
        /* Note that Trx_Visit() has been already called for this node. */ \
        if (node_cb((hierarchy), &_node_cb_metadata, node, (cb)->node_arg)) { \
            Trx_End(&(hierarchy)->trx_state, &trx_cur); \
            return 0; \
        } \
    } while (0)

#define BFS_VISIT_ADJACENT(hierarchy, cb, _origin_field_tag, _adj_vec, adj_node) do { \
        if (Trx_Visit(&trx_cur, &(adj_node)->trx_label)) { \
            const void *_origin_field_svec_tagp = PTAG((_adj_vec), (_origin_field_tag)); \
            const struct SelvaHierarchyTraversalMetadata _child_cb_metadata = { \
                .origin_field_svec_tagp = _origin_field_svec_tagp, \
                .depth = _bfs_depth.cur_depth, \
            }; \
            (void)child_cb((hierarchy), &_child_cb_metadata, (adj_node), (cb)->child_arg); \
            SVector_Insert(&_bfs_q, (adj_node)); \
            SVector_Insert(&_bfs_sq, (void *)_origin_field_svec_tagp); \
            _bfs_depth.next_count++; \
        } \
    } while (0)

#define BFS_VISIT_ADJACENTS(hierarchy, cb, origin_field_tag, adj_vec) do { \
        struct SVectorIterator _bfs_visit_it; \
        \
        SVector_ForeachBegin(&_bfs_visit_it, (adj_vec)); \
        SelvaHierarchyNode *_adj; \
        while ((_adj = SVector_Foreach(&_bfs_visit_it))) { \
            BFS_VISIT_ADJACENT((hierarchy), (cb), (origin_field_tag), (adj_vec), _adj); \
        } \
    } while (0)

#define BFS_TRAVERSE_END(hierarchy) \
        if (--_bfs_depth.count == 0) { \
            _bfs_depth.cur_depth++; \
            _bfs_depth.count = _bfs_depth.next_count; \
            _bfs_depth.next_count = 0; \
        } \
    } \
    Trx_End(&(hierarchy)->trx_state, &trx_cur)

/**
 * Execute an edge filter for the node.
 * @param edge_filter_ctx is a context for the filter.
 * @param edge_filter is a pointer to the compiled edge filter.
 * @param edge_metadata can be NULL.
 * @param node is a pointer to the node the edge is pointing to.
 */
__attribute__((nonnull (5))) static int exec_edge_filter(
        struct SelvaHierarchy *hierarchy,
        struct rpn_ctx *edge_filter_ctx,
        const struct rpn_expression *edge_filter,
        struct SelvaObject *edge_metadata,
        struct SelvaHierarchyNode *node) {
    STATIC_SELVA_OBJECT(tmp_obj);
    enum rpn_error rpn_err;
    int res;

    if (!edge_metadata) {
        /* Execute the filter with an empty object. */
        edge_metadata = SelvaObject_Init(tmp_obj, 0);
    }

    rpn_set_reg(edge_filter_ctx, 0, node->id, SELVA_NODE_ID_SIZE, RPN_SET_REG_FLAG_IS_NAN);
    edge_filter_ctx->data.hierarchy = hierarchy;
    edge_filter_ctx->data.node = node;
    edge_filter_ctx->data.obj = edge_metadata;
    rpn_err = rpn_bool(edge_filter_ctx, edge_filter, &res);

    return (!rpn_err && res) ? 1 : 0;
}

static int bfs_edge(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *head,
        const char *field_name_str,
        size_t field_name_len,
        const struct SelvaHierarchyCallback * restrict cb) {
    BFS_TRAVERSE(hierarchy, head, cb) {
        const struct EdgeField *edge_field;

        BFS_VISIT_NODE(hierarchy, cb);

        edge_field = Edge_GetField(node, field_name_str, field_name_len);
        if (!edge_field) {
#if 0
            SELVA_LOG(SELVA_LOGL_DBG, "Edge field %.*s not found in %.*s",
                    (int)field_name_len, field_name_str,
                    (int)SELVA_NODE_ID_SIZE, node->id);
#endif
            /* EdgeField not found! */
            continue;
        }

        BFS_VISIT_ADJACENTS(hierarchy, cb, SELVA_TRAVERSAL_SVECTOR_PTAG_EDGE, &edge_field->arcs);
    } BFS_TRAVERSE_END(hierarchy);

    return 0;
}

static enum SelvaHierarchyTraversalSVecPtag traversal2vec_tag(enum SelvaTraversal field_type) {
    switch (field_type) {
    case SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD:
        return SELVA_TRAVERSAL_SVECTOR_PTAG_EDGE;
    default:
        return SELVA_TRAVERSAL_SVECTOR_PTAG_NONE;
    };
}

static int bfs_expression(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *head,
        struct rpn_ctx *rpn_ctx,
        const struct rpn_expression *rpn_expr,
        struct rpn_ctx *edge_filter_ctx,
        const struct rpn_expression *edge_filter,
        const struct SelvaHierarchyCallback * restrict cb) {
    BFS_TRAVERSE(hierarchy, head, cb) {
        enum rpn_error rpn_err;
        struct SelvaSet fields;
        struct SelvaSetElement *field_el;

        SelvaSet_Init(&fields, SELVA_SET_TYPE_STRING);

        rpn_set_reg(rpn_ctx, 0, node->id, SELVA_NODE_ID_SIZE, RPN_SET_REG_FLAG_IS_NAN);
        rpn_ctx->data.hierarchy = hierarchy;
        rpn_ctx->data.node = node;
        rpn_ctx->data.obj = SelvaHierarchy_GetNodeObject(node);
        rpn_err = rpn_selvaset(rpn_ctx, rpn_expr, &fields);
        if (rpn_err) {
            SELVA_LOG(SELVA_LOGL_ERR, "RPN field selector expression failed for %.*s: %s",
                      (int)SELVA_NODE_ID_SIZE, node->id,
                      rpn_str_error[rpn_err]);
            continue;
        }

        BFS_VISIT_NODE(hierarchy, cb);

        SELVA_SET_STRING_FOREACH(field_el, &fields) {
            size_t field_len;
            const char *field_str = selva_string_to_str(field_el->value_string, &field_len);
            struct field_lookup_traversable t;
            enum SelvaHierarchyTraversalSVecPtag adj_tag;
            struct SVectorIterator it;
            SelvaHierarchyNode *adj;
            int err;

            /* Get an SVector for the field. */
            err = field_lookup_traversable(node, field_str, field_len, &t);
            if (err || !t.vec) {
                /* RFE What if it's not ENOENT? */
                continue;
            }

            adj_tag = traversal2vec_tag(t.type);

            /* Visit each node in this field. */
            SVector_ForeachBegin(&it, t.vec);
            while ((adj = SVector_Foreach(&it))) {
                if (!Trx_HasVisited(&trx_cur, &adj->trx_label) && edge_filter) {
                    struct SelvaObject *edge_metadata = get_edge_metadata(adj, t.type, t.vec);

                    if (!exec_edge_filter(hierarchy, edge_filter_ctx, edge_filter, edge_metadata, adj)) {
                        continue;
                    }
                }

                BFS_VISIT_ADJACENT(hierarchy, cb, adj_tag, t.vec, adj);
            }
        }

        SelvaSet_Destroy(&fields);
    } BFS_TRAVERSE_END(hierarchy);

    return 0;
}

/**
 * Traverse adjacent vector.
 * @param adj_vec can be an edge field arcs.
 */
static void SelvaHierarchy_TraverseAdjacents(
        struct SelvaHierarchy *hierarchy,
        enum SelvaHierarchyTraversalSVecPtag adj_tag,
        const SVector *adj_vec,
        const struct SelvaHierarchyCallback *cb) {
    struct SVectorIterator it;

    if (cb->node_cb) {
        const struct SelvaHierarchyTraversalMetadata metadata = {
            .origin_field_svec_tagp = PTAG(adj_vec, adj_tag),
        };
        SelvaHierarchyNode *node;

        SVector_ForeachBegin(&it, adj_vec);
        while ((node = SVector_Foreach(&it))) {
            Trx_Sync(&hierarchy->trx_state, &node->trx_label);

            /* RFE Should we also call child_cb? */
            if (cb->node_cb(hierarchy, &metadata, node, cb->node_arg)) {
                break;
            }
        }
    }
}

int SelvaHierarchy_TraverseEdgeField(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        const char *ref_field_str,
        size_t ref_field_len,
        const struct SelvaHierarchyCallback *cb) {
    struct SelvaHierarchyNode *head;
    const struct EdgeField *edge_field;

    head = SelvaHierarchy_FindNode(hierarchy, id);
    if (!head) {
        return SELVA_HIERARCHY_ENOENT;
    }

    Trx_Sync(&hierarchy->trx_state, &head->trx_label);

    if (cb->head_cb) {
        const struct SelvaHierarchyTraversalMetadata metadata = {};

        if (cb->head_cb(hierarchy, &metadata, head, cb->head_arg)) {
            return 0;
        }
    }

    if (cb->node_cb) {
        edge_field = Edge_GetField(head, ref_field_str, ref_field_len);
        if (edge_field) {
            SelvaHierarchy_TraverseAdjacents(hierarchy, SELVA_TRAVERSAL_SVECTOR_PTAG_EDGE, &edge_field->arcs, cb);
        }
    }

    return 0;
}

int SelvaHierarchy_TraverseEdgeFieldBfs(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        const char *field_name_str,
        size_t field_name_len,
        const struct SelvaHierarchyCallback *cb) {
    struct SelvaHierarchyNode *head;

    head = SelvaHierarchy_FindNode(hierarchy, id);
    if (!head) {
        return SELVA_HIERARCHY_ENOENT;
    }

    Trx_Sync(&hierarchy->trx_state, &head->trx_label);

    return bfs_edge(hierarchy, head, field_name_str, field_name_len, cb);
}

int SelvaHierarchy_TraverseAll(struct SelvaHierarchy *hierarchy, const struct SelvaHierarchyCallback *cb) {
    struct trx trx_cur;
    struct SelvaHierarchyNode *node;

    if (Trx_Begin(&hierarchy->trx_state, &trx_cur)) {
        return SELVA_HIERARCHY_ETRMAX;
    }

    RB_FOREACH(node, hierarchy_index_tree, &hierarchy->index_head) {
        if (Trx_Visit(&trx_cur, &node->trx_label)) {
            if (cb->node_cb(hierarchy, &(const struct SelvaHierarchyTraversalMetadata){}, node, cb->node_arg)) {
                break;
            }
        }
    }

    Trx_End(&hierarchy->trx_state, &trx_cur);
    return 0;
}

int SelvaHierarchy_Traverse(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        enum SelvaTraversal dir,
        const struct SelvaHierarchyCallback *cb) {
    SelvaHierarchyNode *head;
    int err = 0;

    if (dir == SELVA_HIERARCHY_TRAVERSAL_NONE) {
        return SELVA_HIERARCHY_EINVAL;
    }

    if (dir != SELVA_HIERARCHY_TRAVERSAL_ALL) {
        head = SelvaHierarchy_FindNode(hierarchy, id);
        if (!head) {
            return SELVA_HIERARCHY_ENOENT;
        }

        Trx_Sync(&hierarchy->trx_state, &head->trx_label);
    }


    switch (dir) {
    case SELVA_HIERARCHY_TRAVERSAL_NODE:
        cb->node_cb(hierarchy, &(const struct SelvaHierarchyTraversalMetadata){}, head, cb->node_arg);
        break;
    case SELVA_HIERARCHY_TRAVERSAL_ALL:
        SelvaHierarchy_TraverseAll(hierarchy, cb);
        break;
    default:
        /* Should probably use some other traversal function. */
        SELVA_LOG(SELVA_LOGL_ERR, "Invalid or unsupported traversal requested (%d)",
                  (int)dir);
        err = SELVA_HIERARCHY_ENOTSUP;
    }

    return err;
}

int SelvaHierarchy_TraverseField2(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId node_id,
        const char *ref_field_str,
        size_t ref_field_len,
        const struct SelvaHierarchyCallback *hcb) {
    struct SelvaHierarchyNode *head;
    struct field_lookup_traversable t;
    int err;

    head = SelvaHierarchy_FindNode(hierarchy, node_id);
    if (!head) {
        return SELVA_HIERARCHY_ENOENT;
    }

    if (hcb->head_cb) {
        const struct SelvaHierarchyTraversalMetadata metadata = {};

        if (hcb->head_cb(hierarchy, &metadata, head, hcb->head_arg)) {
            return 0;
        }
    }

    /*
     * Otherwise we need to get a traversable SVector field value.
     * TODO We ~~don't~~ know the node where t.vec comes from, so we don't do
     * Trx_Sync(). We probably would need it for some tracking purposes
     * like automatic compression.
     */
    err = field_lookup_traversable(head, ref_field_str, ref_field_len, &t);
    if (err) {
        return err;
    }

    if (t.type == SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD) {
        assert(t.vec);

        /* TODO Temp hack to prevent multi-hop derefs because we can't handle those in subscriptions. */
        if (t.hops > 1) {
            return SELVA_ENOTSUP;
        }

        SELVA_TRACE_BEGIN(traverse_edge_field);
        SelvaHierarchy_TraverseAdjacents(hierarchy, SELVA_TRAVERSAL_SVECTOR_PTAG_EDGE, t.vec, hcb);
        SELVA_TRACE_END(traverse_edge_field);
        return 0;
    } else {
        return SELVA_HIERARCHY_ENOTSUP; /* Same as SelvaHierarchy_Traverse(). */
    }
}

int SelvaHierarchy_TraverseField2Bfs(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId node_id,
        const char *ref_field_str,
        size_t ref_field_len,
        const struct SelvaHierarchyCallback *hcb) {
    struct SelvaHierarchyNode *head;

    head = SelvaHierarchy_FindNode(hierarchy, node_id);
    if (!head) {
        return SELVA_HIERARCHY_ENOENT;
    }

    BFS_TRAVERSE(hierarchy, head, hcb) {
        BFS_VISIT_NODE(hierarchy, hcb);

        struct field_lookup_traversable t;
        enum SelvaHierarchyTraversalSVecPtag adj_tag;
        SVector *adj_vec;
        struct SVectorIterator it;
        int err;

        err = field_lookup_traversable(node, ref_field_str, ref_field_len, &t);
        if (err == SELVA_ENOENT || err == SELVA_HIERARCHY_ENOENT) {
            continue;
        } else if (err) {
            SELVA_LOG(SELVA_LOGL_ERR, "err: %s", selva_strerror(err));
            Trx_End(&hierarchy->trx_state, &trx_cur);
            return err;
        }

        if (t.type & (SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD)) {
            switch (t.type) {
            case SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD:
                adj_tag = SELVA_TRAVERSAL_SVECTOR_PTAG_EDGE;
                break;
            default:
                adj_tag = SELVA_TRAVERSAL_SVECTOR_PTAG_NONE;
                break;
            }
            adj_vec = t.vec;

            /* TODO Temp hack to prevent multi-hop derefs because we can't handle those in subscriptions. */
            if (t.type == SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD && t.hops > 1) {
                Trx_End(&hierarchy->trx_state, &trx_cur);
                return SELVA_ENOTSUP;
            }
        } else {
            adj_tag = SELVA_TRAVERSAL_SVECTOR_PTAG_NONE;
            SELVA_LOG(SELVA_LOGL_WARN, "Unsupported traversal: %d", t.type);
            break;
        }
        assert(adj_vec);

        SelvaHierarchyNode *adj;

        /* Visit each node in this field. */
        SVector_ForeachBegin(&it, adj_vec);
        while ((adj = SVector_Foreach(&it))) {
            BFS_VISIT_ADJACENT(hierarchy, hcb, adj_tag, adj_vec, adj);
        }
    } BFS_TRAVERSE_END(hierarchy);

    return 0;
}

int SelvaHierarchy_TraverseExpression(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        struct rpn_ctx *rpn_ctx,
        const struct rpn_expression *rpn_expr,
        struct rpn_ctx *edge_filter_ctx,
        const struct rpn_expression *edge_filter,
        const struct SelvaHierarchyCallback *cb) {
    SelvaHierarchyNode *head;
    struct trx trx_cur;
    enum rpn_error rpn_err;
    struct SelvaSet fields;
    struct SelvaSetElement *field_el;

    head = SelvaHierarchy_FindNode(hierarchy, id);
    if (!head) {
        return SELVA_HIERARCHY_ENOENT;
    }

    if (Trx_Begin(&hierarchy->trx_state, &trx_cur)) {
        return SELVA_HIERARCHY_ETRMAX;
    }

    SelvaSet_Init(&fields, SELVA_SET_TYPE_STRING);

    rpn_set_reg(rpn_ctx, 0, head->id, SELVA_NODE_ID_SIZE, RPN_SET_REG_FLAG_IS_NAN);
    rpn_ctx->data.hierarchy = hierarchy;
    rpn_ctx->data.node = head;
    rpn_ctx->data.obj = SelvaHierarchy_GetNodeObject(head);
    rpn_err = rpn_selvaset(rpn_ctx, rpn_expr, &fields);
    if (rpn_err) {
        Trx_End(&hierarchy->trx_state, &trx_cur);
        SELVA_LOG(SELVA_LOGL_ERR, "RPN field selector expression failed for %.*s: %s",
                  (int)SELVA_NODE_ID_SIZE, head->id,
                  rpn_str_error[rpn_err]);
        return SELVA_HIERARCHY_EINVAL;
    }

    /* For each field in the set. */
    SELVA_SET_STRING_FOREACH(field_el, &fields) {
        size_t field_len;
        const char *field_str = selva_string_to_str(field_el->value_string, &field_len);
        struct field_lookup_traversable t;
        struct SVectorIterator it;
        SelvaHierarchyNode *adj;
        int err;

        /* Get an SVector for the field. */
        err = field_lookup_traversable(head, field_str, field_len, &t);
        if (err || !t.vec) {
            /* RFE What if it's not ENOENT? */
            continue;
        }

        const struct SelvaHierarchyTraversalMetadata node_metadata = {
            .origin_field_svec_tagp = PTAG(t.vec, traversal2vec_tag(t.type)),
        };

        /* Visit each node in this field. */
        SVector_ForeachBegin(&it, t.vec);
        while ((adj = SVector_Foreach(&it))) {
            if (Trx_Visit(&trx_cur, &adj->trx_label)) {
                if (edge_filter) {
                    struct SelvaObject *edge_metadata = get_edge_metadata(adj, t.type, t.vec);

                    if (!exec_edge_filter(hierarchy, edge_filter_ctx, edge_filter, edge_metadata, adj)) {
                        continue;
                    }
                }

                if (cb->node_cb(hierarchy, &node_metadata, adj, cb->node_arg)) {
                    Trx_End(&hierarchy->trx_state, &trx_cur);
                    return 0;
                }
            }
        }
    }

    Trx_End(&hierarchy->trx_state, &trx_cur);
    return 0;
}

int SelvaHierarchy_TraverseExpressionBfs(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId id,
        struct rpn_ctx *rpn_ctx,
        const struct rpn_expression *rpn_expr,
        struct rpn_ctx *edge_filter_ctx,
        const struct rpn_expression *edge_filter,
        const struct SelvaHierarchyCallback *cb) {
    SelvaHierarchyNode *head;

    head = SelvaHierarchy_FindNode(hierarchy, id);
    if (!head) {
        return SELVA_HIERARCHY_ENOENT;
    }

    return bfs_expression(hierarchy, head, rpn_ctx, rpn_expr, edge_filter_ctx, edge_filter, cb);
}

int SelvaHierarchy_IsNonEmptyField(const struct SelvaHierarchyNode *node, const char *field_str, size_t field_len) {
    if (field_len == 0) {
        return 0;
    }

    /*
     * Check if field is an edge field name.
     */
    const struct EdgeField *edge_field;

    edge_field = Edge_GetField(node, field_str, field_len);
    if (!edge_field) {
        return 0;
    }

    return Edge_GetFieldLength(edge_field);
}

static int load_metadata(struct selva_io *io, int encver, SelvaHierarchy *hierarchy, SelvaHierarchyNode *node) {
    int err;

    if (unlikely(!node)) {
        return SELVA_EINVAL;
    }

    /*
     * Note that the metadata must be loaded and saved in predefined order.
     * See save_metadata() for the right order.
     */

    err = Edge_Load(io, encver, hierarchy, node);
    if (err) {
        return err;
    }

    if (!SelvaObjectTypeLoadTo(io, encver, SelvaHierarchy_GetNodeObject(node), NULL)) {
        return SELVA_ENOENT;
    }

    return 0;
}

static int load_hierarchy_node(struct selva_io *io, int encver, SelvaHierarchy *hierarchy, SelvaHierarchyNode *node) {
    int err;

    /*
     * The node metadata comes right after the node_id and flags.
     */
    err = load_metadata(io, encver, hierarchy, node);
    if (err) {
        SELVA_LOG(SELVA_LOGL_CRIT, "Failed to load hierarchy node (%.*s) metadata: %s",
                  (int)SELVA_NODE_ID_SIZE, node->id,
                  selva_strerror(err));
        return err;
    }

    return 0;
}

/**
 * Load a node and its children.
 * Should be only called by load_tree().
 */
static int load_node(struct selva_io *io, int encver, SelvaHierarchy *hierarchy, Selva_NodeId node_id) {
    SelvaHierarchyNode *node;
    int err;

    /*
     * Upsert the node.
     */
    err = SelvaHierarchy_UpsertNode(hierarchy, node_id, &node);
    if (err && err != SELVA_HIERARCHY_EEXIST) {
        SELVA_LOG(SELVA_LOGL_CRIT, "Failed to upsert %.*s: %s",
                  (int)SELVA_NODE_ID_SIZE, node_id,
                  selva_strerror(err));
        return err;
    }

    node->expire = selva_io_load_unsigned(io);
    return load_hierarchy_node(io, encver, hierarchy, node);
}

/**
 * Load a node hierarchy from io.
 * NODE_ID1 | FLAGS | METADATA | NR_CHILDREN | CHILD_ID_0,..
 * NODE_ID2 | FLAGS | METADATA | NR_CHILDREN | ...
 * HIERARCHY_SERIALIZATION_EOF
 */
static int load_tree(struct selva_io *io, int encver, SelvaHierarchy *hierarchy) {
    while (1) {
        Selva_NodeId node_id;
        int err;

        selva_io_load_str_fixed(io, node_id, SELVA_NODE_ID_SIZE);

        /*
         * If it's EOF there are no more nodes for this hierarchy.
         */
        if (!memcmp(node_id, HIERARCHY_SERIALIZATION_EOF, SELVA_NODE_ID_SIZE)) {
            break;
        }

        err = load_node(io, encver, hierarchy, node_id);
        if (err) {
            return err;
        }
    }

    return 0;
}

static int load_aliases(struct selva_io *io,int encver, SelvaHierarchy *hierarchy) {
    struct SelvaObject *aliases = GET_STATIC_SELVA_OBJECT(&hierarchy->aliases);

    return SelvaObjectTypeLoadTo(io, encver, aliases, NULL) ? 0 : SELVA_HIERARCHY_EINVAL;
}

SelvaHierarchy *Hierarchy_Load(struct selva_io *io) {
    SelvaHierarchy *hierarchy = NULL;
    int encver;
    int err;

    flag_isLoading = 1;

    encver = selva_io_load_signed(io);
    if (encver > HIERARCHY_ENCODING_VERSION) {
        SELVA_LOG(SELVA_LOGL_CRIT, "selva_hierarchy encoding version %d not supported", encver);
        err = SELVA_HIERARCHY_EINVAL;
        goto error;
    }

    hierarchy = SelvaModify_NewHierarchy();
    if (!hierarchy) {
        SELVA_LOG(SELVA_LOGL_CRIT, "Failed to create a new hierarchy");
        err = SELVA_HIERARCHY_ENOMEM;
        goto error;
    }

    err = SelvaSchema_Load(io, encver, hierarchy);
    if (err) {
        SELVA_LOG(SELVA_LOGL_CRIT, "Failed to load the schema: %s",
                  selva_strerror(err));
        goto error;
    }

    err = load_tree(io, encver, hierarchy);
    if (err) {
        goto error;
    }

    err = load_aliases(io, encver, hierarchy);
    if (err) {
        goto error;
    }

    flag_isLoading = 0;
    return hierarchy;
error:
    if (hierarchy) {
        SelvaHierarchy_Destroy(hierarchy);
    }

    flag_isLoading = 0;
    return NULL;
}

static void save_metadata(struct selva_io *io, SelvaHierarchyNode *node) {
    /*
     * Note that the metadata must be loaded and saved in a predefined order.
     */

    Edge_Save(io, node);
    SelvaObjectTypeSave(io, SelvaHierarchy_GetNodeObject(node), NULL);
}

/**
 * Save a node.
 * Used by Hierarchy_Save() when doing a dump.
 */
static int HierarchySaveNode(
        struct SelvaHierarchy *,
        const struct SelvaHierarchyTraversalMetadata *,
        struct SelvaHierarchyNode *node,
        void *arg) {
    struct HierarchySaveNode *args = (struct HierarchySaveNode *)arg;
    struct selva_io *io = args->io;

    selva_io_save_str(io, node->id, SELVA_NODE_ID_SIZE);
    selva_io_save_unsigned(io, node->expire);
    save_metadata(io, node);

    return 0;
}

static void save_hierarchy(struct selva_io *io, SelvaHierarchy *hierarchy) {
    struct HierarchySaveNode args = {
        .io = io,
    };
    const struct SelvaHierarchyCallback cb = {
        .node_cb = HierarchySaveNode,
        .node_arg = &args,
        .flags = SELVA_HIERARCHY_CALLBACK_FLAGS_INHIBIT_RESTORE,
    };

    SelvaHierarchy_TraverseAll(hierarchy, &cb);
    selva_io_save_str(io, HIERARCHY_SERIALIZATION_EOF, sizeof(HIERARCHY_SERIALIZATION_EOF));
}

static void save_aliases(struct selva_io *io, SelvaHierarchy *hierarchy) {
    struct SelvaObject *aliases = GET_STATIC_SELVA_OBJECT(&hierarchy->aliases);

    SelvaObjectTypeSave(io, aliases, NULL);
}

void Hierarchy_Save(struct selva_io *io, SelvaHierarchy *hierarchy) {
    /*
     * Serialization format:
     * ENCVER
     * SCHEMA
     * NODE_ID1 | FLAGS | METADATA
     * NODE_ID2 | FLAGS | METADATA
     * HIERARCHY_SERIALIZATION_EOF
     * ALIASES
     */
    hierarchy->flag_isSaving = 1;
    selva_io_save_signed(io, HIERARCHY_ENCODING_VERSION);
    SelvaSchema_Save(io, hierarchy);
    save_hierarchy(io, hierarchy);
    save_aliases(io, hierarchy);
    hierarchy->flag_isSaving = 0;
}

/*
 * HIERARCHY.DEL FLAGS [NODE_ID1[, NODE_ID2, ...]]
 * If no NODE_IDs are given then nothing will be deleted.
 */
static void SelvaHierarchy_DelNodeCommand(struct selva_server_response_out *resp, const void *buf, size_t len) {
    SelvaHierarchy *hierarchy = main_hierarchy;
    __auto_finalizer struct finalizer fin;
    struct selva_string **argv;
    int argc;

    finalizer_init(&fin);

    const int ARGV_FLAGS     = 0;
    const int ARGV_NODE_IDS  = 1;

    argc = selva_proto_buf2strings(&fin, buf, len, &argv);
    if (argc < 2) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    size_t flags_len;
    const char *flags_str = selva_string_to_str(argv[ARGV_FLAGS], &flags_len);
    enum SelvaModify_DelHierarchyNodeFlag flags = 0;

    for (size_t i = 0; i < flags_len; i++) {
        flags |= flags_str[i] == 'F' ? DEL_HIERARCHY_NODE_FORCE : 0;
        flags |= flags_str[i] == 'I' ? DEL_HIERARCHY_NODE_REPLY_IDS : 0;
    }

    if ((flags & DEL_HIERARCHY_NODE_REPLY_IDS) != 0) {
        selva_send_array(resp, -1);
    }

    long long nr_deleted = 0;
    for (int i = ARGV_NODE_IDS; i < argc; i++) {
        Selva_NodeId nodeId;
        int res;

        selva_string2node_id(nodeId, argv[i]);
        res = SelvaHierarchy_DelNode(resp, hierarchy, nodeId, flags);
        if (res >= 0) {
            nr_deleted += res;
        } else {
            /* TODO How to handle the error correctly? */
            /* DEL_HIERARCHY_NODE_REPLY_IDS would allow us to send errors. */
            if (res != SELVA_HIERARCHY_ENOENT) {
                SELVA_LOG(SELVA_LOGL_ERR, "Failed to delete the node %.*s. err: \"%s\"",
                          (int)SELVA_NODE_ID_SIZE, nodeId,
                          selva_strerror(res));
            }
        }
    }

    if ((flags & DEL_HIERARCHY_NODE_REPLY_IDS) != 0) {
        selva_send_array_end(resp);
    } else {
        selva_send_ll(resp, nr_deleted);
    }

    if (nr_deleted > 0) {
        selva_io_set_dirty();
        selva_replication_replicate(selva_resp_to_ts(resp), selva_resp_to_cmd_id(resp), buf, len);
    }
    SelvaSubscriptions_SendDeferredEvents(hierarchy);
}

/*
 * HIERARCHY.EXPIRE NODE_ID1 TS
 */
static void SelvaHierarchy_ExpireCommand(struct selva_server_response_out *resp, const void *buf, size_t len) {
    SelvaHierarchy *hierarchy = main_hierarchy;
    Selva_NodeId nodeId;
    uint64_t prev, expire = 0;
    int argc;

    argc = selva_proto_scanf(NULL, buf, len, "%" SELVA_SCA_NODE_ID ", %" PRIu64, nodeId, &expire);
    if (argc != 1 && argc != 2) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    /*
     * Find the node.
     */
    SelvaHierarchyNode *node = SelvaHierarchy_FindNode(hierarchy, nodeId);
    if (!node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    prev = FROM_EXPIRE(node->expire);
    if (argc == 2) {
        hierarchy_set_expire(hierarchy, node, expire);
        selva_replication_replicate(selva_resp_to_ts(resp), selva_resp_to_cmd_id(resp), buf, len);
    }

    selva_send_ll(resp, prev);
}

static void SelvaHierarchy_EdgeListCommand(struct selva_server_response_out *resp, const void *buf, size_t len) {
    SelvaHierarchy *hierarchy = main_hierarchy;
    Selva_NodeId nodeId;
    const char *key_name_str = NULL;
    size_t key_name_len = 0;
    int argc;

    argc = selva_proto_scanf(NULL, buf, len, "%" SELVA_SCA_NODE_ID ", %.*s",
                             nodeId,
                             &key_name_len, &key_name_str);
    if (argc < 0) {
        selva_send_errorf(resp, argc, "Failed to parse args");
        return;
    } else if (argc != 1 && argc != 2) {
        selva_send_error_arity(resp);
        return;
    }

    /*
     * Find the node.
     */
    SelvaHierarchyNode *node = SelvaHierarchy_FindNode(hierarchy, nodeId);
    if (!node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    struct SelvaObject *obj = node->metadata.edge_fields.edges;

    if (!obj) {
        /* No custom edges set. */
        selva_send_array(resp, 0);
        return;
    }

    if (key_name_len) {
        int err;

        err = SelvaObject_GetObjectStr(obj, key_name_str, key_name_len, &obj);
        if (err || !obj) {
            if (!err && !obj) {
                err = SELVA_ENOENT;
            }
            selva_send_errorf(resp, err, "Get edge field");
            return;
        }
    }

    SelvaObject_ReplyWithObject(resp, NULL, obj, NULL, 0);
}

/*
 * Get edges of an edge field.
 *
 * Reply format:
 * [
 *   nodeId1,
 *   nodeId2,
 * ]
 */
static void SelvaHierarchy_EdgeGetCommand(struct selva_server_response_out *resp, const void *buf, size_t len) {
    SelvaHierarchy *hierarchy = main_hierarchy;
    Selva_NodeId nodeId;
    const char *field_name_str = NULL;
    size_t field_name_len = 0;
    int argc;

    argc = selva_proto_scanf(NULL, buf, len, "%" SELVA_SCA_NODE_ID ", %.*s",
                             nodeId,
                             &field_name_len, &field_name_str);
    if (argc != 2) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    const SelvaHierarchyNode *node;

    /*
     * Find the node.
     */
    node = SelvaHierarchy_FindNode(hierarchy, nodeId);
    if (!node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    const struct EdgeField *edge_field;

    edge_field = Edge_GetField(node, field_name_str, field_name_len);
    if (!edge_field) {
        selva_send_null(resp);
        return;
    }

    struct EdgeFieldIterator it;
    const SelvaHierarchyNode *dst;

    selva_send_array(resp, Edge_GetFieldLength(edge_field));

    Edge_ForeachBegin(&it, edge_field);
    while ((dst = Edge_Foreach(&it))) {
        selva_send_str(resp, dst->id, Selva_NodeIdLen(dst->id));
    }
}

/*
 * Get metadata of an edge.
 *
 * Reply format:
 * SelvaObject
 */
static void SelvaHierarchy_EdgeGetMetadataCommand(struct selva_server_response_out *resp, const void *buf, size_t len) {
    SelvaHierarchy *hierarchy = main_hierarchy;
    Selva_NodeId src_node_id;
    const char *field_name_str;
    size_t field_name_len;
    Selva_NodeId dst_node_id;
    int argc, err;

    argc = selva_proto_scanf(NULL, buf, len, "%" SELVA_SCA_NODE_ID ", %.*s, %" SELVA_SCA_NODE_ID,
                             src_node_id,
                             &field_name_len, &field_name_str,
                             dst_node_id);
    if (argc != 3) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    /*
     * Find the node.
     */
    const SelvaHierarchyNode *src_node = SelvaHierarchy_FindNode(hierarchy, src_node_id);
    if (!src_node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    struct EdgeField *edge_field;
    edge_field = Edge_GetField(src_node, field_name_str, field_name_len);
    if (!edge_field) {
        selva_send_errorf(resp, SELVA_ENOENT, "Edge field not found");
        return;
    }

    struct SelvaObject *edge_metadata;
    err = Edge_GetFieldEdgeMetadata(edge_field, dst_node_id, 0, &edge_metadata);
    if (err == SELVA_ENOENT) {
        selva_send_null(resp);
        return;
    } else if (err) { /* Also if the edge doesn't exist. */
        selva_send_error(resp, err, NULL, 0);
        return;
    }

    SelvaObject_ReplyWithObject(resp, NULL, edge_metadata, NULL, 0);
}

static int Hierarchy_OnLoad(void) {
    selva_mk_command(CMD_ID_HIERARCHY_DEL, SELVA_CMD_MODE_MUTATE, "hierarchy.del", SelvaHierarchy_DelNodeCommand);
    selva_mk_command(CMD_ID_HIERARCHY_EXPIRE, SELVA_CMD_MODE_MUTATE, "hierarchy.expire", SelvaHierarchy_ExpireCommand);
    selva_mk_command(CMD_ID_HIERARCHY_EDGE_LIST, SELVA_CMD_MODE_PURE, "hierarchy.edgeList", SelvaHierarchy_EdgeListCommand);
    selva_mk_command(CMD_ID_HIERARCHY_EDGE_GET, SELVA_CMD_MODE_PURE, "hierarchy.edgeGet", SelvaHierarchy_EdgeGetCommand);
    selva_mk_command(CMD_ID_HIERARCHY_EDGE_GET_METADATA, SELVA_CMD_MODE_PURE, "hierarchy.edgeGetMetadata", SelvaHierarchy_EdgeGetMetadataCommand);

    return 0;
}
SELVA_ONLOAD(Hierarchy_OnLoad);
