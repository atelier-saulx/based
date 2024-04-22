/*
 * Copyright (c) 2023-2024 SAULX
 *
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <sys/types.h>
#include "selva_db.h"
#include "selva_object.h"
#include "hierarchy.h"
#include "subscriptions.h"
#include "selva_object.h"

void SelvaSubscriptions_InitHierarchy(struct SelvaHierarchy *hierarchy) {
    struct SelvaSubscriptions_DeferredEvents *def = &hierarchy->subs.deferred_events;

    SelvaObject_Init(hierarchy->subs.missing._obj_data, 0);
    SVector_Init(&def->marker_events, 2, NULL);
    SVector_Init(&hierarchy->subs.detached_markers.vec, 0, NULL);
    hierarchy->subs.detached_markers.flags_filter = 0;
}

void SelvaSubscriptions_DestroyAll(struct SelvaHierarchy *hierarchy) {
    struct SelvaSubscriptions_DeferredEvents *def = &hierarchy->subs.deferred_events;

    SVector_Destroy(&def->marker_events);
    SelvaObject_Clear(GET_STATIC_SELVA_OBJECT(&hierarchy->subs.missing), NULL);
}

void SelvaSubscriptions_ClearAllMarkers(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node) {
    return;
}

int SelvaSubscriptions_hasActiveMarkers(const struct SelvaHierarchyMetadata *node_metadata) {
    return 0;
}

void SelvaSubscriptions_InheritEdge(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *src_node,
        struct SelvaHierarchyNode *dst_node,
        const char *field_str,
        size_t field_len) {
    return;
}

int SelvaSubscriptions_DeleteMarker(
        struct SelvaHierarchy *hierarchy,
        const Selva_SubscriptionId sub_id,
        Selva_SubscriptionMarkerId marker_id) {
    return 0;
}

void SelvaSubscriptions_DeferMissingAccessorEvents(struct SelvaHierarchy *hierarchy, const char *id_str, size_t id_len) {
    return;
}

void SelvaSubscriptions_DeferFieldChangeEvents(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len) {
    return;
}

void SelvaSubscriptions_DeferTriggerEvents(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        enum Selva_SubscriptionTriggerType event_type) {
    return;
}

void SelvaSubscriptions_RefreshSubsByMarker(
        struct SelvaHierarchy *hierarchy,
        const SVector *markers) {
    return;
}

void SelvaSubscriptions_SendDeferredEvents(struct SelvaHierarchy *hierarchy) {
    return;
}
