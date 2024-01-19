/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#define _POSIX_C_SOURCE 200809L
#define _GNU_SOURCE
#include <assert.h>
#include <ctype.h>
#include <errno.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include "jemalloc.h"
#include "endian.h"
#include "util/align.h"
#include "util/cstrings.h"
#include "util/data-record.h"
#include "util/finalizer.h"
#include "util/selva_string.h"
#include "util/svector.h"
#include "selva_db.h"
#include "selva_error.h"
#include "selva_log.h"
#include "selva_proto.h"
#include "selva_server.h"
#include "field_lookup.h"
#include "hierarchy.h"
#include "parsers.h"
#include "resolve.h"
#include "rpn.h"
#include "selva_object.h"
#include "selva_onload.h"
#include "selva_trace.h"
#include "subscriptions_cmd.h"
#include "subscriptions.h"

struct Selva_Subscription {
    Selva_SubscriptionId sub_id;
    RB_ENTRY(Selva_Subscription) _sub_index_entry;
    SVector markers; /* struct Selva_SubscriptionMarker */
};

struct set_node_marker_data {
    struct Selva_SubscriptionMarker *marker;
};

static const struct parsers_enum trigger_event_types[] = {
    {
        .name = "created",
        .id = SELVA_SUBSCRIPTION_TRIGGER_TYPE_CREATED,
    },
    {
        .name = "updated",
        .id = SELVA_SUBSCRIPTION_TRIGGER_TYPE_UPDATED,
    },
    {
        .name = "deleted",
        .id = SELVA_SUBSCRIPTION_TRIGGER_TYPE_DELETED,
    },
    {
        .name = NULL,
        .id = 0,
    }
};

static const struct SelvaObjectPointerOpts subs_missing_obj_opts = {
    .ptr_type_id = SELVA_OBJECT_POINTER_SUBS_MISSING,
    .ptr_reply = SelvaSubscriptions_ReplyWithMarker,
};

SELVA_TRACE_HANDLE(cmd_subscriptions_refresh);
SELVA_TRACE_HANDLE(cmd_subscriptions_refresh_marker);

static struct Selva_Subscription *find_sub(SelvaHierarchy *hierarchy, Selva_SubscriptionId sub_id);
static void clear_node_sub(struct SelvaHierarchy *hierarchy, struct Selva_SubscriptionMarker *marker, const Selva_NodeId node_id);

static int marker_svector_compare(const void ** restrict a_raw, const void ** restrict b_raw) {
    const struct Selva_SubscriptionMarker *a = *(const struct Selva_SubscriptionMarker **)a_raw;
    const struct Selva_SubscriptionMarker *b = *(const struct Selva_SubscriptionMarker **)b_raw;

    return a->marker_id - b->marker_id;
}

static int subscription_svector_compare(const void ** restrict a_raw, const void ** restrict b_raw) {
    const struct Selva_Subscription *a = *(const struct Selva_Subscription **)a_raw;
    const struct Selva_Subscription *b = *(const struct Selva_Subscription **)b_raw;

    return a->sub_id - b->sub_id;
}

static int marker_rb_compare(const struct Selva_SubscriptionMarker *a, const struct Selva_SubscriptionMarker *b) {
    return a->marker_id - b->marker_id;
}

static int subscription_rb_compare(const struct Selva_Subscription *a, const struct Selva_Subscription *b) {
    return a->sub_id - b->sub_id;
}

RB_PROTOTYPE_STATIC(hierarchy_subscriptions_tree, Selva_Subscription, _sub_index_entry, subscription_rb_compare)
RB_PROTOTYPE_STATIC(hierarchy_subscription_markers_tree, Selva_SubscriptionMarker, _mrk_index_entry, marker_rb_compare)
RB_GENERATE_STATIC(hierarchy_subscriptions_tree, Selva_Subscription, _sub_index_entry, subscription_rb_compare)
RB_GENERATE_STATIC(hierarchy_subscription_markers_tree, Selva_SubscriptionMarker, _mrk_index_entry, marker_rb_compare)

static void defer_event(
        struct SelvaHierarchy *hierarchy,
        struct Selva_SubscriptionMarker *marker,
        enum SelvaSubscriptionsMarkerFlags event_flags,
        const char *field_name,
        size_t field_len,
        struct SelvaHierarchyNode *node);
static void defer_event_for_traversing_markers(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node);
/**
 * Send deferred event of this marker if set.
 */
static bool send_deferred_event(struct SelvaHierarchy *hierarchy, struct Selva_SubscriptionMarker *marker);

static bool isAliasMarker(enum SelvaSubscriptionsMarkerFlags flags) {
    return !!(flags & SELVA_SUBSCRIPTION_FLAG_CH_ALIAS);
}

static bool isTriggerMarker(enum SelvaSubscriptionsMarkerFlags flags) {
    return !!(flags & SELVA_SUBSCRIPTION_FLAG_TRIGGER);
}

static bool marker_includes_node_id(const Selva_NodeId node_id, const struct Selva_SubscriptionMarker *marker)
{
    const size_t n = marker->change_marker.nr_node_ids;
    const Selva_NodeId *ids = marker->change_marker.node_ids;

    for (size_t i = 0; i < n; i++) {
        if (!memcmp(node_id, ids[i], SELVA_NODE_ID_SIZE)) {
            return true;
        }
    }

    return false;
}

/**
 * Inhibit a marker event.
 * Return true if no event should be sent for node_id by this marker.
 */
static int inhibitMarkerEvent(const Selva_NodeId node_id, const struct Selva_SubscriptionMarker *marker) {
    /*
     * SELVA_SUBSCRIPTION_FLAG_REF inhibits an event when node_id matches to the
     * root node_id of the marker.
     */
    return ((marker->marker_flags & (SELVA_SUBSCRIPTION_FLAG_REF | SELVA_SUBSCRIPTION_FLAG_TRIGGER)) == SELVA_SUBSCRIPTION_FLAG_REF &&
            marker_includes_node_id(node_id, marker));
}

/**
 * Check if the field matches to one of fields in list.
 * @param field_str is a nul-terminated field name.
 */
static int field_match(const char *list, const char *field_str, size_t field_len) {
    int match = 0;

    /* Test if field matches to any of the fields in list. */
    match = stringlist_search(list, field_str, field_len, '*');

    /*
     * Test for each subfield if there was no exact match.
     */
    if (!match) {
        const char *sep = ".";
        char *p;

        if ((p = strstr(field_str, sep))) {
            do {
                const size_t len = (ptrdiff_t)p++ - (ptrdiff_t)field_str;

                match = stringlist_search(list, field_str, len, '*');
            } while (!match && p && (p = strstr(p, sep)));
        }
    }

    return match;
}

/**
 * Check if field matches to any of the fields specified in the marker.
 */
static int Selva_SubscriptionFieldMatch(const struct Selva_SubscriptionMarker *marker, const char *field_str, size_t field_len) {
    int match = 0;

    if (!!(marker->marker_flags & SELVA_SUBSCRIPTION_FLAG_CH_FIELD)) {
        match = marker->fields ? field_match(marker->fields, field_str, field_len) : 1;
    }

    return match;
}

int Selva_SubscriptionFilterMatch(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        struct Selva_SubscriptionMarker *marker) {
    struct rpn_ctx *filter_ctx = marker->filter_ctx;
    int res = 1; /* When no filter is set the result should be true. */

    if (filter_ctx) {
        Selva_NodeId node_id;
        int err;

        SelvaHierarchy_GetNodeId(node_id, node);
        rpn_set_reg(filter_ctx, 0, node_id, SELVA_NODE_ID_SIZE, RPN_SET_REG_FLAG_IS_NAN);
        filter_ctx->data.hierarchy = hierarchy;
        filter_ctx->data.node = node;
        filter_ctx->data.obj = SelvaHierarchy_GetNodeObject(node);
        err = rpn_bool(filter_ctx, marker->filter_expression, &res);
        if (err) {
            SELVA_LOG(SELVA_LOGL_ERR, "Expression failed (node: \"%.*s\"): \"%s\"",
                      (int)SELVA_NODE_ID_SIZE, node_id,
                      rpn_str_error[err]);
            res = 0;
        }
    }

    return res;
}

int SelvaSubscriptions_hasActiveMarkers(const struct SelvaHierarchyMetadata *node_metadata) {
    return SVector_Size(&node_metadata->sub_markers.vec) > 0;
}

static uint32_t string_hash(uint32_t hash, const char *s) {
    for (; *s; s++) {
        hash = (hash * 33) ^ *s;
    }

    return hash;
}

Selva_SubscriptionMarkerId Selva_GenSubscriptionMarkerId(Selva_SubscriptionMarkerId prev, const char *s) {
    uint32_t prev_hash = prev && (uint32_t)(prev & 0x7FFFFFFF);
    return prev_hash + (string_hash(5381, s) >> 0) * 4096 + (string_hash(52711, s) >> 0);
}

/*
 * Destroy and free a marker.
 */
__attribute__((nonnull (2))) static void destroy_marker(SelvaHierarchy *hierarchy, struct Selva_SubscriptionMarker *marker) {
    if (marker->ref_count > 0) {
        SELVA_LOG(SELVA_LOGL_WARN, "Unable to destroy marker %p %" PRImrkId " refcount: %zu",
                  marker, marker->marker_id,
                  marker->ref_count);
        return;
    } else {
        SELVA_LOG(SELVA_LOGL_DBG, "Destroying marker %p %" PRImrkId,
                  marker, marker->marker_id);
    }

    /*
     * Make sure its not deferred.
     * This is the last chance to make sure that we have no pointers to this
     * marker. If there was the event sent won't contain any sub_ids.
     */
    if (send_deferred_event(hierarchy, marker)) {
        SELVA_LOG(SELVA_LOGL_WARN, "Marker (%" PRImrkId ") event sent without sub_ids just before freeing resources",
                  marker->marker_id);
    }

    RB_REMOVE(hierarchy_subscription_markers_tree, &hierarchy->subs.mrks_head, marker);

    rpn_destroy(marker->filter_ctx);
    if (marker->change_marker.dir & (SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION |
                                     SELVA_HIERARCHY_TRAVERSAL_EXPRESSION)) {
        rpn_destroy_expression(marker->change_marker.traversal_expression);
    } else {
        selva_free(marker->change_marker.ref_field);
    }
    rpn_destroy_expression(marker->filter_expression);
#if MEM_DEBUG
    memset(marker, 0, sizeof(*marker));
#endif
    selva_free(marker);
}

/**
 * Clear and destroy a marker.
 * The marker must have been removed from the sub->markers SVectors before
 * this function is called (and thus should be marker->subs empty) if actual
 * removal is expected to happen.
 * It's advisable to call send_deferred_event(hierarchy, marker) before removing
 * the subs and calling this function or otherwise any pending event will be
 * missing sub_ids when sent later by destroy_marker.
 * The marker is only actually destroyed if no subscription is using it.
 */
static void do_sub_marker_removal(SelvaHierarchy *hierarchy, struct Selva_SubscriptionMarker *marker) {
    if (SVector_Size(&marker->subs) > 0) {
        return;
    }

    if (marker->change_marker.dir == SELVA_HIERARCHY_TRAVERSAL_NONE ||
        (marker->marker_flags & (SELVA_SUBSCRIPTION_FLAG_DETACH | SELVA_SUBSCRIPTION_FLAG_TRIGGER))) {
        (void)SVector_Remove(&hierarchy->subs.detached_markers.vec, marker);
    } else if (marker->marker_flags & SELVA_SUBSCRIPTION_FLAG_MISSING) {
        struct SelvaObject *missing = GET_STATIC_SELVA_OBJECT(&hierarchy->subs.missing);
        SelvaObject_Iterator *it;
        struct Selva_SubscriptionMarker *tmp;
        const char *name_out;

        /*
         * Delete pointers from the `missing` object.
         */
        it = SelvaObject_ForeachBegin(missing);
        while ((tmp = SelvaObject_ForeachValue(missing, &it, &name_out, SELVA_OBJECT_POINTER))) {
            if (tmp->marker_id == marker->marker_id) {
                SelvaObject_DelKeyStr(missing, name_out, strlen(name_out));
            }
        }
    } else {
        Selva_NodeId *ids = marker->change_marker.node_ids;

        for (size_t i = 0; i < marker->change_marker.nr_node_ids; i++) {
            clear_node_sub(hierarchy, marker, ids[i]);
        }
    }

    destroy_marker(hierarchy, marker);
}

/**
 * Register a marker to a subscription.
 */
static void sub_add_marker(struct Selva_Subscription *sub, struct Selva_SubscriptionMarker *marker) {
    (void)SVector_Insert(&marker->subs, sub);
    (void)SVector_Insert(&sub->markers, marker);
}

static int delete_marker(SelvaHierarchy *hierarchy, struct Selva_Subscription *sub, Selva_SubscriptionMarkerId marker_id) {
    struct Selva_SubscriptionMarker find = {
        .marker_id = marker_id,
    };
    struct Selva_SubscriptionMarker *marker;

    marker = SVector_Remove(&sub->markers, &find);
    if (!marker) {
        return SELVA_SUBSCRIPTIONS_ENOENT;
    }

    /*
     * Send the possibly deferred event before removing the link to the other
     * direction.
     */
    (void)send_deferred_event(hierarchy, marker);

    (void)SVector_Remove(&marker->subs, sub);
    do_sub_marker_removal(hierarchy, marker);
    return 0;
}

int SelvaSubscriptions_DeleteMarker(
        SelvaHierarchy *hierarchy,
        Selva_SubscriptionId sub_id,
        Selva_SubscriptionMarkerId marker_id) {
    struct Selva_Subscription *sub;

    sub = find_sub(hierarchy, sub_id);
    if (!sub) {
        return SELVA_SUBSCRIPTIONS_ENOENT;
    }

    return delete_marker(hierarchy, sub, marker_id);
}

/**
 * Remove and destroy all markers of a subscription.
 */
static void remove_sub_markers(SelvaHierarchy *hierarchy, struct Selva_Subscription *sub) {
    if (SVector_Size(&sub->markers) > 0) {
        struct Selva_SubscriptionMarker *marker;

        while ((marker = SVector_Shift(&sub->markers))) {
            (void)send_deferred_event(hierarchy, marker);
            (void)SVector_Remove(&marker->subs, sub);
            do_sub_marker_removal(hierarchy, marker);
        }
        SVector_ShiftReset(&sub->markers);
    }
}

/*
 * Destroy all markers owned by a subscription and destroy the subscription.
 */
static void destroy_sub(SelvaHierarchy *hierarchy, struct Selva_Subscription *sub) {
    remove_sub_markers(hierarchy, sub);

    RB_REMOVE(hierarchy_subscriptions_tree, &hierarchy->subs.subs_head, sub);
    SVector_Destroy(&sub->markers);
#if MEM_DEBUG
    memset(sub, 0, sizeof(*sub));
#endif
    selva_free(sub);
}

/*
 * Destroy all subscription markers and subscriptions.
 */
static void destroy_all_sub_markers(SelvaHierarchy *hierarchy) {
    struct hierarchy_subscriptions_tree *subs_head = &hierarchy->subs.subs_head;
    struct Selva_Subscription *sub;
    struct Selva_Subscription *next;

    for (sub = RB_MIN(hierarchy_subscriptions_tree, subs_head); sub != NULL; sub = next) {
        next = RB_NEXT(hierarchy_subscriptions_tree, subs_head, sub);
        destroy_sub(hierarchy, sub);
    }
}

static void init_markers_struct(struct Selva_SubscriptionMarkers *markers) {
    SVector_Init(&markers->vec, 0, marker_svector_compare);
    markers->flags_filter = 0;
}

static void destroy_markers_struct(struct Selva_SubscriptionMarkers *markers) {
    SVector_Destroy(&markers->vec);
}

static void init_deferred_events(struct SelvaSubscriptions_DeferredEvents *def) {
    SVector_Init(&def->marker_events, 2, marker_svector_compare);
}

static void destroy_deferred_events(struct SelvaHierarchy *hierarchy) {
    struct SelvaSubscriptions_DeferredEvents *def = &hierarchy->subs.deferred_events;

    SVector_Destroy(&def->marker_events);
}

void SelvaSubscriptions_InitHierarchy(SelvaHierarchy *hierarchy) {
    RB_INIT(&hierarchy->subs.subs_head);
    RB_INIT(&hierarchy->subs.mrks_head);

    SelvaObject_Init(hierarchy->subs.missing._obj_data);

    init_markers_struct(&hierarchy->subs.detached_markers);
    init_deferred_events(&hierarchy->subs.deferred_events);
}

void SelvaSubscriptions_DestroyAll(SelvaHierarchy *hierarchy) {
    /*
     * If we destroy the defer vectors first then clearing the subs won't be
     * able to defer any events, as we want.
     */
    destroy_deferred_events(hierarchy);

    destroy_all_sub_markers(hierarchy);
    SelvaObject_Destroy(GET_STATIC_SELVA_OBJECT(&hierarchy->subs.missing));

    /*
     * Do this as the last step because destroy_all_sub_markers() will access
     * the vector.
     */
    destroy_markers_struct(&hierarchy->subs.detached_markers);
}

static void init_node_metadata_subs(
        const Selva_NodeId id __unused,
        struct SelvaHierarchyMetadata *metadata) {
    init_markers_struct(&metadata->sub_markers);
}
SELVA_MODIFY_HIERARCHY_METADATA_CONSTRUCTOR(init_node_metadata_subs);

static void deinit_node_metadata_subs(
        SelvaHierarchy *hierarchy __unused,
        struct SelvaHierarchyNode *node __unused,
        struct SelvaHierarchyMetadata *metadata) {
    destroy_markers_struct(&metadata->sub_markers);
}
SELVA_MODIFY_HIERARCHY_METADATA_DESTRUCTOR(deinit_node_metadata_subs);

static struct Selva_Subscription *find_sub(SelvaHierarchy *hierarchy, Selva_SubscriptionId sub_id) {
    struct Selva_Subscription filter = {
        .sub_id = sub_id,
    };

    return RB_FIND(hierarchy_subscriptions_tree, &hierarchy->subs.subs_head, &filter);
}

/**
 * Find a marker (globally).
 */
static struct Selva_SubscriptionMarker *find_marker(
        SelvaHierarchy *hierarchy,
        Selva_SubscriptionMarkerId marker_id) {
    struct Selva_SubscriptionMarker filter = {
        .marker_id = marker_id,
    };

    return RB_FIND(hierarchy_subscription_markers_tree, &hierarchy->subs.mrks_head, &filter);
}

/**
 * Find marker in a subscription.
 * Note that the marker may exist even if this function returns NULL but it's
 * just not associated with the given subscription.
 */
static struct Selva_SubscriptionMarker *find_sub_marker(
        struct Selva_Subscription *sub,
        Selva_SubscriptionMarkerId marker_id) {
    return SVector_Search(&sub->markers, &(struct Selva_SubscriptionMarker){
        .marker_id = marker_id,
    });
}

/**
 * Set mareker to a Selva_SubscriptionMarkers struct.
 */
static void set_marker(struct Selva_SubscriptionMarkers *sub_markers, struct Selva_SubscriptionMarker *marker) {
    if (!SVector_Insert(&sub_markers->vec, marker)) {
        sub_markers->flags_filter |= marker->marker_flags;
        marker->ref_count++;
    }
}

static void reset_marker_filter(struct Selva_SubscriptionMarkers *sub_markers) {
    struct SVectorIterator it;
    const struct Selva_SubscriptionMarker *marker;

    sub_markers->flags_filter = 0;

    SVector_ForeachBegin(&it, &sub_markers->vec);
    while ((marker = SVector_Foreach(&it))) {
        sub_markers->flags_filter |= marker->marker_flags;
    }
}

/**
 * Remove marker from sub_markers and update the marker filter.
 */
static void clear_marker(struct Selva_SubscriptionMarkers *sub_markers, struct Selva_SubscriptionMarker *marker) {
    /*
     * Remove marker from sub_markers and update the marker filter.
     */
    if (SVector_Remove(&sub_markers->vec, marker)) {
        marker->ref_count--;
    }
    reset_marker_filter(sub_markers);
}

/*
 * Set a marker to a node metadata.
 */
static int set_node_marker_cb(
        struct SelvaHierarchy *hierarchy,
        const struct SelvaHierarchyTraversalMetadata *,
        struct SelvaHierarchyNode *node,
        void *arg) {
    struct set_node_marker_data *data = (struct set_node_marker_data *)arg;
    struct Selva_SubscriptionMarker *marker = data->marker;
    struct SelvaHierarchyMetadata *metadata;

#if 0
    Selva_NodeId node_id;

    SelvaHierarchy_GetNodeId(node_id, node);
    SELVA_LOG(SELVA_LOGL_DBG, "Set sub marker %" PRImrkId " to %.*s",
              marker->marker_id,
              (int)SELVA_NODE_ID_SIZE, node_id);
#endif

    metadata = SelvaHierarchy_GetNodeMetadataByPtr(node);
    set_marker(&metadata->sub_markers, marker);

    if (marker->marker_flags & SELVA_SUBSCRIPTION_FLAG_REFRESH) {
        enum SelvaSubscriptionsMarkerFlags flags = SELVA_SUBSCRIPTION_FLAG_REFRESH;

        marker->action.marker_action(hierarchy, marker, flags, NULL, 0, node);
    }

    return 0;
}

static int clear_node_marker_cb(
        struct SelvaHierarchy *,
        const struct SelvaHierarchyTraversalMetadata *,
        struct SelvaHierarchyNode *node,
        void *arg) {
    struct SelvaHierarchyMetadata *metadata;
    struct Selva_SubscriptionMarker *marker = (struct Selva_SubscriptionMarker*)arg;

    metadata = SelvaHierarchy_GetNodeMetadataByPtr(node);
#if 0
    Selva_NodeId id;

    SelvaHierarchy_GetNodeId(id, node);
    SELVA_LOG(SELVA_LOGL_DBG, "Clear sub marker %" PRImrkId " from node %.*s (nr_subs: %zd)",
              marker->marker_id,
              (int)SELVA_NODE_ID_SIZE, id,
              SVector_Size(&metadata->sub_markers.vec));
#endif

    clear_marker(&metadata->sub_markers, marker);

    return 0;
}

/**
 * Create a subscription.
 */
static struct Selva_Subscription *new_subscription(
        struct SelvaHierarchy *hierarchy,
        Selva_SubscriptionId sub_id) {
    struct Selva_Subscription *sub;

    sub = selva_calloc(1, sizeof(struct Selva_Subscription));
    sub->sub_id = sub_id;
    SVector_Init(&sub->markers, 1, marker_svector_compare);

    /*
     * Add to the list of subscriptions.
     */
    if (unlikely(RB_INSERT(hierarchy_subscriptions_tree, &hierarchy->subs.subs_head, sub) != NULL)) {
        SVector_Destroy(&sub->markers);
        selva_free(sub);
        return NULL;
    }

    return sub;
}

static int upsert_sub_marker(struct SelvaHierarchy *hierarchy, Selva_SubscriptionId sub_id, struct Selva_SubscriptionMarker *marker) {
    struct Selva_Subscription *sub;

    sub = find_sub(hierarchy, sub_id);
    if (!sub) {
        sub = new_subscription(hierarchy, sub_id);
        if (!sub) {
            return SELVA_SUBSCRIPTIONS_EINVAL;
        }
    } else {
        if (find_sub_marker(sub, marker->marker_id)) {
            return SELVA_SUBSCRIPTIONS_EEXIST;
        }
    }

    sub_add_marker(sub, marker);

    return 0;
}

/**
 * Create a new marker structure.
 * @param fields_str can be NULL; SELVA_SUBSCRIPTION_FLAG_CH_FIELD is implicit if the arg is given.
 */
static int new_marker(
        struct SelvaHierarchy *hierarchy,
        Selva_SubscriptionMarkerId marker_id,
        const Selva_NodeId node_ids[],
        size_t nr_node_ids,
        const char *fields_str,
        size_t fields_len,
        enum SelvaSubscriptionsMarkerFlags flags,
        Selva_SubscriptionMarkerAction *marker_action,
        struct Selva_SubscriptionMarker **out)
{
    struct Selva_SubscriptionMarker *marker;

    marker = find_marker(hierarchy, marker_id);
    if (marker) {
        return SELVA_SUBSCRIPTIONS_EEXIST;
    }

    bool trigger_marker = !!(flags & (SELVA_SUBSCRIPTION_FLAG_MISSING | SELVA_SUBSCRIPTION_FLAG_TRIGGER));
    const size_t marker_struct_size = ALIGNED_SIZE(sizeof(struct Selva_SubscriptionMarker), alignof(Selva_NodeId));
    size_t marker_size = marker_struct_size;

    /* nr_node_ids XNOR trigger_marker */
    if (!!nr_node_ids == trigger_marker) {
        return SELVA_EINVAL;
    } else {
        marker_size += nr_node_ids * SELVA_NODE_ID_SIZE;
    }

    /*
     * Marker is a hierarchy change marker only if it opts for hierarchy
     * field updates. Otherwise hierarchy events are only sent when the
     * subscription needs a refresh.
     */
    if (fields_str && fields_len) {
        if (flags & SELVA_SUBSCRIPTION_FLAG_MISSING) {
            return SELVA_EINVAL;
        }

        flags |= SELVA_SUBSCRIPTION_FLAG_CH_FIELD;
        marker_size += fields_len + 1;
    }

    marker = selva_calloc(1, marker_size);
    marker->marker_id = marker_id;
    marker->marker_flags = flags;
    marker->change_marker.dir = SELVA_HIERARCHY_TRAVERSAL_NONE;
    marker->action.marker_action = marker_action;
    SVector_Init(&marker->subs, 0, subscription_svector_compare);

    if (nr_node_ids) {
        size_t bsize = nr_node_ids * SELVA_NODE_ID_SIZE;

        marker->change_marker.node_ids = (void *)((char *)marker + marker_struct_size);
        memcpy(marker->change_marker.node_ids, node_ids, bsize);
        marker->change_marker.nr_node_ids = nr_node_ids;
    }

    if (fields_str && fields_len) {
        marker->fields = (char *)marker + marker_size - 1 - fields_len;
        memcpy(marker->fields, fields_str, fields_len);
        marker->fields[fields_len] = '\0';
    }

    /* Never fails */
    (void)RB_INSERT(hierarchy_subscription_markers_tree, &hierarchy->subs.mrks_head, marker);

    *out = marker;
    return 0;
}

static void marker_set_dir(struct Selva_SubscriptionMarker *marker, enum SelvaTraversal dir) {
    assert(!(marker->marker_flags & SELVA_SUBSCRIPTION_FLAG_TRIGGER));
    marker->change_marker.dir = dir;
    marker->marker_flags |= SELVA_SUBSCRIPTION_FLAG_CH_HIERARCHY;
}

static void marker_set_trigger(struct Selva_SubscriptionMarker *marker, enum Selva_SubscriptionTriggerType event_type) {
    assert(marker->marker_flags & SELVA_SUBSCRIPTION_FLAG_TRIGGER);
    marker->trigger_marker.event_type = event_type;
}

static void marker_set_filter(struct Selva_SubscriptionMarker *marker, struct rpn_ctx *ctx, struct rpn_expression *expression) {
    marker->filter_ctx = ctx;
    marker->filter_expression = expression;
}

static void marker_set_action_owner_ctx(struct Selva_SubscriptionMarker *marker, void *owner_ctx) {
    marker->action.owner_ctx = owner_ctx;
}

/**
 * Set ref_field for the marker.
 * The traversal direction must have been set to one of the ones requiring a ref
 * before calling this function and the SELVA_SUBSCRIPTION_FLAG_TRIGGER flag
 * must not be set.
 * @param ref_field is the field used for traversal that must be a c-string.
 */
static void marker_set_ref_field(struct Selva_SubscriptionMarker *marker, const char *ref_field_str, size_t ref_field_len) {
    assert((marker->change_marker.dir & (SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD |
                                         SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD |
                                         SELVA_HIERARCHY_TRAVERSAL_FIELD |
                                         SELVA_HIERARCHY_TRAVERSAL_BFS_FIELD)) &&
           !(marker->marker_flags & SELVA_SUBSCRIPTION_FLAG_TRIGGER));

    marker->change_marker.ref_field = selva_malloc(ref_field_len + 1);
    memcpy(marker->change_marker.ref_field, ref_field_str, ref_field_len);
    marker->change_marker.ref_field[ref_field_len] = '\0';
}

static void marker_set_traversal_expression(struct Selva_SubscriptionMarker *marker, struct rpn_expression *traversal_expression) {
    assert(marker->change_marker.dir & (SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION |
                                        SELVA_HIERARCHY_TRAVERSAL_EXPRESSION));

    marker->change_marker.traversal_expression = traversal_expression;
}

static int traverse_marker_from_acb(union SelvaObjectArrayForeachValue, enum SelvaObjectType, void *)
{
    /*
     * NOP, this function is only provided to avoid errors being returned from
     * SelvaHierarchy_TraverseField2() and SelvaHierarchy_TraverseField2BFS().
     */
    return 0;
}

/**
 * Do a traversal over the given marker.
 * Bear in mind that cb is passed directly to the hierarchy traversal, thus any
 * filter set in the marker is not executed and the callback must execute the
 * filter if required.
 */
static int traverse_marker_from(
        struct SelvaHierarchy *hierarchy,
        struct Selva_SubscriptionMarker *marker,
        SelvaHierarchyNodeCallback node_cb,
        void *node_arg,
        const Selva_NodeId node_id) {
    struct SelvaHierarchyCallback cb = {
        .node_cb = node_cb,
        .node_arg = node_arg,
    };
    const enum SelvaTraversal dir = marker->change_marker.dir;
    const char *ref_field_str = marker->change_marker.ref_field;
    int err = 0;

    /*
     * Some traversals don't visit the head node but the marker system must
     * always visit it.
     */
    if (dir &
        (SELVA_HIERARCHY_TRAVERSAL_PARENTS |
         SELVA_HIERARCHY_TRAVERSAL_CHILDREN |
         SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD |
         SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD |
         SELVA_HIERARCHY_TRAVERSAL_EXPRESSION |
         SELVA_HIERARCHY_TRAVERSAL_FIELD |
         SELVA_HIERARCHY_TRAVERSAL_BFS_FIELD)) {
        cb.head_cb = node_cb;
        cb.head_arg = node_arg;
    }
    if (dir &
        (SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD |
         SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD |
         SELVA_HIERARCHY_TRAVERSAL_FIELD |
         SELVA_HIERARCHY_TRAVERSAL_BFS_FIELD) &&
        !marker->change_marker.ref_field) {
        return SELVA_SUBSCRIPTIONS_EINVAL;
    }

    if (dir & (SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD | SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD)) {
        int (*traverse)(
                struct SelvaHierarchy *hierarchy,
                const Selva_NodeId id,
                const char *ref_field_str,
                size_t ref_field_len,
                const struct SelvaHierarchyCallback *cb) = (dir == SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD)
            ? SelvaHierarchy_TraverseEdgeField
            : SelvaHierarchy_TraverseEdgeFieldBfs;

        err = traverse(hierarchy, node_id, marker->change_marker.ref_field, strlen(marker->change_marker.ref_field), &cb);
    } else if ((dir & (SELVA_HIERARCHY_TRAVERSAL_FIELD |
                       SELVA_HIERARCHY_TRAVERSAL_BFS_FIELD))) {
        const size_t ref_field_len = strlen(ref_field_str);
        struct SelvaHierarchyNode *head;
        struct field_lookup_traversable t;
        struct SelvaObjectArrayForeachCallback acb = {
            .cb = traverse_marker_from_acb,
            .cb_arg = NULL,
        };
        int (*traverse)(
                struct SelvaHierarchy *hierarchy,
                const Selva_NodeId node_id,
                const char *ref_field_str,
                size_t ref_field_len,
                const struct SelvaHierarchyCallback *hcb,
                const struct SelvaObjectArrayForeachCallback *acb) = (dir == SELVA_HIERARCHY_TRAVERSAL_FIELD)
            ? SelvaHierarchy_TraverseField2
            : SelvaHierarchy_TraverseField2Bfs;


        head = SelvaHierarchy_FindNode(hierarchy, node_id);
        if (!head) {
            err = SELVA_HIERARCHY_ENOENT;
            goto fail;
        }

        /* FIXME This check is not perfect for SELVA_HIERARCHY_TRAVERSAL_BFS_FIELD */
        err = field_lookup_traversable(head, ref_field_str, ref_field_len, &t);
        if (err) {
            goto fail;
        } else if (head != t.node) {
            err = SELVA_ENOTSUP;
            goto fail;
        }

        err = traverse(hierarchy, node_id, ref_field_str, ref_field_len, &cb, &acb);
    } else if (dir & (SELVA_HIERARCHY_TRAVERSAL_EXPRESSION | SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION)) {
        struct rpn_ctx *rpn_ctx;
        int (*traverse)(
                struct SelvaHierarchy *hierarchy,
                const Selva_NodeId id,
                struct rpn_ctx *rpn_ctx,
                const struct rpn_expression *rpn_expr,
                struct rpn_ctx *edge_filter_ctx,
                const struct rpn_expression *edge_filter,
                const struct SelvaHierarchyCallback *cb) = (dir == SELVA_HIERARCHY_TRAVERSAL_EXPRESSION)
            ? SelvaHierarchy_TraverseExpression
            : SelvaHierarchy_TraverseExpressionBfs;

        if (!marker->change_marker.traversal_expression) {
            return SELVA_SUBSCRIPTIONS_EINVAL;
        }

        rpn_ctx = rpn_init(1);
        err = traverse(hierarchy, node_id, rpn_ctx, marker->change_marker.traversal_expression, NULL, NULL, &cb);
        rpn_destroy(rpn_ctx);
    } else {
        /*
         * The rest of the traversal directions are handled by the following
         * function.
         * We might also end up here when dir is invalid. All possible
         * invalid cases will be handled propely by the following function.
         */

        err = SelvaHierarchy_Traverse(hierarchy, node_id, dir, &cb);
    }
fail:
    if (err) {
        SELVA_LOG(SELVA_LOGL_DBG, "Couldn't fully apply a subscription marker: %" PRImrkId " err: \"%s\" node_id: %.*s",
                  marker->marker_id,
                  selva_strerror(err),
                  (int)SELVA_NODE_ID_SIZE, node_id);

        /*
         * Don't report ENOENT errors because subscriptions are valid for
         * non-existent nodeIds.
         */
        if (err != SELVA_HIERARCHY_ENOENT && err != SELVA_ENOENT) {
            return err;
        }
    }

    return 0;
}

static int traverse_marker(
        struct SelvaHierarchy *hierarchy,
        struct Selva_SubscriptionMarker *marker,
        SelvaHierarchyNodeCallback node_cb,
        void *node_arg) {
    const size_t n = marker->change_marker.nr_node_ids;
    int err = 0;

    for (size_t i = 0; i < n; i++) {
        err = traverse_marker_from(hierarchy, marker, node_cb, node_arg, marker->change_marker.node_ids[i]) ?: err;
    }

    return 0;
}

static int refresh_marker(
        struct SelvaHierarchy *hierarchy,
        struct Selva_SubscriptionMarker *marker) {
    if (marker->change_marker.dir == SELVA_HIERARCHY_TRAVERSAL_NONE ||
        (marker->marker_flags & SELVA_SUBSCRIPTION_FLAG_DETACH)) {
        /*
         * This is a non-traversing marker but it needs to exist in the
         * detached markers.
         */
        set_marker(&hierarchy->subs.detached_markers, marker);

        return 0;
    } else {
        struct set_node_marker_data cb_data = {
            .marker = marker,
        };

        /*
         * Set subscription markers.
         */
        return traverse_marker(hierarchy, marker, set_node_marker_cb, &cb_data);
    }
}

static int refresh_subscription(struct SelvaHierarchy *hierarchy, struct Selva_Subscription *sub) {
    struct SVectorIterator it;
    struct Selva_SubscriptionMarker *marker;
    int res = 0;

    assert(sub);

    SVector_ForeachBegin(&it, &sub->markers);
    while ((marker = SVector_Foreach(&it))) {
        int err;

        err = refresh_marker(hierarchy, marker);
        if (err) {
            /* Report just the last error. */
            res = err;
        }
    }

    return res;
}

int SelvaSubscriptions_RefreshByMarkerId(
        struct SelvaHierarchy *hierarchy,
        Selva_SubscriptionId sub_id,
        Selva_SubscriptionMarkerId marker_id) {
    struct Selva_SubscriptionMarker *marker;

    marker = SelvaSubscriptions_GetMarker(hierarchy, sub_id, marker_id);
    if (!marker) {
        return SELVA_SUBSCRIPTIONS_ENOENT;
    }

    return refresh_marker(hierarchy, marker);
}

int SelvaSubscriptions_Refresh(struct SelvaHierarchy *hierarchy, Selva_SubscriptionId sub_id) {
    struct Selva_Subscription *sub;

    sub = find_sub(hierarchy, sub_id);
    if (!sub) {
        return SELVA_SUBSCRIPTIONS_ENOENT;
    }

    return refresh_subscription(hierarchy, sub);
}

void SelvaSubscriptions_RefreshSubsByMarker(struct SelvaHierarchy *hierarchy, const SVector *markers) {
    SVECTOR_AUTOFREE(all_subs);
    SVECTOR_AUTOFREE(all_markers);
    struct SVectorIterator it;
    struct Selva_SubscriptionMarker *marker;
    struct Selva_Subscription *sub;

    SVector_Init(&all_subs, 1, subscription_svector_compare);
    SVector_Init(&all_markers, SVector_Size(markers), marker_svector_compare);

    /*
     * First build a deduplicated list of all subscriptions referenced by
     * markers.
     */
    SVector_ForeachBegin(&it, markers);
    while ((marker = SVector_Foreach(&it))) {
        SVector_Concat(&all_subs, &marker->subs);
    }

    /*
     * Then build a deduplicated list of all markers referenced by all_subs.
     */
    SVector_ForeachBegin(&it, &all_subs);
    while ((sub = SVector_Foreach(&it))) {
        SVector_Concat(&all_markers, &sub->markers);
    }

    /*
     * Finally refresh each marker found.
     * If we were to just refresh each subscription we'd very likely hit the
     * same markers multiple times.
     */
    SVector_ForeachBegin(&it, &all_markers);
    while ((marker = SVector_Foreach(&it))) {
        /* Ignore errors for now. */
        (void)refresh_marker(hierarchy, marker);
    }
}

int SelvaSubscriptions_AddAliasMarker(
        struct SelvaHierarchy *hierarchy,
        Selva_SubscriptionId sub_id,
        Selva_SubscriptionMarkerId marker_id,
        const struct selva_string *alias_name,
        Selva_NodeId node_id
    ) {
    struct Selva_SubscriptionMarker *old_marker;
    struct rpn_ctx *filter_ctx = NULL;
    struct rpn_expression *filter_expression = NULL;
    int err = 0;


    old_marker = find_marker(hierarchy, marker_id);
    if (old_marker) {
        assert(old_marker->change_marker.nr_node_ids == 1);

        if (memcmp(old_marker->change_marker.node_ids[0], node_id, SELVA_NODE_ID_SIZE)) {
            TO_STR(alias_name);

            SELVA_LOG(SELVA_LOGL_WARN,
                      "Alias marker \"%.*s\" exists but it's associated with another node. No changed made. orig: %.*s new: %.*s\n:",
                      (int)alias_name_len, alias_name_str,
                      (int)SELVA_NODE_ID_SIZE, old_marker->change_marker.node_ids[0],
                      (int)SELVA_NODE_ID_SIZE, node_id);
        }

        return upsert_sub_marker(hierarchy, sub_id, old_marker);
    }

    /*
     * Compile the filter.
     * `aliases has alias_name`
     */
    filter_expression = rpn_compile("$1 $2 a");
    if (!filter_expression) {
        SELVA_LOG(SELVA_LOGL_ERR, "Failed to compile a filter for alias \"%s\"",
                  selva_string_to_str(alias_name, NULL));
        err = SELVA_RPN_ECOMP;
        goto fail;
    }

    filter_ctx = rpn_init(3);

    /*
     * Set RPN registers
     */
    enum rpn_error rpn_err;
    if ((rpn_err = rpn_set_reg_string(filter_ctx, 1, alias_name)) ||
        (rpn_err = rpn_set_reg(filter_ctx, 2, SELVA_ALIASES_FIELD, sizeof(SELVA_ALIASES_FIELD) - 1, 0))) {

        SELVA_LOG(SELVA_LOGL_ERR,
                  "Fatal RPN error while adding an alias maker. sub_id: %" PRIsubId " alias: %s rpn_error: %d",
                  sub_id,
                  selva_string_to_str(alias_name, NULL),
                  rpn_err);
        if (rpn_err == RPN_ERR_ENOMEM) {
            err = SELVA_ENOMEM;
        } else {
            /* This is the closest we have until we merge RPN errors to SELVA errors. */
            err = SELVA_RPN_ECOMP;
        }
        goto fail;
    }

    struct Selva_SubscriptionMarker *marker;
    err = new_marker(hierarchy, marker_id, (Selva_NodeId *)node_id, 1,
                     NULL, 0,
                     SELVA_SUBSCRIPTION_FLAG_CH_ALIAS, defer_event, &marker);
    if (err) {
        goto fail;
    }

    err = upsert_sub_marker(hierarchy, sub_id, marker);
    if (err) {
        do_sub_marker_removal(hierarchy, marker);
        goto fail;
    }
    marker_set_dir(marker, SELVA_HIERARCHY_TRAVERSAL_NODE);
    marker_set_filter(marker, filter_ctx, filter_expression);

    (void)refresh_marker(hierarchy, marker);
    return err;
fail:
    rpn_destroy(filter_ctx);
    rpn_destroy_expression(filter_expression);

    return err;
}

int SelvaSubscriptions_AddMissingMarker(
        struct SelvaHierarchy *hierarchy,
        Selva_SubscriptionId sub_id,
        Selva_SubscriptionMarkerId marker_id,
        struct selva_string **accessors,
        size_t nr_accessors
    ) {
    struct SelvaObject *missing = GET_STATIC_SELVA_OBJECT(&hierarchy->subs.missing);
    struct Selva_SubscriptionMarker *marker;
    int err;

    if (nr_accessors == 0) {
        return SELVA_EINVAL;
    }

    marker = find_marker(hierarchy, marker_id);
    if (marker && !(marker->marker_flags & SELVA_SUBSCRIPTION_FLAG_MISSING)) {
        return SELVA_EINVAL;
    } else if (!marker) {
        err = new_marker(hierarchy, marker_id, NULL, 0, NULL, 0,
                         SELVA_SUBSCRIPTION_FLAG_MISSING,
                         defer_event, &marker);
        if (err) {
            return err;
        }
    }

    err = upsert_sub_marker(hierarchy, sub_id, marker);
    if (err && err != SELVA_SUBSCRIPTIONS_EEXIST) {
        do_sub_marker_removal(hierarchy, marker);
        return err;
    }

    for (size_t i = 0; i < nr_accessors; i++) {
        int err;

        err = SelvaObject_SetPointer(missing, accessors[i], marker, &subs_missing_obj_opts);
        if (err) {
            SELVA_LOG(SELVA_LOGL_ERR, "Failed to set a missing marker (%" PRImrkId "): %s",
                      marker_id, selva_strerror(err));
        }
    }

    return 0;
}

int SelvaSubscriptions_AddCallbackMarker(
        struct SelvaHierarchy *hierarchy,
        Selva_SubscriptionId sub_id,
        Selva_SubscriptionMarkerId marker_id,
        enum SelvaSubscriptionsMarkerFlags marker_flags,
        const Selva_NodeId node_id,
        enum SelvaTraversal dir,
        const char *dir_field,
        const char *dir_expression_str,
        const char *filter_str,
        Selva_SubscriptionMarkerAction *callback,
        void *owner_ctx
    ) {
    struct rpn_expression *dir_expression = NULL;
    struct rpn_expression *filter = NULL;
    struct rpn_ctx *filter_ctx = NULL;
    struct Selva_SubscriptionMarker *marker;
    int err = 0;

    marker = find_marker(hierarchy, marker_id);
    if (marker) {
        return upsert_sub_marker(hierarchy, sub_id, marker);
    }

    if (dir & (SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION | SELVA_HIERARCHY_TRAVERSAL_EXPRESSION)) {
        if (!dir_expression_str) {
            err = SELVA_EINVAL;
            goto out;
        }

        dir_expression = rpn_compile(dir_expression_str);
        if (!dir_expression) {
            err = SELVA_RPN_ECOMP;
            goto out;
        }
    }

    if (filter_str) {
        filter = rpn_compile(filter_str);
        if (!filter) {
            err = SELVA_RPN_ECOMP;
            goto out;
        }

        filter_ctx = rpn_init(1);
    }

    /*
     * For now we just match to any field change and assume that the filter
     * takes care of the actual matching. This will work fine for indexing
     * but some other use cases might require another approach later on.
     */
    err = new_marker(hierarchy, marker_id, (Selva_NodeId *)node_id, 1,
                     filter ? "" : NULL, 0,
                     marker_flags, callback, &marker);
    if (err) {
        goto out;
    }

    err = upsert_sub_marker(hierarchy, sub_id, marker);
    if (err) {
        do_sub_marker_removal(hierarchy, marker);
        goto out;
    }
    marker_set_dir(marker, dir);

    if (dir_expression) {
        marker_set_traversal_expression(marker, dir_expression);
    } else if (dir_field) {
        marker_set_ref_field(marker, dir_field, strlen(dir_field));
    }

    marker_set_filter(marker, filter_ctx, filter);

    marker_set_action_owner_ctx(marker, owner_ctx);

out:
    if (err) {
        rpn_destroy_expression(dir_expression);
        rpn_destroy_expression(filter);
        rpn_destroy(filter_ctx);
    }

    return err;
}

struct Selva_SubscriptionMarker *SelvaSubscriptions_GetMarker(
        struct SelvaHierarchy *hierarchy,
        Selva_SubscriptionId sub_id,
        Selva_SubscriptionMarkerId marker_id) {
    struct Selva_Subscription *sub;

    sub = find_sub(hierarchy, sub_id);
    if (!sub) {
        return NULL;
    }

    return find_sub_marker(sub, marker_id);
}

/**
 * Clear subscription marker starting from node_id.
 * Clear the given marker of a subscription from the nodes following traversal
 * direction starting from node_id.
 */
static void clear_node_sub(struct SelvaHierarchy *hierarchy, struct Selva_SubscriptionMarker *marker, const Selva_NodeId node_id) {
    int err;

    err = traverse_marker_from(hierarchy, marker, clear_node_marker_cb, marker, node_id);
    if (err) {
        SELVA_LOG(SELVA_LOGL_CRIT,
                  "Failed to clear the marker %" PRImrkId " node_id: %.*s: %s",
                  marker->marker_id,
                  (int)SELVA_NODE_ID_SIZE, node_id,
                  selva_strerror(err));
        abort(); /* It would be dangerous to not abort here. */
    }
}

void SelvaSubscriptions_Delete(
        struct SelvaHierarchy *hierarchy,
        Selva_SubscriptionId sub_id) {
    struct Selva_Subscription *sub;

    sub = find_sub(hierarchy, sub_id);
    if (sub) {
        destroy_sub(hierarchy, sub);
    }
}

void SelvaSubscriptions_ClearAllMarkers(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node) {
    struct SelvaHierarchyMetadata *metadata = SelvaHierarchy_GetNodeMetadataByPtr(node);
    const size_t nr_markers = SVector_Size(&metadata->sub_markers.vec);
    struct SVectorIterator it;
    struct Selva_SubscriptionMarker *marker;
    SVECTOR_AUTOFREE(markers);
    Selva_NodeId node_id;

    SelvaHierarchy_GetNodeId(node_id, node);

    if (nr_markers == 0) {
        return;
    }

#if 0
    SELVA_LOG(SELVA_LOGL_DBG, "Removing %zu subscription markers from %.*s",
              nr_markers, (int)SELVA_NODE_ID_SIZE, node_id);
#endif

    if (unlikely(!SVector_Clone(&markers, &metadata->sub_markers.vec, NULL))) {
        SELVA_LOG(SELVA_LOGL_ERR, "Failed to clone an SVector");
        return;
    }

    /*
     * Remove each subscription marker from this node and its ancestors/descendants.
     */
    SVector_ForeachBegin(&it, &markers);
    while ((marker = SVector_Foreach(&it))) {
        enum SelvaSubscriptionsMarkerFlags flags = SELVA_SUBSCRIPTION_FLAG_CL_HIERARCHY | SELVA_SUBSCRIPTION_FLAG_CH_HIERARCHY;

        clear_node_sub(hierarchy, marker, node_id);
        marker->action.marker_action(hierarchy, marker, flags, NULL, 0, node);
    }
    SVector_Clear(&metadata->sub_markers.vec);
}

void SelvaSubscriptions_InheritParent(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId node_id __unused,
        struct SelvaHierarchyMetadata *node_metadata,
        size_t node_nr_children,
        struct SelvaHierarchyNode *parent) {
    /*
     * Trigger all relevant subscriptions to make sure the subscriptions are
     * propagated properly.
     */
    if (node_nr_children > 0) {
        defer_event_for_traversing_markers(hierarchy, parent);
    } else {
        Selva_NodeId parent_id;
        struct SVectorIterator it;
        struct Selva_SubscriptionMarker *marker;
        struct Selva_SubscriptionMarkers *node_sub_markers = &node_metadata->sub_markers;
        const SVector *markers_vec = &SelvaHierarchy_GetNodeMetadataByPtr(parent)->sub_markers.vec;

        SelvaHierarchy_GetNodeId(parent_id, parent);

        SVector_ForeachBegin(&it, markers_vec);
        while ((marker = SVector_Foreach(&it))) {
#if 0
            SELVA_LOG(SELVA_LOGL_DBG, "Inherit marker %" PRImrkId " to %.*s <- %.*s",
                      marker->marker_id,
                      (int)SELVA_NODE_ID_SIZE, node_id,
                      (int)SELVA_NODE_ID_SIZE, parent_id);
#endif
            switch (marker->change_marker.dir) {
            case SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS:
            case SELVA_HIERARCHY_TRAVERSAL_DFS_DESCENDANTS:
            case SELVA_HIERARCHY_TRAVERSAL_DFS_FULL:
                /* These markers can be copied safely. */
                set_marker(node_sub_markers, marker);
                break;
            case SELVA_HIERARCHY_TRAVERSAL_CHILDREN:
                /* Only propagate if the parent is the first node. */
                if (marker_includes_node_id(parent_id, marker)) {
                    set_marker(node_sub_markers, marker);
                }
                break;
            default:
                /*
                 * NOP.
                 */
                break;
            }
        }
    }
}

void SelvaSubscriptions_InheritChild(
        struct SelvaHierarchy *hierarchy,
        const Selva_NodeId node_id __unused,
        struct SelvaHierarchyMetadata *node_metadata,
        size_t node_nr_parents,
        struct SelvaHierarchyNode *child) {
    /*
     * Trigger all relevant subscriptions to make sure the subscriptions are
     * propagated properly.
     */
    if (node_nr_parents > 0) {
        defer_event_for_traversing_markers(hierarchy, child);
    } else {
        Selva_NodeId child_id;
        struct SVectorIterator it;
        struct Selva_SubscriptionMarker *marker;
        struct Selva_SubscriptionMarkers *node_sub_markers = &node_metadata->sub_markers;
        const SVector *markers_vec = &SelvaHierarchy_GetNodeMetadataByPtr(child)->sub_markers.vec;

        SelvaHierarchy_GetNodeId(child_id, child);

        SVector_ForeachBegin(&it, markers_vec);
        while ((marker = SVector_Foreach(&it))) {
#if 0
            SELVA_LOG(SELVA_LOGL_DBG, "inherit marker %" PRImrkId " to %.*s <- %.*s",
                      marker->marker_id,
                      (int)SELVA_NODE_ID_SIZE, node_id,
                      (int)SELVA_NODE_ID_SIZE, child_id);
#endif
            switch (marker->change_marker.dir) {
            case SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS:
            case SELVA_HIERARCHY_TRAVERSAL_DFS_ANCESTORS:
                /* These markers can be copied safely. */
                set_marker(node_sub_markers, marker);
                break;
            case SELVA_HIERARCHY_TRAVERSAL_PARENTS:
                /* Only propagate if the child is the first node. */
                if (marker_includes_node_id(child_id, marker)) {
                    set_marker(node_sub_markers, marker);
                }
                break;
            default:
                /*
                 * NOP.
                 */
                break;
            }
        }
    }
}

void SelvaSubscriptions_InheritEdge(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *src_node,
        struct SelvaHierarchyNode *dst_node,
        const char *field_str,
        size_t field_len) {
    Selva_NodeId src_node_id;
    Selva_NodeId dst_node_id;
    struct SelvaHierarchyMetadata *src_metadata = SelvaHierarchy_GetNodeMetadataByPtr(src_node);
    struct SelvaHierarchyMetadata *dst_metadata = SelvaHierarchy_GetNodeMetadataByPtr(dst_node);
    struct Selva_SubscriptionMarkers *src_markers = &src_metadata->sub_markers;
    struct Selva_SubscriptionMarkers *dst_markers = &dst_metadata->sub_markers;
    struct SVectorIterator it;
    struct Selva_SubscriptionMarker *marker;
    int defer_all_traversing = 0;

    SelvaHierarchy_GetNodeId(src_node_id, src_node);
    SelvaHierarchy_GetNodeId(dst_node_id, dst_node);

    SVector_ForeachBegin(&it, &src_markers->vec);
    while ((marker = SVector_Foreach(&it))) {
        const enum SelvaTraversal dir = marker->change_marker.dir;
        if ((dir & (SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD | SELVA_HIERARCHY_TRAVERSAL_BFS_FIELD)) ||
            ((dir & (SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD | SELVA_HIERARCHY_TRAVERSAL_FIELD)) &&
             marker_includes_node_id(src_node_id, marker))) {
            const size_t ref_field_len = strlen(marker->change_marker.ref_field);

            if (field_len == ref_field_len && !strncmp(field_str, marker->change_marker.ref_field, ref_field_len)) {
                set_marker(dst_markers, marker);

                if (!defer_all_traversing &&
                    (dir & SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD) &&
                    Edge_GetField(dst_node, field_str, field_len)) {
                    /*
                     * If there was a traversing marker and the destination has the field
                     * too then we should send an event to make the client propagate the
                     * subscription marker by issuing a refresh.
                     * RFE Technically we could check whether the field is empty before
                     * doing this.
                     */
                    defer_all_traversing = 1;
                } else if ((dir & SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD) &&
                           Selva_SubscriptionFilterMatch(hierarchy, dst_node, marker)) {
                    enum SelvaSubscriptionsMarkerFlags flags = SELVA_SUBSCRIPTION_FLAG_CH_HIERARCHY;

                    /*
                     * In the case of a marker over single edge_field we should
                     * just trigger the markers that match.
                     */
                    marker->action.marker_action(hierarchy, marker, flags, NULL, 0, dst_node);
                }
            }
        } else if (dir & (SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION | SELVA_HIERARCHY_TRAVERSAL_EXPRESSION)) {
            enum SelvaSubscriptionsMarkerFlags flags = SELVA_SUBSCRIPTION_FLAG_CH_HIERARCHY;

            marker->action.marker_action(hierarchy, marker, flags, NULL, 0, dst_node);
        }
    }

    if (defer_all_traversing) {
        defer_event_for_traversing_markers(hierarchy, dst_node);
    }
}

static void defer_event(
        struct SelvaHierarchy *hierarchy,
        struct Selva_SubscriptionMarker *marker,
        enum SelvaSubscriptionsMarkerFlags event_flags,
        const char *field_str __unused,
        size_t field_len __unused,
        struct SelvaHierarchyNode *node __unused) {
    struct SelvaSubscriptions_DeferredEvents *def = &hierarchy->subs.deferred_events;

    marker->history.flags |= event_flags;

    if (SVector_IsInitialized(&def->marker_events)) {
        SVector_Insert(&def->marker_events, marker);
    }
}

static void remove_missing_marker(struct SelvaHierarchy *hierarchy, struct Selva_SubscriptionMarker *marker)
{
    struct Selva_Subscription *sub;

    /**
     * Remove all subscriptions from a marker but leave the marker.
     * do_sub_marker_removal() will certainly destroy the marker after this.
     */
    while ((sub = SVector_Shift(&marker->subs))) {
        //SELVA_LOG(SELVA_LOGL_ERR, "sub: %p", sub);
        (void)SVector_Remove(&sub->markers, marker);
    }
    SVector_ShiftReset(&marker->subs);

    do_sub_marker_removal(hierarchy, marker);
}

/**
 * Defer events for missing accessor signaling creation of nodes and aliases.
 * @param id nodeId or alias.
 */
void SelvaSubscriptions_DeferMissingAccessorEvents(struct SelvaHierarchy *hierarchy, const char *accessor_str, size_t accessor_len) {
    struct SelvaObject *missing = GET_STATIC_SELVA_OBJECT(&hierarchy->subs.missing);
    void *p;
    int err;

    err = SelvaObject_GetPointerStr(missing, accessor_str, accessor_len, &p);
    if (!err && p) {
        struct Selva_SubscriptionMarker *marker = p;

        marker->action.marker_action(hierarchy, marker, SELVA_SUBSCRIPTION_FLAG_MISSING, NULL, 0, NULL);
        SelvaObject_DelKeyStr(missing, accessor_str, accessor_len);
        (void)send_deferred_event(hierarchy, marker);
        remove_missing_marker(hierarchy, marker);
    } else if (err != SELVA_ENOENT) {
        SELVA_LOG(SELVA_LOGL_ERR, "Failed to retrieve a missing accessor marker: \"%.*s\" err: %s",
                  (int)accessor_len, accessor_str,
                  selva_strerror(err));
    }
}

/**
 * Defer event if a marker is traversing marker.
 * Use defer_event_for_traversing_markers() instead of this function.
 */
static void defer_traversing(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        const struct Selva_SubscriptionMarkers *sub_markers) {
    struct SVectorIterator it;
    struct Selva_SubscriptionMarker *marker;

    SVector_ForeachBegin(&it, &sub_markers->vec);
    while ((marker = SVector_Foreach(&it))) {
        if (!(marker->change_marker.dir & (SELVA_HIERARCHY_TRAVERSAL_NONE |
                                           SELVA_HIERARCHY_TRAVERSAL_NODE))) {
            enum SelvaSubscriptionsMarkerFlags flags = SELVA_SUBSCRIPTION_FLAG_CH_HIERARCHY;

            marker->action.marker_action(hierarchy, marker, flags, NULL, 0, node);
        }
    }
}

static void defer_event_for_traversing_markers(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node) {
    /* Detached markers. */
    defer_traversing(hierarchy, node, &hierarchy->subs.detached_markers);

    /* Markers on the node. */
    defer_traversing(hierarchy, node, &SelvaHierarchy_GetNodeMetadataByPtr(node)->sub_markers);
}

static void defer_alias_change_events(
        struct SelvaHierarchy *hierarchy,
        const struct Selva_SubscriptionMarkers *sub_markers,
        struct SelvaHierarchyNode *node,
        SVector *wipe_subs) {
    struct SVectorIterator it;
    struct Selva_SubscriptionMarker *marker;

    if (!isAliasMarker(sub_markers->flags_filter)) {
        /* No alias markers in this structure. */
        return;
    }

    SVector_ForeachBegin(&it, &sub_markers->vec);
    while ((marker = SVector_Foreach(&it))) {
        if (isAliasMarker(marker->marker_flags) &&
            /* The filter should contain `in` matcher for the alias. */
            Selva_SubscriptionFilterMatch(hierarchy, node, marker)
            ) {
            enum SelvaSubscriptionsMarkerFlags flags = SELVA_SUBSCRIPTION_FLAG_CH_ALIAS;

            marker->action.marker_action(hierarchy, marker, flags, NULL, 0, node);

            /*
             * Wipe the markers of this subscription after the events have been
             * deferred. We assume that these subscriptions wanted to always
             * observer the alias not the specific node.
             */
            SVector_Concat(wipe_subs, &marker->subs);
        }
    }
}

/**
 * Check whether the filter matches before changing the value of a node field.
 */
static void field_change_precheck(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        const struct Selva_SubscriptionMarkers *sub_markers) {
    const enum SelvaSubscriptionsMarkerFlags flags = SELVA_SUBSCRIPTION_FLAG_CH_FIELD;

    if ((sub_markers->flags_filter & flags) == flags) {
        struct SVectorIterator it;
        struct Selva_SubscriptionMarker *marker;

        SVector_ForeachBegin(&it, &sub_markers->vec);
        while ((marker = SVector_Foreach(&it))) {
            if ((marker->marker_flags & flags) == flags) {
                /*
                 * Store the filter result before any changes to the node.
                 * We assume that SelvaSubscriptions_DeferFieldChangeEvents()
                 * is called before this function is called for another node.
                 */
                SelvaHierarchy_GetNodeId(marker->history.node_id, node);
                marker->history.res = Selva_SubscriptionFilterMatch(hierarchy, node, marker);
            }
        }
    }
}

void SelvaSubscriptions_FieldChangePrecheck(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node) {
    const struct SelvaHierarchyMetadata *metadata;

    /* Detached markers. */
    field_change_precheck(hierarchy, node, &hierarchy->subs.detached_markers);

    /* Markers on the node. */
    metadata = SelvaHierarchy_GetNodeMetadataByPtr(node);
    field_change_precheck(hierarchy, node, &metadata->sub_markers);
}

static bool is_field_traversed(
        struct Selva_SubscriptionMarker * restrict marker,
        const char * restrict field_str, size_t field_len) {
#define IS_FIELD(name) \
    (field_len == (sizeof(name) - 1) && !memcmp(name, field_str, sizeof(name) - 1))
    if ((marker->marker_flags & SELVA_SUBSCRIPTION_FLAG_CH_HIERARCHY)) {
        switch (marker->change_marker.dir) {
        case SELVA_HIERARCHY_TRAVERSAL_NONE:
        case SELVA_HIERARCHY_TRAVERSAL_NODE:
        case SELVA_HIERARCHY_TRAVERSAL_DFS_FULL:
        case SELVA_HIERARCHY_TRAVERSAL_ARRAY:
            return false;
        case SELVA_HIERARCHY_TRAVERSAL_CHILDREN:
            return IS_FIELD(SELVA_CHILDREN_FIELD);
        case SELVA_HIERARCHY_TRAVERSAL_PARENTS:
            return IS_FIELD(SELVA_PARENTS_FIELD);
        case SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS:
        case SELVA_HIERARCHY_TRAVERSAL_DFS_ANCESTORS:
            return IS_FIELD(SELVA_ANCESTORS_FIELD);
        case SELVA_HIERARCHY_TRAVERSAL_DFS_DESCENDANTS:
        case SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS:
            return IS_FIELD(SELVA_DESCENDANTS_FIELD);
        case SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION:
            return true;
        case SELVA_HIERARCHY_TRAVERSAL_EXPRESSION:
            return true; /* Can't be sure. */
        case SELVA_HIERARCHY_TRAVERSAL_BFS_FIELD:
        case SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD:
        case SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD:
        case SELVA_HIERARCHY_TRAVERSAL_FIELD:
            return (field_len == strlen(marker->change_marker.ref_field) &&
                    !memcmp(field_str, marker->change_marker.ref_field, field_len));
        }
    }

    return false;
#undef IS_FIELD
}

static void defer_field_change_events(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        const struct Selva_SubscriptionMarkers *sub_markers,
        const char *field_str,
        size_t field_len) {
    enum SelvaSubscriptionsMarkerFlags flags = SELVA_SUBSCRIPTION_FLAG_CH_FIELD;

    if ((sub_markers->flags_filter & flags) == flags) {
        struct SVectorIterator it;
        struct Selva_SubscriptionMarker *marker;

        SVector_ForeachBegin(&it, &sub_markers->vec);
        while ((marker = SVector_Foreach(&it))) {
            Selva_NodeId node_id;

            SelvaHierarchy_GetNodeId(node_id, node);

            if (is_field_traversed(marker, field_str, field_len)) {
                flags |= SELVA_SUBSCRIPTION_FLAG_CH_HIERARCHY;
                marker->action.marker_action(hierarchy, marker, flags, field_str, field_len, node);
            } else if (((marker->marker_flags & flags) == flags) && !inhibitMarkerEvent(node_id, marker)) {
                const int expressionMatchBefore = marker->history.res && !memcmp(marker->history.node_id, node_id, SELVA_NODE_ID_SIZE);
                const int expressionMatchAfter = Selva_SubscriptionFilterMatch(hierarchy, node, marker);
                const int fieldsMatch = Selva_SubscriptionFieldMatch(marker, field_str, field_len);

                if ((expressionMatchBefore && expressionMatchAfter && fieldsMatch) || (expressionMatchBefore ^ expressionMatchAfter)) {
                    marker->action.marker_action(hierarchy, marker, flags, field_str, field_len, node);
                }
            }
        }
    }
}

void SelvaSubscriptions_DeferFieldChangeEvents(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len) {
    const char *ary_start = (const char *)memrchr(field_str, '[', field_len);

    if (ary_start) {
        size_t ary_field_len = ary_start - field_str;

        /* Array */
        /* Detached markers. */
        defer_field_change_events(hierarchy, node, &hierarchy->subs.detached_markers, field_str, ary_field_len);

        const struct SelvaHierarchyMetadata *metadata;
        metadata = SelvaHierarchy_GetNodeMetadataByPtr(node);

        /* Markers on the node. */
        defer_field_change_events(hierarchy, node, &metadata->sub_markers, field_str, ary_field_len);
    } else {
        /* Regular field */
        /* Detached markers. */
        defer_field_change_events(hierarchy, node, &hierarchy->subs.detached_markers, field_str, field_len);

        const struct SelvaHierarchyMetadata *metadata;
        metadata = SelvaHierarchy_GetNodeMetadataByPtr(node);

        /* Markers on the node. */
        defer_field_change_events(hierarchy, node, &metadata->sub_markers, field_str, field_len);
    }
}

void SelvaSubscriptions_DeferAliasChangeEvents(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node) {
    SVECTOR_AUTOFREE(wipe_subs);
    struct SelvaHierarchyMetadata *metadata;

    SVector_Init(&wipe_subs, 0, subscription_svector_compare);

    if (!node) {
        return;
    }

    metadata = SelvaHierarchy_GetNodeMetadataByPtr(node);
    if (!metadata) {
        Selva_NodeId node_id;

        SelvaHierarchy_GetNodeId(node_id, node);
        SELVA_LOG(SELVA_LOGL_ERR, "Failed to get metadata for node: \"%.*s\"",
                  (int)SELVA_NODE_ID_SIZE, node_id);
        return;
    }

    /*
     * Alias markers are never detached so no need to handle those.
     */

    /* Defer events for markers on the src node. */
    defer_alias_change_events(
            hierarchy,
            &metadata->sub_markers,
            node,
            &wipe_subs);

    struct SVectorIterator sub_it;
    struct Selva_Subscription *sub;

    SVector_ForeachBegin(&sub_it, &wipe_subs);
    while ((sub = SVector_Foreach(&sub_it))) {
        remove_sub_markers(hierarchy, sub);
    }
}

void SelvaSubscriptions_DeferTriggerEvents(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        enum Selva_SubscriptionTriggerType event_type) {
    /* Trigger markers are always detached and have no node_id. */
    const struct Selva_SubscriptionMarkers *sub_markers = &hierarchy->subs.detached_markers;

    if (isTriggerMarker(sub_markers->flags_filter)) {
        struct SVectorIterator it;
        struct Selva_SubscriptionMarker *marker;

        SVector_ForeachBegin(&it, &sub_markers->vec);
        while ((marker = SVector_Foreach(&it))) {
            if (isTriggerMarker(marker->marker_flags) &&
                marker->trigger_marker.event_type == event_type &&
                Selva_SubscriptionFilterMatch(hierarchy, node, marker)) {
                enum SelvaSubscriptionsMarkerFlags flags = SELVA_SUBSCRIPTION_FLAG_TRIGGER;

                /*
                 * The node_id might be there already if the marker has a filter
                 * but trigger events will need the node_id there regardless of if
                 * a filter is actually used.
                 */
                SelvaHierarchy_GetNodeId(marker->history.node_id, node);

                /*
                 * We don't call defer_event() here directly to allow
                 * customization of subscription marker events.
                 * Note that the node pointer is only valid during this function call.
                 */
                marker->action.marker_action(hierarchy, marker, flags, NULL, 0, node);
            }
        }
    }
}

/**
 * Send an event for a marker over the pubsub channel.
 */
static void send_event(const struct Selva_SubscriptionMarker *marker) {
    struct SelvaSubscriptions_PubsubMessage *msg;
    struct SVectorIterator it;
    const struct Selva_Subscription *sub;
    size_t i = 0;

    const size_t sub_ids_size = SVector_Size(&marker->subs) * sizeof(Selva_SubscriptionId);
    const size_t msg_size = sizeof(*msg) + sub_ids_size;
    msg = selva_calloc(1, msg_size);

    msg->marker_id = htole64(marker->marker_id);
    msg->flags = htole32(marker->history.flags);
    msg->sub_ids = (void *)(htole64(sizeof(*msg)));
    msg->sub_ids_size = htole64(sub_ids_size);

    SVector_ForeachBegin(&it, &marker->subs);
    while ((sub = SVector_Foreach(&it))) {
        const Selva_SubscriptionId sub_id = htole64(sub->sub_id);
        const size_t k = sizeof(sub_id);

        memcpy((char *)msg + sizeof(*msg) + i * k, &sub_id, k);
        i++;
    }

    selva_pubsub_publish(SELVA_SUBSCRIPTIONS_PUBSUB_CH_ID, msg, msg_size);
    selva_free(msg);
}

static bool send_deferred_event(struct SelvaHierarchy *hierarchy, struct Selva_SubscriptionMarker *marker) {
    struct SelvaSubscriptions_DeferredEvents *def = &hierarchy->subs.deferred_events;
    bool res = false;

    if (SVector_Remove(&def->marker_events, marker)) {
        send_event(marker);
        memset(&marker->history, 0, sizeof(marker->history));
        res = true;
    }

    return res;
}

void SelvaSubscriptions_SendDeferredEvents(struct SelvaHierarchy *hierarchy) {
    struct SelvaSubscriptions_DeferredEvents *def = &hierarchy->subs.deferred_events;
    struct SVectorIterator it;
    struct Selva_SubscriptionMarker *marker;

    SVector_ForeachBegin(&it, &def->marker_events);
    while ((marker = SVector_Foreach(&it))) {
        send_event(marker);

        /* It should be ok to clear the history now. */
        memset(&marker->history, 0, sizeof(marker->history));
    }

    SVector_Clear(&def->marker_events);
}

/**
 * Send svector containing Selva_Subscription pointers to resp.
 */
static void send_svector_subs(struct selva_server_response_out *resp, SVector *subs) {
    struct SVectorIterator it;
    struct Selva_Subscription *sub;

    selva_send_array(resp, SVector_Size(subs));

    SVector_ForeachBegin(&it, subs);
    while ((sub = SVector_Foreach(&it))) {
        selva_send_ll(resp, sub->sub_id);
    }
}

void SelvaSubscriptions_ReplyWithMarker(struct selva_server_response_out *resp, Selva_SubscriptionMarkerReply_t mp) {
    struct Selva_SubscriptionMarker *marker = mp.marker;
    const int is_trigger = isTriggerMarker(marker->marker_flags);

    selva_send_array(resp, -1);

    selva_send_strf(resp, "sub_ids");
    send_svector_subs(resp, &marker->subs);

    selva_send_strf(resp, "marker_id");
    selva_send_ll(resp, marker->marker_id);

    selva_send_strf(resp, "flags");
    selva_send_llx(resp, marker->marker_flags);

    if (is_trigger) {
        selva_send_strf(resp, "event_type");
        selva_send_strf(resp, "%s", trigger_event_types[marker->trigger_marker.event_type].name);
    } else {
        size_t n = marker->change_marker.nr_node_ids;

        selva_send_strf(resp, "node_ids");
        selva_send_array(resp, n);

        for (size_t i = 0; i < n; i++) {
            Selva_NodeId node_id;

            memcpy(node_id, marker->change_marker.node_ids[i], SELVA_NODE_ID_SIZE);
            selva_send_str(resp, node_id, Selva_NodeIdLen(node_id));
        }

        selva_send_strf(resp, "dir");
        selva_send_strf(resp, "%s", SelvaTraversal_Dir2str(marker->change_marker.dir));

        if (marker->change_marker.dir & (SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD |
                                         SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD |
                                         SELVA_HIERARCHY_TRAVERSAL_FIELD |
                                         SELVA_HIERARCHY_TRAVERSAL_BFS_FIELD)) {
            selva_send_strf(resp, "field");
            selva_send_strf(resp, "%s", marker->change_marker.ref_field);
        }
    }

    selva_send_strf(resp, "filter_expression");
    if (marker->filter_ctx) {
        selva_send_str(resp, "set", 3);
    } else {
        selva_send_str(resp, "unset", 5);
    }

    if (marker->fields) {
        selva_send_strf(resp, "fields");
        selva_send_strf(resp, "%s", marker->fields);
    }

    selva_send_array_end(resp);
}

void SelvaSubscriptions_ReplyWithSubscription(struct selva_server_response_out *resp, Selva_SubscriptionReply_t sp) {
    struct Selva_Subscription *sub = sp.sub;

    selva_send_array(resp, 2);
    selva_send_ll(resp, sub->sub_id);
    selva_send_ll(resp, SVector_Size(&sub->markers));
}

static int fixup_query_opts(struct Subscriptions_QueryOpts *qo, const char *base, size_t size) {
    static_assert(sizeof(qo->dir) == sizeof(int32_t));
    qo->dir = le32toh(qo->dir);

    DATA_RECORD_FIXUP_CSTRING_P(qo, base, size, dir_opt);
    return 0;
}

/*
 * Add a new marker to the subscription.
 * SUB_ID MARKER_ID traversal_type [ref_field_name] NODE_ID [fields <fieldnames \n separated>] [filter expression] [filter args...]
 */
static void SelvaSubscriptions_AddMarkerCommand(struct selva_server_response_out *resp, const void *buf, size_t len) {
    SelvaHierarchy *hierarchy = main_hierarchy;
    __auto_finalizer struct finalizer fin;
    Selva_SubscriptionId sub_id;
    Selva_SubscriptionMarkerId marker_id;
    const char *query_opts_str;
    size_t query_opts_len;
    const char *node_ids_str;
    size_t node_ids_len;
    const char *fields_str = NULL;
    size_t fields_len = 0;
    struct selva_string *filter_expr = NULL;
    struct selva_string **filter_args = NULL;
    struct Selva_SubscriptionMarker *marker;
    int err, argc;

    finalizer_init(&fin);

    argc = selva_proto_scanf(&fin, buf, len, "%" PRIsubId ", %" PRImrkId ", %.*s, %.*s, %.*s, %p, ...",
                             &sub_id,
                             &marker_id,
                             &query_opts_len, &query_opts_str,
                             &node_ids_len, &node_ids_str,
                             &fields_len, &fields_str,
                             &filter_expr,
                             &filter_args);
    if (argc < 0) {
        selva_send_errorf(resp, argc, "Failed to parse args");
        return;
    } else if (argc < 4) {
        selva_send_error_arity(resp);
        return;
    } else if (node_ids_len == 0 || node_ids_len % SELVA_NODE_ID_SIZE != 0) {
        selva_send_errorf(resp, SELVA_EINVAL, "Invalid node_id list");
        return;
    }

    marker = find_marker(hierarchy, marker_id);
    if (marker) {
        (void)upsert_sub_marker(hierarchy, sub_id, marker);
        selva_send_ll(resp, 1);
        return;
    }

    struct Subscriptions_QueryOpts query_opts;
    if (query_opts_len < sizeof(query_opts)) {
        selva_send_errorf(resp, SELVA_EINVAL, "Invalid query opts");
        return;
    } else {
        memcpy(&query_opts, query_opts_str, sizeof(query_opts));
        err = fixup_query_opts(&query_opts, query_opts_str, query_opts_len);
        if (err) {
            selva_send_errorf(resp, err, "Invalid query opts");
            return;
        }
    }

    /*
     * Parse the traversal argument.
     */
    if (!(query_opts.dir &
          (SELVA_HIERARCHY_TRAVERSAL_NONE |
           SELVA_HIERARCHY_TRAVERSAL_NODE |
           SELVA_HIERARCHY_TRAVERSAL_CHILDREN |
           SELVA_HIERARCHY_TRAVERSAL_PARENTS |
           SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS |
           SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS |
           SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD |
           SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD |
           SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION |
           SELVA_HIERARCHY_TRAVERSAL_EXPRESSION |
           SELVA_HIERARCHY_TRAVERSAL_FIELD |
           SELVA_HIERARCHY_TRAVERSAL_BFS_FIELD)
        )) {
        selva_send_errorf(resp, SELVA_EINVAL, "Traversal dir");
        return;
    }

    if (query_opts.dir & (SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD |
                          SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD |
                          SELVA_HIERARCHY_TRAVERSAL_FIELD |
                          SELVA_HIERARCHY_TRAVERSAL_BFS_FIELD) &&
        !query_opts.dir_opt_str) {
        selva_send_errorf(resp, SELVA_EINVAL, "dir opt required");
        return;
    }

    struct rpn_expression *traversal_expression = NULL;
    struct rpn_ctx *filter_ctx = NULL;
    struct rpn_expression *filter_expression = NULL;
    if (query_opts.dir & (SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION |
                          SELVA_HIERARCHY_TRAVERSAL_EXPRESSION)) {
        char input[query_opts.dir_opt_len + 1];

        memcpy(input, query_opts.dir_opt_str, query_opts.dir_opt_len);
        input[query_opts.dir_opt_len] = '\0';

        traversal_expression = rpn_compile(input);
        if (!traversal_expression) {
            err = SELVA_RPN_ECOMP;
            selva_send_errorf(resp, err, "Failed to compile the traversal expression");
            goto fail;
        }
    }

    if (fields_len == 0) {
        fields_str = NULL;
    }

    /*
     * Parse & compile the filter expression.
     * Optional.
     */
    if (argc >= 6) {
        const int nr_reg = argc - 6;
        const char *input = selva_string_to_str(filter_expr, NULL);

        filter_ctx = rpn_init(nr_reg + 1);
        filter_expression = rpn_compile(input);
        if (!filter_expression) {
            err = SELVA_RPN_ECOMP;
            selva_send_errorf(resp, err, "Failed to compile the traversal expression");
            goto fail;
        }

        /*
         * Get the filter expression arguments and set them to the registers.
         */
        for (int i = 0; i < nr_reg; i++) {
            /* reg[0] is reserved for the current nodeId */
            const size_t reg_i = i + 1;
            size_t str_len;
            const char *str;
            char *arg;

            /*
             * Args needs to be duplicated so the strings don't get freed
             * when the command returns.
             * TODO Can we just hold on those original strings?
             */
            str = selva_string_to_str(filter_args[i], &str_len);
            arg = selva_malloc(str_len);
            memcpy(arg, str, str_len);

            rpn_set_reg(filter_ctx, reg_i, arg, str_len, RPN_SET_REG_FLAG_SELVA_FREE);
        }
    }

    enum SelvaSubscriptionsMarkerFlags marker_flags = 0;

    if (query_opts.dir & (SELVA_HIERARCHY_TRAVERSAL_CHILDREN |
                          SELVA_HIERARCHY_TRAVERSAL_PARENTS)) {
        /*
         * RFE We might want to have an arg for REF flag
         * but currently it seems to be enough to support
         * it only for these specific traversal types.
         */
        marker_flags = SELVA_SUBSCRIPTION_FLAG_REF;
    }

    err = new_marker(hierarchy, marker_id, (Selva_NodeId *)node_ids_str, node_ids_len / SELVA_NODE_ID_SIZE,
                     fields_str, fields_len, marker_flags, defer_event, &marker);
    if (err) {
        if (err == SELVA_SUBSCRIPTIONS_EEXIST) {
            /* This shouldn't happen as we check for this already before. */
            if (traversal_expression) {
                rpn_destroy_expression(traversal_expression);
            }
            if (filter_ctx) {
                rpn_destroy(filter_ctx);
                rpn_destroy_expression(filter_expression);
            }

            selva_send_ll(resp, 1);
            return;
        }

        selva_send_errorf(resp, err, "Failed to create a subscription");
        goto fail;
    }

    (void)upsert_sub_marker(hierarchy, sub_id, marker);
    marker_set_dir(marker, query_opts.dir);

    if (traversal_expression) {
        marker_set_traversal_expression(marker, traversal_expression);
    } else if (query_opts.dir_opt_str) {
        marker_set_ref_field(marker, query_opts.dir_opt_str, query_opts.dir_opt_len);
    }

    marker_set_filter(marker, filter_ctx, filter_expression);

    (void)refresh_marker(hierarchy, marker);
    selva_send_ll(resp, 1);
    return;
fail:
    if (traversal_expression) {
        rpn_destroy_expression(traversal_expression);
    }
    if (filter_ctx) {
        rpn_destroy(filter_ctx);
        rpn_destroy_expression(filter_expression);
    }
}

/*
 * SUB_ID MARKER_ID ALIAS_NAME
 */
static void SelvaSubscriptions_AddAliasCommand(struct selva_server_response_out *resp, const void *buf, size_t len) {
    SelvaHierarchy *hierarchy = main_hierarchy;
    __auto_finalizer struct finalizer fin;
    Selva_SubscriptionId sub_id;
    Selva_SubscriptionMarkerId marker_id;
    struct selva_string *alias_name;
    int argc;
    int err;

    finalizer_init(&fin);

    argc = selva_proto_scanf(&fin, buf, len, "%" PRIsubId ", %" PRImrkId ", %p",
                             &sub_id,
                             &marker_id,
                             &alias_name);
    if (argc < 0) {
        selva_send_errorf(resp, argc, "Failed to parse args");
        return;
    } else if (argc != 3) {
        selva_send_error_arity(resp);
        return;
    }

    /*
     * Resolve the node_id as we want to apply the marker
     * on the node the alias is pointing to.
     */
    Selva_NodeId node_id;
    struct selva_string *aliases[] = { alias_name };
    err = SelvaResolve_NodeId(hierarchy, aliases, num_elem(aliases), node_id);
    if (err < 0) {
        selva_send_error(resp, err, NULL, 0);
        return;
    }

    err = SelvaSubscriptions_AddAliasMarker(hierarchy, sub_id, marker_id, alias_name, node_id);
    if (err) {
        selva_send_error(resp, err, NULL, 0);
    } else {
        selva_send_ll(resp, 1);
    }
}

/**
 * Add a trigger marker.
 * SUBSCRIPTIONS.ADDTRIGGER SUB_ID MARKER_ID EVENT_TYPE [filter expression] [filter args...]
 */
static void SelvaSubscriptions_AddTriggerCommand(struct selva_server_response_out *resp, const void *buf, size_t len) {
    SelvaHierarchy *hierarchy = main_hierarchy;
    __auto_finalizer struct finalizer fin;
    Selva_SubscriptionId sub_id;
    Selva_SubscriptionMarkerId marker_id;
    enum Selva_SubscriptionTriggerType event_type = SELVA_SUBSCRIPTION_TRIGGER_TYPE_NONE;
    struct selva_string *filter_expr = NULL;
    struct selva_string **filter_args = NULL;
    struct Selva_SubscriptionMarker *marker;
    int err, argc;

    finalizer_init(&fin);

    argc = selva_proto_scanf(&fin, buf, len, "%" PRIsubId ", %" PRImrkId ", %d, %p, ...",
                             &sub_id,
                             &marker_id,
                             &event_type,
                             &filter_expr,
                             &filter_args);
    if (argc < 0) {
        selva_send_errorf(resp, argc, "Failed to parse args");
        return;
    } else if (argc < 3) {
        selva_send_error_arity(resp);
        return;
    }

    if (event_type != SELVA_SUBSCRIPTION_TRIGGER_TYPE_CREATED &&
        event_type != SELVA_SUBSCRIPTION_TRIGGER_TYPE_UPDATED &&
        event_type != SELVA_SUBSCRIPTION_TRIGGER_TYPE_DELETED) {
        selva_send_errorf(resp, SELVA_EINVAL, "Event type");
        return;
    }

    marker = find_marker(hierarchy, marker_id);
    if (marker) {
        (void)upsert_sub_marker(hierarchy, sub_id, marker);
        selva_send_ll(resp, 1);
        return;
    }

    /*
     * Parse & compile the filter expression.
     * Optional.
     */
    struct rpn_ctx *filter_ctx = NULL;
    struct rpn_expression *filter_expression = NULL;
    if (argc >= 4) {
        const int nr_reg = argc - 4;
        const char *input = selva_string_to_str(filter_expr, NULL);

        filter_ctx = rpn_init(nr_reg);
        filter_expression = rpn_compile(input);
        if (!filter_expression) {
            err = SELVA_RPN_ECOMP;
            selva_send_errorf(resp, err, "Failed to compile a filter expression");
            goto out;
        }

        /*
         * Get the filter expression arguments and set them to the registers.
         */
        for (int i = 0; i < nr_reg; i++) {
            /* reg[0] is reserved for the current nodeId */
            const size_t reg_i = i + 1;
            size_t str_len;
            const char *str;
            char *arg;

            /*
             * Args needs to be duplicated so the strings don't get freed
             * when the command returns.
             */
            str = selva_string_to_str(filter_args[i], &str_len);
            arg = selva_malloc(str_len);
            memcpy(arg, str, str_len);

            rpn_set_reg(filter_ctx, reg_i, arg, str_len, RPN_SET_REG_FLAG_SELVA_FREE);
        }
    }

    const enum SelvaSubscriptionsMarkerFlags marker_flags = SELVA_SUBSCRIPTION_FLAG_DETACH | SELVA_SUBSCRIPTION_FLAG_TRIGGER;

    /*
     * Trigger never checks fields.
     */
    err = new_marker(hierarchy, marker_id, NULL, 0, NULL, 0, marker_flags, defer_event, &marker);
    if (err) {
        if (err == SELVA_SUBSCRIPTIONS_EEXIST) {
            /* This shouldn't happen as we check for this already before. */
            rpn_destroy(filter_ctx);
            rpn_destroy_expression(filter_expression);

            selva_send_ll(resp, 1);
            return;
        }

        selva_send_errorf(resp, err, "Failed to create a subscription");
        goto out;
    }

    err = upsert_sub_marker(hierarchy, sub_id, marker);
    if (err) {
        selva_send_errorf(resp, err, "Failed to create a subscription");
        goto out;
    }
    marker_set_trigger(marker, event_type);
    marker_set_filter(marker, filter_ctx, filter_expression);

out:
    if (err) {
        if (filter_ctx) {
            rpn_destroy(filter_ctx);
            rpn_destroy_expression(filter_expression);
        }
    } else {
        selva_send_ll(resp, 1);
    }
}

/*
 * SUBSCRIPTIONS.refresh SUB_ID
 */
static void SelvaSubscriptions_RefreshCommand(struct selva_server_response_out *resp, const void *buf, size_t len) {
    SELVA_TRACE_BEGIN_AUTO(cmd_subscriptions_refresh);
    SelvaHierarchy *hierarchy = main_hierarchy;
    Selva_SubscriptionId sub_id;
    int argc, err;

    argc = selva_proto_scanf(NULL, buf, len, "%" PRIsubId, &sub_id);
    if (argc != 1) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    struct Selva_Subscription *sub;
    sub = find_sub(hierarchy, sub_id);
    if (!sub) {
        selva_send_error(resp, SELVA_SUBSCRIPTIONS_ENOENT, NULL, 0);
        return;
    }

    err = refresh_subscription(hierarchy, sub);
    if (err) {
        selva_send_error(resp, err, NULL, 0);
    } else {
        selva_send_ll(resp, 1);
    }
}

/*
 * SUBSCRIPTIONS.refreshMarker MRK_ID
 */
static void SelvaSubscriptions_RefreshMarkerCommand(struct selva_server_response_out *resp, const void *buf, size_t len) {
    SELVA_TRACE_BEGIN_AUTO(cmd_subscriptions_refresh_marker);
    SelvaHierarchy *hierarchy = main_hierarchy;
    Selva_SubscriptionMarkerId marker_id;
    int argc, err;

    argc = selva_proto_scanf(NULL, buf, len, "%" PRImrkId, &marker_id);
    if (argc != 1) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    struct Selva_SubscriptionMarker *marker;
    marker = find_marker(hierarchy, marker_id);
    if (!marker) {
        selva_send_error(resp, SELVA_SUBSCRIPTIONS_ENOENT, NULL, 0);
        return;
    }

    err = refresh_marker(hierarchy, marker);
    if (err) {
        selva_send_error(resp, err, NULL, 0);
    } else {
        selva_send_ll(resp, 1);
    }
}

/**
 * List all subscriptions.
 */
static void SelvaSubscriptions_ListCommand(struct selva_server_response_out *resp, const void *buf __unused, size_t len) {
    SelvaHierarchy *hierarchy = main_hierarchy;
    enum {
        SUBSCRIPTIONS_LIST_CMD_SUBS = 0,
        SUBSCRIPTIONS_LIST_CMD_MRKS = 1,
        SUBSCRIPTIONS_LIST_CMD_MISSING = 2,
    } list_type = SUBSCRIPTIONS_LIST_CMD_SUBS;
    int argc;

    static_assert(sizeof(list_type) == sizeof(int));

    argc = selva_proto_scanf(NULL, buf, len, "%d", &list_type);
    if (argc != 0 && argc != 1) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    if (list_type == SUBSCRIPTIONS_LIST_CMD_SUBS) {
        struct Selva_Subscription *sub;

        selva_send_array(resp, -1);

        RB_FOREACH(sub, hierarchy_subscriptions_tree, &hierarchy->subs.subs_head) {
            SelvaSubscriptions_ReplyWithSubscription(resp, sub);
        }

        selva_send_array_end(resp);
    } else if (list_type == SUBSCRIPTIONS_LIST_CMD_MRKS) {
        struct Selva_SubscriptionMarker *marker;

        selva_send_array(resp, -1);

        RB_FOREACH(marker, hierarchy_subscription_markers_tree, &hierarchy->subs.mrks_head) {
            selva_send_array(resp, 2);
            selva_send_ll(resp, marker->marker_id);
            selva_send_ll(resp, SVector_Size(&marker->subs));
        }

        selva_send_array_end(resp);
    } else if (list_type == SUBSCRIPTIONS_LIST_CMD_MISSING) {
        struct SelvaObject *missing = GET_STATIC_SELVA_OBJECT(&hierarchy->subs.missing);
        int err;

        err = SelvaObject_ReplyWithObject(resp, NULL, missing, NULL, 0);
        if (err) {
            selva_send_error(resp, err, NULL, 0);
        }
    } else {
        selva_send_errorf(resp, SELVA_SUBSCRIPTIONS_EINVAL, "Invalid list type");
    }
}

static SVector *debug_get_sub_markers(SelvaHierarchy *hierarchy, const char *id_str, size_t id_len)
{
    Selva_SubscriptionId sub_id = strntol(id_str, id_len, NULL);
    struct Selva_Subscription *sub;

    sub = find_sub(hierarchy, sub_id);
    return sub ? &sub->markers : NULL;
}

static SVector *debug_get_node_markers(SelvaHierarchy *hierarchy, const char *id_str, size_t id_len)
{
    Selva_NodeId node_id;
    struct SelvaHierarchyMetadata *metadata;

    if (id_len > SELVA_NODE_ID_SIZE) {
        return NULL;
    }

    memset(node_id, '\0', SELVA_NODE_ID_SIZE);
    memcpy(node_id, id_str, id_len);

    metadata = SelvaHierarchy_GetNodeMetadata(hierarchy, node_id);
    return metadata ? &metadata->sub_markers.vec : NULL;
}

static struct Selva_SubscriptionMarker *debug_get_marker(SelvaHierarchy *hierarchy, const char *id_str, size_t id_len)
{
    Selva_SubscriptionId marker_id = strntol(id_str, id_len, NULL);

    return find_marker(hierarchy, marker_id);
}

/*
 * KEY SUB_ID
 */
static void SelvaSubscriptions_DebugCommand(struct selva_server_response_out *resp, const void *buf, size_t len) {
    SelvaHierarchy *hierarchy = main_hierarchy;
    const char *id_str;
    size_t id_len;
    int argc;

    argc = selva_proto_scanf(NULL, buf, len, "%.*s", &id_len, &id_str);
    if (argc != 1) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    SVector *markers = NULL;

    if (id_len == (sizeof("detached") - 1) && !memcmp("detached", id_str, id_len)) {
        markers = &hierarchy->subs.detached_markers.vec;
    }
    if (!markers) {
        markers = debug_get_sub_markers(hierarchy, id_str, id_len);
    }
    if (!markers) {
        markers = debug_get_node_markers(hierarchy, id_str, id_len);
    }
    if (markers) {
        struct SVectorIterator it;
        struct Selva_SubscriptionMarker *marker;

        selva_send_array(resp, -1);
        SVector_ForeachBegin(&it, markers);
        while ((marker = SVector_Foreach(&it))) {
            SelvaSubscriptions_ReplyWithMarker(resp, marker);
        }
        selva_send_array_end(resp);
        return;
    } else {
        struct Selva_SubscriptionMarker *marker;

        marker = debug_get_marker(hierarchy, id_str, id_len);
        if (marker) {
            selva_send_array(resp, 1);
            SelvaSubscriptions_ReplyWithMarker(resp, marker);
        }
        return;
    }

    selva_send_error(resp, SELVA_SUBSCRIPTIONS_ENOENT, NULL, 0);
}

/*
 * KEY SUB_ID
 */
static void SelvaSubscriptions_DelCommand(struct selva_server_response_out *resp, const void *buf, size_t len) {
    SelvaHierarchy *hierarchy = main_hierarchy;
    Selva_SubscriptionId sub_id;
    struct Selva_Subscription *sub;
    int argc;

    argc = selva_proto_scanf(NULL, buf, len, "%" PRIsubId, &sub_id);
    if (argc != 1) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    sub = find_sub(hierarchy, sub_id);
    if (!sub) {
        selva_send_ll(resp, 0);
        return;
    }

    destroy_sub(hierarchy, sub);

    selva_send_ll(resp, 1);
}

/*
 * KEY SUB_ID MARKER_ID
 */
static void SelvaSubscriptions_DelMarkerCommand(struct selva_server_response_out *resp, const void *buf, size_t len) {
    SelvaHierarchy *hierarchy = main_hierarchy;
    Selva_SubscriptionId sub_id;
    Selva_SubscriptionMarkerId marker_id;
    int argc;
    int err;

    argc = selva_proto_scanf(NULL, buf, len, "%" PRIsubId ", %" PRImrkId,
                             &sub_id,
                             &marker_id);
    if (argc != 2) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    struct Selva_Subscription *sub;
    sub = find_sub(hierarchy, sub_id);
    if (!sub) {
        selva_send_ll(resp, 0);
        return;
    }

    err = delete_marker(hierarchy, sub, marker_id);
    if (err) {
        selva_send_error(resp, err, NULL, 0);
        return;
    }

    selva_send_ll(resp, 1);
}

static int Subscriptions_OnLoad(void) {
    /*
     * Register commands.
     * All commands are "readonly" because they don't change the
     * observed or serialized key values in any way. This is important
     * because we need to be able to create markers on readonly replicas.
     */
    selva_mk_command(CMD_ID_SUBSCRIPTIONS_ADD_MARKER, SELVA_CMD_MODE_PURE, "subscriptions.addMarker", SelvaSubscriptions_AddMarkerCommand);
    selva_mk_command(CMD_ID_SUBSCRIPTIONS_ADD_ALIAS, SELVA_CMD_MODE_PURE, "subscriptions.addAlias", SelvaSubscriptions_AddAliasCommand);
    selva_mk_command(CMD_ID_SUBSCRIPTIONS_ADD_TRIGGER, SELVA_CMD_MODE_PURE, "subscriptions.addTrigger", SelvaSubscriptions_AddTriggerCommand);
    selva_mk_command(CMD_ID_SUBSCRIPTIONS_REFRESH, SELVA_CMD_MODE_PURE, "subscriptions.refresh", SelvaSubscriptions_RefreshCommand);
    selva_mk_command(CMD_ID_SUBSCRIPTIONS_REFRESH_MARKER, SELVA_CMD_MODE_PURE, "subscriptions.refreshMarker", SelvaSubscriptions_RefreshMarkerCommand);
    selva_mk_command(CMD_ID_SUBSCRIPTIONS_LIST, SELVA_CMD_MODE_PURE, "subscriptions.list", SelvaSubscriptions_ListCommand);
    selva_mk_command(CMD_ID_SUBSCRIPTIONS_DEBUG, SELVA_CMD_MODE_PURE, "subscriptions.debug", SelvaSubscriptions_DebugCommand);
    selva_mk_command(CMD_ID_SUBSCRIPTIONS_DEL, SELVA_CMD_MODE_PURE, "subscriptions.del", SelvaSubscriptions_DelCommand);
    selva_mk_command(CMD_ID_SUBSCRIPTIONS_DELMARKER, SELVA_CMD_MODE_PURE, "subscriptions.delMarker", SelvaSubscriptions_DelMarkerCommand);

    return 0;
}
SELVA_ONLOAD(Subscriptions_OnLoad);
