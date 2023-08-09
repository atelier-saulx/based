/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#define _GNU_SOURCE
#include <stddef.h>
#include <stdio.h>
#include <string.h>
#include <sys/types.h>
#include "util/cstrings.h"
#include "util/finalizer.h"
#include "util/selva_string.h"
#include "util/svector.h"
#include "selva_error.h"
#include "selva_proto.h"
#include "selva_log.h"
#include "selva_server.h"
#include "selva_db.h"
#include "hierarchy.h"
#include "../field_names.h"
#include "find_send.h"

/**
 * @param path_str is the prefix.
 * @param key_name_str is the key name in the current object.
 */
static struct selva_string *format_full_field_path(struct finalizer *fin, const char *path_str, const char *key_name_str) {
    struct selva_string *res;

    if (path_str && path_str[0]) {
        res = selva_string_createf("%s.%s", path_str, key_name_str);
    } else {
        res = selva_string_createf("%s", key_name_str);
    }
    finalizer_add(fin, res, selva_string_free);

    return res;
}


static int is_text_field(struct SelvaObject *obj, const char *key_name_str, size_t key_name_len) {
    SelvaObjectMeta_t meta;
    int err;

    err = SelvaObject_GetUserMetaStr(obj, key_name_str, key_name_len, &meta);
    if (err) {
        return 0;
    }

    return meta == SELVA_OBJECT_META_SUBTYPE_TEXT;
}

static void send_merge_text(
        struct selva_server_response_out *resp,
        struct selva_string *lang,
        Selva_NodeId nodeId,
        struct SelvaObject *fields,
        struct SelvaObject *obj,
        struct selva_string *obj_path) {
    if (SelvaObject_GetType(fields, obj_path) != SELVA_OBJECT_LONGLONG) {
        int err;

        /*
         * Start a new array reply:
         * [node_id, field_name, field_value]
         */
        selva_send_array(resp, 3);

        selva_send_str(resp, nodeId, Selva_NodeIdLen(nodeId));
        selva_send_string(resp, obj_path);
        err = SelvaObject_ReplyWithObject(resp, lang, obj, NULL, 0);
        if (err) {
            /* FIXME We should probably send something here. */
            SELVA_LOG(SELVA_LOGL_ERR, "Failed to send \"%s\" (text) of node_id: \"%.*s\". err: \"%s\"",
                      selva_string_to_str(obj_path, NULL),
                      (int)SELVA_NODE_ID_SIZE, nodeId,
                      selva_strerror(err));
        } else {
            /* Mark the key as sent. */
            (void)SelvaObject_SetLongLong(fields, obj_path, 1);
        }
    }
}

static void send_merge_all(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct selva_string *lang,
        Selva_NodeId nodeId,
        struct SelvaObject *fields,
        struct SelvaObject *obj,
        struct selva_string *obj_path) {
    void *iterator;
    const char *key_name_str;
    TO_STR(obj_path);

    /*
     * Note that the `fields` object is empty in the beginning of the
     * following loop when the send_node_merge() function is called for
     * the first time.
     */
    iterator = SelvaObject_ForeachBegin(obj);
    while ((key_name_str = SelvaObject_ForeachKey(obj, &iterator))) {
        const size_t key_name_len = strlen(key_name_str);
        struct selva_string *full_field_path;
        int err;

        if (!SelvaObject_ExistsStr(fields, key_name_str, strlen(key_name_str))) {
            continue;
        }

        full_field_path = format_full_field_path(fin, obj_path_str, key_name_str);

        /*
         * Start a new array reply:
         * [node_id, field_name, field_value]
         */
        selva_send_array(resp, 3);
        selva_send_str(resp, nodeId, Selva_NodeIdLen(nodeId));
        selva_send_string(resp, full_field_path);
        err = SelvaObject_ReplyWithObjectStr(resp, lang, obj, key_name_str, key_name_len, 0);
        if (err) {
            TO_STR(obj_path);

            SELVA_LOG(SELVA_LOGL_ERR, "Failed to send the field \"%s.%s\" of node %.*s. err: \"%s\"",
                      obj_path_str,
                      key_name_str,
                      (int)SELVA_NODE_ID_SIZE, nodeId,
                      selva_strerror(err));
            continue;
        }

        /* Mark the key as sent. */
        (void)SelvaObject_SetLongLongStr(fields, key_name_str, key_name_len, 1);
    }
}

static void send_named_merge(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct selva_string *lang,
        Selva_NodeId nodeId,
        struct SelvaObject *fields,
        struct SelvaObject *obj,
        struct selva_string *obj_path) {
    void *iterator;
    const SVector *vec;
    const char *field_index;
    TO_STR(obj_path);

    iterator = SelvaObject_ForeachBegin(fields);
    while ((vec = SelvaObject_ForeachValue(fields, &iterator, &field_index, SELVA_OBJECT_ARRAY))) {
        struct SVectorIterator it;
        const struct selva_string *field;

        SVector_ForeachBegin(&it, vec);
        while ((field = SVector_Foreach(&it))) {
            struct selva_string *full_field_path;
            int err;

            if (SelvaObject_Exists(obj, field)) {
                continue;
            }

            full_field_path = format_full_field_path(fin, obj_path_str, selva_string_to_str(field, NULL));

            /*
             * Start a new array reply:
             * [node_id, field_name, field_value]
             */
            selva_send_array(resp, 3);
            selva_send_str(resp, nodeId, Selva_NodeIdLen(nodeId));
            selva_send_string(resp, full_field_path);
            err = SelvaObject_ReplyWithObject(resp, lang, obj, field, 0);
            if (err) {
                TO_STR(field);

                SELVA_LOG(SELVA_LOGL_ERR, "Failed to send the field \"%s\" of node \"%.*s\". err: \"%s\"",
                          field_str,
                          (int)SELVA_NODE_ID_SIZE, nodeId,
                          selva_strerror(err));

                /* Reply with null to fill the gap. */
                selva_send_null(resp);
            }

            SelvaObject_DelKeyStr(fields, field_index, strlen(field_index)); /* Remove the field from the list */
            break; /* Only send the first existing field from the fields list. */
        }
    }
}

static int send_deep_merge(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct selva_string *lang,
        Selva_NodeId nodeId,
        struct SelvaObject *fields,
        struct SelvaObject *obj,
        struct selva_string *obj_path) {
    void *iterator;
    const char *key_name_str;

    /*
     * Note that the `fields` object is empty in the beginning of the
     * following loop when send_deep_merge() is called for the first time.
     */
    iterator = SelvaObject_ForeachBegin(obj);
    while ((key_name_str = SelvaObject_ForeachKey(obj, &iterator))) {
        const size_t key_name_len = strlen(key_name_str);
        struct selva_string *next_path;
        enum SelvaObjectType type;
        TO_STR(obj_path);

        next_path = format_full_field_path(fin, obj_path_str, key_name_str);

        /* Skip fields marked as sent. */
        if (SelvaObject_GetType(fields, next_path) == SELVA_OBJECT_LONGLONG) {
            continue;
        }

        type = SelvaObject_GetTypeStr(obj, key_name_str, key_name_len);
        if (type == SELVA_OBJECT_OBJECT) {
            struct SelvaObject *next_obj;
            int err;

            err = SelvaObject_GetObjectStr(obj, key_name_str, key_name_len, &next_obj);
            if (err) {
                return err;
            } else if (!next_obj) {
                return SELVA_ENOENT;
            }

            err = send_deep_merge(fin, resp, lang, nodeId, fields, next_obj, next_path);
            if (err < 0) {
                SELVA_LOG(SELVA_LOGL_ERR, "Deep merge failed %s",
                          selva_strerror(err));
            }

            /* Mark the text field as sent. */
            if (is_text_field(obj, key_name_str, key_name_len)) {
                (void)SelvaObject_SetLongLong(fields, next_path, 1);
            }
        } else {
            int err;

            /*
             * Start a new array reply:
             * [node_id, field_name, field_value]
             */
            selva_send_array(resp, 3);

            selva_send_str(resp, nodeId, Selva_NodeIdLen(nodeId));
            selva_send_string(resp, next_path);
            err = SelvaObject_ReplyWithObjectStr(resp, lang, obj, key_name_str, key_name_len, 0);
            if (err) {
                TO_STR(obj_path);

                SELVA_LOG(SELVA_LOGL_ERR, "Failed to send \"%s.%s\" of node_id: \"%.*s\"",
                          obj_path_str,
                          key_name_str,
                          (int)SELVA_NODE_ID_SIZE, nodeId);
                continue;
            }

            /* Mark the key as sent. */
            (void)SelvaObject_SetLongLong(fields, next_path, 1);
        }
    }

    return 0;
}


int send_node_merge(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct selva_string *lang,
        const struct SelvaHierarchyNode *node,
        enum SelvaMergeStrategy merge_strategy,
        struct selva_string *obj_path,
        struct SelvaObject *fields) {
    Selva_NodeId nodeId;
    struct SelvaObject *node_obj;
    TO_STR(obj_path);
    int err;

    SelvaHierarchy_GetNodeId(nodeId, node);
    node_obj = SelvaHierarchy_GetNodeObject(node);

    /* Get the nested object by given path. */
    struct SelvaObject *obj;
    if (obj_path_len != 0) {
    err = SelvaObject_GetObject(node_obj, obj_path, &obj);
        if (err == SELVA_ENOENT || err == SELVA_EINTYPE || !obj) {
            /* Skip this node if the object doesn't exist. */
            return 0;
        } else if (err) {
            return err;
        }
    } else {
        obj = node_obj;
    }

    /*
     * The response format:
     * ```
     *   [
     *     fieldName1,
     *     fieldValue1,
     *     fieldName2,
     *     fieldValue2,
     *     ...
     *     fieldNameN,
     *     fieldValueN,
     *   ]
     * ```
     */
    err = 0;
    if ((merge_strategy == MERGE_STRATEGY_ALL || merge_strategy == MERGE_STRATEGY_DEEP) &&
        is_text_field(node_obj, obj_path_str, obj_path_len)) {
        /*
         * If obj is a text field we can just send it directly and skip the rest of
         * the processing.
         */
        send_merge_text(resp, lang, nodeId, fields, obj, obj_path);
    } else if (merge_strategy == MERGE_STRATEGY_ALL) {
        /* Send all keys from the nested object. */
        send_merge_all(fin, resp, lang, nodeId, fields, obj, obj_path);
    } else if (merge_strategy == MERGE_STRATEGY_NAMED) {
        /* Send named keys from the nested object. */
        send_named_merge(fin, resp, lang, nodeId, fields, obj, obj_path);
    } else if (merge_strategy == MERGE_STRATEGY_DEEP) {
        /* Deep merge all keys and nested objects. */
        err = send_deep_merge(fin, resp, lang, nodeId, fields, obj, obj_path);
    } else {
        err = selva_send_errorf(resp, SELVA_ENOTSUP, "Merge strategy not supported: %d\n", (int)merge_strategy);
    }

    return err;
}
