/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#define _GNU_SOURCE
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/types.h>
#include "util/cstrings.h"
#include "util/finalizer.h"
#include "util/ptag.h"
#include "util/selva_string.h"
#include "util/svector.h"
#include "selva_error.h"
#include "selva_proto.h"
#include "selva_log.h"
#include "selva_server.h"
#include "selva_db.h"
#include "parsers.h"
#include "hierarchy.h"
#include "../field_names.h"
#include "../find.h"
#include "find_send.h"

static int send_node_field(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct selva_string *lang,
        SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        struct SelvaObject *obj,
        const char *field_prefix_str,
        size_t field_prefix_len,
        const char *field_str,
        size_t field_len,
        struct selva_string *excluded_fields);
static void send_all_node_data_fields(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct selva_string *lang,
        SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        const char *field_prefix_str,
        size_t field_prefix_len,
        struct selva_string *excluded_fields);

static inline int is_alias_name(const char *name, size_t len)
{
    return (len > 0 && name[len - 1] == STRING_SET_ALIAS);
}

static int is_excluded(struct selva_string *excluded_fields, const char *full_field_name_str, size_t full_field_name_len)
{
    if (excluded_fields) {
        TO_STR(excluded_fields);

        /*
         * Excluding the `id` field is not allowed but we drop it already from
         * the list in string_set_list_add(). It's not allowed because the
         * client must be able to find the schema for whatever was returned by
         * the server.
         */

        if (stringlist_search(excluded_fields_str, full_field_name_str, full_field_name_len, '*')) {
            /*
             * This field should be excluded from the results.
             */
            return 1;
        }
    }

    return 0;
}

static int send_obj_field(
        struct selva_server_response_out *resp,
        struct selva_string *lang,
        struct SelvaObject *obj,
        const char *field_prefix_str,
        size_t field_prefix_len,
        const char *field_str,
        size_t field_len)
{
    /*
     * Check if we have a wildcard in the middle of the field name
     * and process it.
     */
    if (containswildcard(field_str, field_len)) {
        long resp_count = 0;
        int err;

        /* RFE Should we send the possible prefix? */
        if (field_prefix_str && field_prefix_len) {
            SELVA_LOG(SELVA_LOGL_WARN, "field_prefix ignored");
#if 0
            __builtin_trap();
#endif
        }

        err = SelvaObject_ReplyWithWildcardStr(resp, lang, obj, field_str, field_len, &resp_count, -1, 0);
        if (err && err != SELVA_ENOENT) {
            SELVA_LOG(SELVA_LOGL_ERR, "Failed to send the wildcard field \"%.*s\": %s",
                      (int)field_len, field_str,
                      selva_strerror(err));
        }

        return (int)(resp_count / 2);
    } else {
        int err;

        /*
         * Finally check if the field name is a key on the node object.
         */

        if (endswithwildcard(field_str, field_len)) {
            field_len -= 2;
        }

        if (field_len && SelvaObject_ExistsStr(obj, field_str, field_len)) {
            /* Field didn't exist in the node. */
            return 0;
        }

        /*
         * Send the reply.
         */
        selva_send_strf(resp, "%.*s%.*s", (int)field_prefix_len, field_prefix_str, (int)field_len, field_str);
        err = SelvaObject_ReplyWithObjectStr(resp, lang, obj, field_str, field_len, 0);
        if (err) {
            SELVA_LOG(SELVA_LOGL_ERR, "Failed to send the field \"%.*s\": \"%s\"",
                      (int)field_len, field_str,
                      selva_strerror(err));
            selva_send_null(resp);
        }

        return 1;
    }
}

/**
 * Send a field from edge metadata.
 * meta_key must not include the SELVA_EDGE_META_FIELD part.
 * @param field_prefix_str only used for aliasing
 */
static int send_edge_meta_field(
                struct selva_server_response_out *resp,
                struct selva_string *lang,
                struct SelvaObject *edge_metadata,
                const char *field_prefix_str,
                size_t field_prefix_len,
                const char *meta_key_str,
                size_t meta_key_len)
{
    selva_send_str(resp, SELVA_EDGE_META_FIELD, sizeof(SELVA_EDGE_META_FIELD) - 1);
    selva_send_array(resp, 2);

    return send_obj_field(resp, lang, edge_metadata, field_prefix_str, field_prefix_len, meta_key_str, meta_key_len);
}

/**
 * Send all edge metadata fields.
 */
static int send_edge_meta_fields(
                struct selva_server_response_out *resp,
                struct selva_string *lang,
                struct SelvaObject *edge_metadata,
                Selva_NodeId dst_node_id,
                struct selva_string *excluded_fields)
{
    SelvaObject_Iterator *obj_it;
    const char *meta_key_str;

    selva_send_str(resp, SELVA_EDGE_META_FIELD, sizeof(SELVA_EDGE_META_FIELD) - 1);
    selva_send_array(resp, -1);

    obj_it = SelvaObject_ForeachBegin(edge_metadata);
    while ((meta_key_str = SelvaObject_ForeachKey(edge_metadata, &obj_it))) {
        size_t meta_key_len = strlen(meta_key_str);
        size_t full_field_name_len = sizeof(SELVA_EDGE_META_FIELD) + meta_key_len;
        char full_field_name_str[full_field_name_len + 1];

        snprintf(full_field_name_str, full_field_name_len + 1, "%s.%.s", SELVA_EDGE_META_FIELD, meta_key_str);
        if (!is_excluded(excluded_fields, full_field_name_str, full_field_name_len)) {
            int err;

            selva_send_str(resp, meta_key_str, meta_key_len);
            err = SelvaObject_ReplyWithObjectStr(resp, lang, edge_metadata, meta_key_str, meta_key_len, 0);
            if (err) {
                SELVA_LOG(SELVA_LOGL_ERR, "Failed to send the edge meta field (%.*s) for node_id: \"%.*s\" err: \"%s\"",
                          (int)meta_key_len, meta_key_str,
                          (int)SELVA_NODE_ID_SIZE, dst_node_id,
                          selva_strerror(err));
                selva_send_null(resp);
            }
        }
    }

    selva_send_array_end(resp);

    return 1;
}

static int send_edge_field(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct selva_string *lang,
        SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        const char *field_prefix_str,
        size_t field_prefix_len,
        const char *field_str,
        size_t field_len,
        struct selva_string *excluded_fields)
{
    struct SelvaHierarchyMetadata *metadata = &node->metadata;
    struct SelvaObject *edges = metadata->edge_fields.edges;
    struct EdgeField *edge_field;
    void *p;

    if (!edges) {
        return SELVA_ENOENT;
    }

    if (containswildcard(field_str, field_len)) {
        long resp_count = 0;
        int err;

        err = SelvaObject_ReplyWithWildcardStr(resp, NULL, edges, field_str, field_len, &resp_count, 0, SELVA_OBJECT_REPLY_ANY_OBJ_FLAG);
        if (err && err != SELVA_ENOENT) {
            Selva_NodeId node_id;

            SELVA_LOG(SELVA_LOGL_ERR, "Sending edge fields with a wildcard \"%.*s\" of %.*s failed: %s",
                      (int)field_len, field_str,
                      (int)SELVA_NODE_ID_SIZE, SelvaHierarchy_GetNodeId(node_id, node),
                      selva_strerror(err));
        }
        return (int)(resp_count / 2);
    }

    const int off = SelvaObject_GetPointerPartialMatchStr(edges, field_str, field_len, &p);
    edge_field = p;
    if (off == SELVA_EINTYPE) {
        /*
         * Try if it's an object containing multiple edge fields.
         */
        struct SelvaObject *next_obj;
        SelvaObject_Iterator *it;
        const char *key;
        int err, res = 0;

        if (iswildcard(field_str, field_len)) {
            field_len = 0;
        }

        err = SelvaObject_GetObjectStr(edges, field_str, field_len, &next_obj);
        if (err || !next_obj) {
            /* Fail if type wasn't SELVA_OBJECT_OBJECT */
            return off;
        }

        it = SelvaObject_ForeachBegin(next_obj);
        while ((key = SelvaObject_ForeachKey(edges, &it))) {
            const size_t next_field_len = field_len + 1 + strlen(key);
            char next_field_str[next_field_len + 1];
            int err;

            snprintf(next_field_str, next_field_len + 1, "%.*s.%s", (int)field_len, field_str, key);
            err = send_edge_field(fin, resp, lang, hierarchy, node, field_prefix_str, field_prefix_len, next_field_str, next_field_len, excluded_fields);
            if (err >= 0) {
                res += err;
            }
            /*
             * Ignore any errors. If an error has occurred it's already logged,
             * at this point and we don't need to do anything.
             * Unfortunately the client won't be informed directly.
             */
        }

        return res;
    } else if (off < 0) {
        /*
         * An error occurred.
         */
        return off;
    } else if (!edge_field) {
        return SELVA_ENOENT;
    } else if (off == 0) {
        size_t act_field_len;
        const char *act_field_str = make_full_field_name_str(fin, field_prefix_str, field_prefix_len, field_str, field_len, &act_field_len);

        selva_send_str(resp, act_field_str, act_field_len);
        replyWithEdgeField(resp, edge_field);
        return 1;
    } else {
        /*
         * Send fields from the dst_node.
         *
         * Note: The dst_node might be the same as node but this shouldn't cause
         * an infinite loop or any other issues as we'll be always cutting the
         * field name shorter and thus the recursion should eventually stop.
         */
        const size_t nr_arcs = Edge_GetFieldLength(edge_field);

        /*
         * RFE Historically we have been sending ENOENT but is that a good practice?
         */
        if (nr_arcs == 0) {
            return SELVA_ENOENT;
        }

        selva_send_str(resp, field_str, off - 1);
        selva_send_array(resp, nr_arcs);

        const char *next_field_str = field_str + off;
        const size_t next_field_len = field_len - off;

        const char *next_prefix_str;
        size_t next_prefix_len;

        if (field_prefix_str) {
            if (is_alias_name(field_prefix_str, field_prefix_len)) {
                /*
                 * Don't change the prefix if there is an alias.
                 */
                next_prefix_str = field_prefix_str;
                next_prefix_len = field_prefix_len;
            } else {
                const char *s = memchr(field_str, '.', field_len);
                const int n = s ? (int)(s - field_str) + 1 : (int)field_len;
                struct selva_string *next_prefix;

                next_prefix = selva_string_createf("%.*s%.*s", (int)field_prefix_len, field_prefix_str, n, field_str);
                finalizer_add(fin, next_prefix, selva_string_free);
                next_prefix_str = selva_string_to_str(next_prefix, &next_prefix_len);
            }
        } else {
            /*
             * Don't add prefix because we are sending multiple nested objects
             * in an array.
             */
            next_prefix_str = NULL;
            next_prefix_len = 0;
        }

        /*
         * Prepare a new excluded fields list.
         */
        struct selva_string *new_excluded_fields = NULL;
        if (excluded_fields) {
            new_excluded_fields = deprefix_excluded_fields(
                    fin, excluded_fields,
                    field_str, field_len,
                    next_field_str, next_field_len);
        }

        struct EdgeFieldIterator it;
        struct SelvaHierarchyNode *dst_node;
        const int is_wildcard = iswildcard(next_field_str, next_field_len);

        Edge_ForeachBegin(&it, edge_field);
        while ((dst_node = Edge_Foreach(&it))) {
            Selva_NodeId dst_node_id;

            SelvaHierarchy_GetNodeId(dst_node_id, dst_node);

            selva_send_array(resp, -1);

            /*
             * Id field is always sent to provide a context for typeCast.
             */
            selva_send_str(resp, SELVA_ID_FIELD, sizeof(SELVA_ID_FIELD) - 1);
            selva_send_str(resp, dst_node_id, Selva_NodeIdLen(dst_node_id));

            if (is_wildcard) {
                if (next_prefix_str) {
                    selva_send_array(resp, 2);
                    selva_send_str(resp, next_prefix_str, next_prefix_len - 1);
                    selva_send_array(resp, -1);
                }

                send_all_node_data_fields(fin, resp, lang, hierarchy, dst_node, NULL, 0, new_excluded_fields);
                if (next_prefix_str) {
                    selva_send_array_end(resp);
                }
            } else if (Selva_IsEdgeMetaField(next_field_str, next_field_len)) {
                size_t meta_key_len;
                const char *meta_key_str = Selva_GetEdgeMetaKey(next_field_str, next_field_len, &meta_key_len);
                struct SelvaObject *edge_metadata;
                int err;

	            err = Edge_GetFieldEdgeMetadata(edge_field, dst_node_id, false, &edge_metadata);
                if (!err && edge_metadata) {
                    /*
                     * $edgeMeta pseudo field handling
                     * TODO This doesn't currently work over multiple edge fields.
                     */
                     (void)send_edge_meta_field(
                             resp, lang,
                             edge_metadata,
                             next_prefix_str, next_prefix_len,
                             meta_key_str, meta_key_len);
                }
            } else {
                struct SelvaObject *dst_obj = SelvaHierarchy_GetNodeObject(dst_node);

                (void)send_node_field(fin, resp, lang, hierarchy, dst_node, dst_obj,
                                      next_prefix_str, next_prefix_len,
                                      next_field_str, next_field_len,
                                      new_excluded_fields);
            }

            selva_send_array_end(resp);
        }

        return 1;
    }
    /* NOT REACHED */
}

/**
 * Send a node field to the client.
 * @param excluded_fields can be set if certain field names should be excluded from the response; Otherwise NULL.
 * @returns < 0 an error; = 0 nothing sent; 1 = field value sent
 */
static int send_node_field(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct selva_string *lang,
        SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        struct SelvaObject *obj,
        const char *field_prefix_str,
        size_t field_prefix_len,
        const char *field_str,
        size_t field_len,
        struct selva_string *excluded_fields)
{
    Selva_NodeId nodeId;
    const char *full_field_name_str;
    size_t full_field_name_len;
    int err;
    int res = 0;

    SelvaHierarchy_GetNodeId(nodeId, node);
    full_field_name_str = make_full_field_name_str(fin, field_prefix_str, field_prefix_len, field_str, field_len, &full_field_name_len);

    if (is_excluded(excluded_fields, full_field_name_str, full_field_name_len)) {
        return 0;
    }

    /*
     * Check if the field name is an edge field.
     */
    err = send_edge_field(fin, resp, lang, hierarchy, node, field_prefix_str, field_prefix_len, field_str, field_len, excluded_fields);
    if (err < 0 && err != SELVA_ENOENT) {
        return 0;
    } else if (err >= 0) {
        res += err;
    }
    /* Note that we might still need to send something from the data object. */

    res += send_obj_field(resp, lang, obj, field_prefix_str, field_prefix_len, field_str, field_len);

    return res;
}

/**
 * @param excluded_fields can be set if certain field names should be excluded from the response; Otherwise NULL.
 */
static void send_all_node_data_fields(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct selva_string *lang,
        SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        const char *field_prefix_str,
        size_t field_prefix_len,
        struct selva_string *excluded_fields)
{
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(node);
    void *iterator;
    const char *field_name_str;

    iterator = SelvaObject_ForeachBegin(obj);
    while ((field_name_str = SelvaObject_ForeachKey(obj, &iterator))) {
        size_t field_name_len = strlen(field_name_str);
        int res;

        res = send_node_field(fin, resp, lang, hierarchy, node, obj, field_prefix_str, field_prefix_len, field_name_str, field_name_len, excluded_fields);
        if (res < 0) {
            /* RFE errors are ignored for now. */
            Selva_NodeId node_id;

            SelvaHierarchy_GetNodeId(node_id, node);
            SELVA_LOG(SELVA_LOGL_ERR, "send_node_field(%.*s, %.*s) failed. err: \"%s\"",
                      (int)SELVA_NODE_ID_SIZE, node_id,
                      (int)field_name_len, field_name_str,
                      selva_strerror(res));
        }
    }
}

/**
 * Init field prefix variable.
 * @param buf size of the buffer must be strlen(fields_idx_str) + 1.
 * @param[in, out] plen inputs the buf len; outputs the final string length.
 */
static const char *init_field_prefix(char *buf, const char *fields_idx_str, size_t *plen)
{
    size_t len = *plen;

    /*
     * Add alias prefix using the field_prefix system,
     * if requested.
     */
    if (is_alias_name(fields_idx_str, len)) {
        memcpy(buf, fields_idx_str, len);
        buf[len] = '\0';

        /* We know that string_set does the reverse of this replacement. */
        return ch_replace(buf, len, ':', '.');
    } else {
        *plen = 0;
        return NULL;
    }
}

/**
 * Send named fields.
 * Should be only used by send_node_fields().
 */
static void send_node_fields_named(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct selva_string *lang,
        SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        struct SelvaObject *fields,
        struct selva_string *excluded_fields)
{
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(node);
    void *iterator;
    const SVector *vec;
    const char *fields_idx_str;

    iterator = SelvaObject_ForeachBegin(fields);
    while ((vec = SelvaObject_ForeachValue(fields, &iterator, &fields_idx_str, SELVA_OBJECT_ARRAY))) {
        struct SVectorIterator it;
        struct selva_string *field;

        SVector_ForeachBegin(&it, vec);
        while ((field = SVector_Foreach(&it))) {
            TO_STR(field);
            int res;

            /* Only send one of the fields on the list. */
            if (iswildcard(field_str, field_len)) {
                /*
                 * Note that we ignore the possible alias (STRING_SET_ALIAS)
                 * here because an alias in front of a wildcard doesn't make
                 * any sense.
                 */
                send_all_node_data_fields(fin, resp, lang, hierarchy, node, NULL, 0, excluded_fields);
                break;
            } else {
                size_t field_prefix_len = strlen(fields_idx_str);
                char buf[field_prefix_len + 1];
                const char *field_prefix_str = init_field_prefix(buf, fields_idx_str, &field_prefix_len);

                res = send_node_field(fin, resp, lang, hierarchy, node, obj, field_prefix_str, field_prefix_len, field_str, field_len, excluded_fields);
                if (res > 0) {
                    break;
                }
            }
        }
    }
}

static void send_top_level_edge_meta(
        struct selva_server_response_out *resp,
        struct selva_string *lang,
        struct SelvaObject *edge_metadata,
        struct SelvaHierarchyNode *node,
        struct SelvaObject *fields,
        struct selva_string *excluded_fields)
{
    void *iterator;
    const SVector *vec;
    const char *fields_idx_str;

    iterator = SelvaObject_ForeachBegin(fields);
    while ((vec = SelvaObject_ForeachValue(fields, &iterator, &fields_idx_str, SELVA_OBJECT_ARRAY))) {
        struct SVectorIterator it;
        struct selva_string *field;

        SVector_ForeachBegin(&it, vec);
        while ((field = SVector_Foreach(&it))) {
            TO_STR(field);

            if (!strncmp(field_str, SELVA_EDGE_META_FIELD, sizeof(SELVA_EDGE_META_FIELD) - 1)) {
                Selva_NodeId dst_node_id;
                size_t field_prefix_len = strlen(fields_idx_str);
                char buf[field_prefix_len + 1];
                const char *field_prefix_str = init_field_prefix(buf, fields_idx_str, &field_prefix_len);
                size_t meta_key_len;
                const char *meta_key_str = Selva_GetEdgeMetaKey(field_str, field_len, &meta_key_len);

                SelvaHierarchy_GetNodeId(dst_node_id, node);

                if (meta_key_len == 0) {
                    /* Send all but excluded. */
                    if (send_edge_meta_fields(resp, lang, edge_metadata, dst_node_id, excluded_fields)) {
                        break;
                    }
                } else {
                    /* Send a specific field. */
                    if (send_edge_meta_field(
                                    resp, lang,
                                    edge_metadata,
                                    field_prefix_str, field_prefix_len,
                                    meta_key_str, meta_key_len) > 0) {
                        break;
                    }
                }
            }
        }
    }
}

/**
 * Send node fields to the client.
 */
int find_send_node_fields(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct selva_string *lang,
        struct SelvaHierarchy *hierarchy,
        const struct SelvaHierarchyTraversalMetadata *traversal_metadata,
        struct SelvaHierarchyNode *node,
        struct SelvaObject *fields,
        struct selva_string *excluded_fields)
{
    Selva_NodeId nodeId;

    SelvaHierarchy_GetNodeId(nodeId, node);

    /*
     * The response format:
     * ```
     *   [
     *     nodeId,
     *     [
     *       fieldName1,
     *       fieldValue1,
     *       fieldName2,
     *       fieldValue2,
     *       ...
     *       fieldNameN,
     *       fieldValueN,
     *     ]
     *   ]
     * ```
     */

    selva_send_array(resp, 2);
    selva_send_str(resp, nodeId, Selva_NodeIdLen(nodeId));

    selva_send_array(resp, -1);

    if (traversal_metadata) {
       if (find_fields_contains(fields, SELVA_DEPTH_FIELD, sizeof(SELVA_DEPTH_FIELD) - 1)) {
            selva_send_str(resp, SELVA_DEPTH_FIELD, sizeof(SELVA_DEPTH_FIELD) - 1);
            selva_send_ll(resp, traversal_metadata->depth);
       }

       if (traversal_metadata->origin_field_svec_tagp) {
           struct SelvaObject *edge_metadata;

           edge_metadata = SelvaHierarchy_GetEdgeMetadataByTraversal(traversal_metadata, node);
           if (edge_metadata) {
               send_top_level_edge_meta(resp, lang, edge_metadata, node, fields, excluded_fields);
           }
       }
    }

    send_node_fields_named(fin, resp, lang, hierarchy, node, fields, excluded_fields);

    selva_send_array_end(resp);

    return 0;
}
