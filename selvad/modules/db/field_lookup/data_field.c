/*
 * Copyright (c) 2023-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include <sys/types.h>
#include "util/ptag.h"
#include "util/selva_string.h"
#include "selva_error.h"
#include "selva_db.h"
#include "selva_object.h"
#include "traversal.h"
#include "hierarchy.h"
#include "schema.h"
#include "edge.h"
#include "field_lookup.h"

static int get_from_edge_field(
        const struct selva_string *lang,
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        struct SelvaObjectAny *any)
{
    struct SelvaHierarchyMetadata *metadata = SelvaHierarchy_GetNodeMetadataByPtr(node);
    struct SelvaObject *edges = metadata->edge_fields.edges;
    void *p;

    if (!edges) {
        return SELVA_ENOENT;
    }

    const int off = SelvaObject_GetPointerPartialMatchStr(edges, field_str, field_len, &p);
    struct EdgeField *edge_field = p;
    if (off == SELVA_EINTYPE) {
        return SELVA_EINTYPE;
    } else if (off < 0) {
        return off; /* Probably SELVA_ENOENT */
    } else if (off == 0) {
        /*
         * The field name leads to an edge field (->node(s)),
         * not to a single data field.
         */
        return SELVA_EINTYPE;
    } else if (!edge_field) {
        return SELVA_ENOENT;
    } else {
        const char *next_field_str = field_str + off;
        const size_t next_field_len = field_len - off;
        struct SelvaHierarchyNode *next_node;
        int err;

        err = Edge_DerefSingleRef(edge_field, &next_node);
        if (err) {
            return err;
        }

        if (Selva_IsEdgeMetaField(next_field_str, next_field_len)) {
            Selva_NodeId next_node_id;
            struct SelvaObject *edge_metadata;
            int err;

            SelvaHierarchy_GetNodeId(next_node_id, next_node);
            err = Edge_GetFieldEdgeMetadata(edge_field, next_node_id, false, &edge_metadata);
            if (!err && edge_metadata) {
                Selva_NodeId next_node_id;
                size_t meta_key_len;
                const char *meta_key_str = Selva_GetEdgeMetaKey(next_field_str, next_field_len, &meta_key_len);
                struct SelvaObject *edge_metadata;

                SelvaHierarchy_GetNodeId(next_node_id, next_node);
                err = SelvaObject_GetObjectStr(edge_field->metadata, next_node_id, SELVA_NODE_ID_SIZE, &edge_metadata);
                if (err) {
                    return err;
                }

                return SelvaObject_GetAnyLangStr(edge_metadata, lang, meta_key_str, meta_key_len, any);
            }
            return SELVA_ENOENT;
        } else {
            return field_lookup_data_field(lang, NULL, next_node, next_field_str, next_field_len, any);
        }
    }
}

/**
 * @param field_str must be verified to start with SELVA_EDGE_META_FIELD.
 */
static int get_top_level_edge_meta(
        const struct selva_string *lang,
        struct SelvaObject *edge_metadata,
        const char *field_str,
        size_t field_len,
        struct SelvaObjectAny *any)
{
    size_t meta_key_len;
    const char *meta_key_str = Selva_GetEdgeMetaKey(field_str, field_len, &meta_key_len);

    if (field_len == sizeof(SELVA_EDGE_META_FIELD) - 1) {
        /* All fields. */
        *any = (struct SelvaObjectAny){
            .type = SELVA_OBJECT_OBJECT,
            .obj = edge_metadata,
        };

        return 0;
    } else if (field_str[sizeof(SELVA_EDGE_META_FIELD) - 1] == '.') {
        /* Specific field. */
        return SelvaObject_GetAnyLangStr(edge_metadata, lang, meta_key_str, meta_key_len, any);
    } /* Otherwise the field name was something else. */

    /* field not found here. */
    return SELVA_ENOENT;
}

int field_lookup_data_field(
        const struct selva_string *lang,
        const struct SelvaHierarchyTraversalMetadata *traversal_metadata,
        struct SelvaHierarchyNode *node,
        const char *field_str,
        size_t field_len,
        struct SelvaObjectAny *any)
{
    int err;

    if (field_len > 1 && field_str[0] == '$' &&
        traversal_metadata) {
        if (!strncmp(field_str, SELVA_EDGE_META_FIELD, sizeof(SELVA_EDGE_META_FIELD) - 1)) {
            err = SELVA_ENOENT;

            if (traversal_metadata->origin_field_svec_tagp) {
                struct SelvaObject *edge_metadata;

                edge_metadata = SelvaHierarchy_GetEdgeMetadataByTraversal(traversal_metadata, node);
                if (edge_metadata) {
                    err = get_top_level_edge_meta(lang, edge_metadata, field_str, field_len, any);
                }
            }
            return err;
        } else if (field_len == sizeof(SELVA_DEPTH_FIELD) - 1 &&
                   !memcmp(field_str, SELVA_DEPTH_FIELD, sizeof(SELVA_DEPTH_FIELD) - 1)) {
            *any = (struct SelvaObjectAny){
                .type = SELVA_OBJECT_LONGLONG,
                .ll = traversal_metadata->depth,
            };
            return 0;
        } /* Try if it's something else... */
    }

    err = get_from_edge_field(lang, node, field_str, field_len, any);
    if (err == SELVA_ENOENT) {
        struct SelvaObject *obj;

        obj = SelvaHierarchy_GetNodeObject(node);
        err = SelvaObject_GetAnyLangStr(obj, lang, field_str, field_len, any);
    }

    return err;
}
