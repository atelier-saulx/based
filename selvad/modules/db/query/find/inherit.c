/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <alloca.h>
#include <assert.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include "util/bitmap.h"
#include "util/cstrings.h"
#include "util/finalizer.h"
#include "util/selva_string.h"
#include "util/svector.h"
#include "selva_error.h"
#include "selva_log.h"
#include "selva_proto.h"
#include "selva_server.h"
#include "selva_db.h"
#include "field_lookup.h"
#include "hierarchy.h"
#include "modify.h"
#include "parsers.h"
#include "query.h"
#include "rpn.h"
#include "selva_object.h"
#include "selva_onload.h"
#include "selva_set.h"
#include "subscriptions.h"
#include "inherit_fields.h"

struct InheritFieldValue_Args {
    size_t first_node; /*!< We ignore the type of the first node. */
    size_t nr_types;
    const Selva_NodeType *types;
    struct selva_string *lang;
    const char *field_name_str;
    size_t field_name_len;
    struct SelvaObjectAny *res;
};

struct InheritSendFields_Args {
    size_t first_node; /*!< We ignore the type of the first node. */
    struct selva_server_response_out *resp;
    size_t nr_fields;
    struct selva_string *lang;
    const struct selva_string **field_names;
    struct bitmap *found;
};

static int is_type_match(struct SelvaHierarchyNode *node, const Selva_NodeType *types, size_t nr_types)
{
    Selva_NodeId node_id;

    if (nr_types == 0) {
        /* Wildcard */
        return 1;
    }

    SelvaHierarchy_GetNodeId(node_id, node);

    for (size_t i = 0; i < nr_types; i++) {
        if (!memcmp(types[i], node_id, SELVA_NODE_TYPE_SIZE)) {
            return 1;
        }
    }

    return 0;
}

static int Inherit_FieldValue_NodeCb(
        struct SelvaHierarchy *hierarchy,
        const struct SelvaHierarchyTraversalMetadata *,
        struct SelvaHierarchyNode *node,
        void *arg) {
    struct InheritFieldValue_Args *restrict args = (struct InheritFieldValue_Args *)arg;
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(node);
    int err;

    /*
     * Check that the node is of an accepted type.
     */
    if (likely(!args->first_node)) {
        if (!is_type_match(node, args->types, args->nr_types)) {
            /*
             * This node type is not accepted and we don't need to check whether
             * the field set.
             */
            return 0;
        }
    } else {
        args->first_node = 0;
    }

    err = field_lookup_inherit(hierarchy, args->lang, node, obj, args->field_name_str, args->field_name_len, args->res);
    if (err == 0) {
        return 1; /* found */
    } else if (err != SELVA_ENOENT) {
        Selva_NodeId nodeId;

        SelvaHierarchy_GetNodeId(nodeId, node);

        /*
         * SELVA_ENOENT is expected as not all nodes have all fields set;
         * Any other error is unexpected.
         */
        SELVA_LOG(SELVA_LOGL_ERR, "Failed to get a field value. nodeId: %.*s fieldName: \"%.*s\" err: \"%s\"",
                  (int)SELVA_NODE_ID_SIZE, nodeId,
                  (int)args->field_name_len, args->field_name_str,
                  selva_strerror(err));
    }

    return 0;
}

static void parse_type_and_field(
        const char *str,
        size_t len,
        const char **types_str, size_t *types_len,
        const char **name_str, size_t *name_len) {
    const char *full_name_str;
    size_t full_name_len;

    if (len < 2) {
        *types_str = NULL;
        *types_len = 0;
        *name_str = NULL;
        *name_len = 0;
        return;
    }

    *types_str = str;
    full_name_str = memchr(str, ':', len);
    if (full_name_str) {
        full_name_str++;
    }

    full_name_len = (size_t)((str + len) - full_name_str);
    *types_len = (size_t)(full_name_str - *types_str - 1);

    const char *alias_end = memchr(full_name_str, STRING_SET_ALIAS, full_name_len);
    const size_t alias_len = alias_end ? alias_end - full_name_str : 0;
    if (alias_len > 1) { /* name + @ */
        *name_str = alias_end + 1;
        *name_len = full_name_len - alias_len;
    } else {
        *name_str = full_name_str;
        *name_len = full_name_len;
    }
}

static int Inherit_SendFields_NodeCb(
        struct SelvaHierarchy *hierarchy,
        const struct SelvaHierarchyTraversalMetadata *,
        struct SelvaHierarchyNode *node,
        void *arg) {
    struct InheritSendFields_Args *restrict args = (struct InheritSendFields_Args *)arg;
    const int first_node = args->first_node;
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(node);
    int err;

    if (unlikely(first_node)) {
        args->first_node = 0;
    }

    for (size_t i = 0; i < args->nr_fields; i++) {
        /* Field already found. */
        if (bitmap_get(args->found, i)) {
            continue;
        }

        const struct selva_string *types_and_field = args->field_names[i];
        const char *types_str;
        size_t types_len;
        const char *field_name_str;
        size_t field_name_len;
        TO_STR(types_and_field);

		parse_type_and_field(types_and_field_str, types_and_field_len,
                             &types_str, &types_len,
                             &field_name_str, &field_name_len);
		if (field_name_len == 0) {
			/* Invalid inherit string. */
			continue;
		}

        size_t full_field_name_len = types_and_field_len + 1;
        char full_field_name_str[full_field_name_len] __attribute__((nonstring));

        full_field_name_str[0] = '^';
        memcpy(full_field_name_str + 1, types_and_field_str, types_and_field_len);

		if (!first_node &&
            types_str && !is_type_match(node, (const char (*)[SELVA_NODE_TYPE_SIZE])types_str, types_len / sizeof(Selva_NodeType))) {
			/*
			 * This node type is not accepted and we don't need to check whether
			 * the field set.
			 * Note that we accept any type for the first node.
			 */
			return 0;
		}

        /*
         * Get and send the field value to the client.
         * The response should always start like this: [node_id, field_name, ...]
         * but we don't send the header yet.
         */
        err = Inherit_SendFieldFind(args->resp, hierarchy, args->lang,
                                    node, obj,
                                    full_field_name_str, full_field_name_len, /* Initially full_field is the same as field_name unless there is an alias. */
                                    field_name_str, field_name_len);
        if (err == 0) { /* found */
            bitmap_set(args->found, i); /* No need to look for this field anymore. */
        } else if (err != SELVA_ENOENT) {
            Selva_NodeId nodeId;

            SelvaHierarchy_GetNodeId(nodeId, node);

            /*
             * SELVA_ENOENT is expected as not all nodes have all fields set;
             * Any other error is unexpected.
             */
            SELVA_LOG(SELVA_LOGL_ERR, "Failed to get a field value. nodeId: %.*s fieldName: \"%.*s\" err: \"%s\"",
                      (int)SELVA_NODE_ID_SIZE, nodeId,
                      (int)field_name_len, field_name_str,
                      selva_strerror(err));
        }
    }

    /* Stop traversing if all fields were found. */
    return (size_t)bitmap_popcount(args->found) == args->nr_fields;
}

int Inherit_FieldValue(
        struct SelvaHierarchy *hierarchy,
        struct selva_string *lang,
        const Selva_NodeId node_id,
        const Selva_NodeType *types,
        size_t nr_types,
        const char *field_name_str,
        size_t field_name_len,
        struct SelvaObjectAny *res) {
    struct InheritFieldValue_Args args = {
        .lang = lang,
        .first_node = 1,
        .nr_types = nr_types,
        .types = types,
        .field_name_str = field_name_str,
        .field_name_len = field_name_len,
        .res = res,
    };
    const struct SelvaHierarchyCallback cb = {
        .node_cb = Inherit_FieldValue_NodeCb,
        .node_arg = &args,
    };

    return SelvaHierarchy_Traverse(hierarchy, node_id, SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS, &cb);
}

static void send_null_for_missing_fields(struct InheritSendFields_Args *args, const Selva_NodeId node_id) {
    struct selva_server_response_out *resp = args->resp;
    const size_t nr_fields = args->nr_fields;

    for (size_t i = 0; i < nr_fields; i++) {
        /* Field already found. */
        if (bitmap_get(args->found, i)) {
            continue;
        }

        const struct selva_string *types_and_field = args->field_names[i];
        TO_STR(types_and_field);
        size_t full_field_name_len = types_and_field_len + 1;
        char full_field_name_str[full_field_name_len] __attribute__((nonstring));

        full_field_name_str[0] = '^';
        memcpy(full_field_name_str + 1, types_and_field_str, types_and_field_len);

        selva_send_str(resp, full_field_name_str, full_field_name_len);
        selva_send_array(resp, 2);
        selva_send_str(resp, node_id, Selva_NodeIdLen(node_id));
        selva_send_null(resp);
    }
}

void Inherit_SendFields(
        struct selva_server_response_out *resp,
        struct SelvaHierarchy *hierarchy,
        struct selva_string *lang,
        const Selva_NodeId node_id,
        const struct selva_string **types_field_names,
        size_t nr_field_names) {
    struct InheritSendFields_Args args = {
        .resp = resp,
        .lang = lang,
        .first_node = 1,
        .field_names = types_field_names,
        .nr_fields = nr_field_names,
    };
    const struct SelvaHierarchyCallback cb = {
        .node_cb = Inherit_SendFields_NodeCb,
        .node_arg = &args,
    };
    int err;

    args.found = alloca(BITMAP_ALLOC_SIZE(nr_field_names));
    args.found->nbits = nr_field_names;
    bitmap_erase(args.found);

    err = SelvaHierarchy_Traverse(hierarchy, node_id, SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS, &cb);
    if (err) {
        /* TODO Better error handling? */
        SELVA_LOG(SELVA_LOGL_ERR, "Inherit failed: %s", selva_strerror(err));
    }

    send_null_for_missing_fields(&args, node_id);
}
