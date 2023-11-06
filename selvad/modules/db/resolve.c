/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include <sys/types.h>
#include "util/selva_string.h"
#include "util/finalizer.h"
#include "selva_error.h"
#include "selva_server.h"
#include "selva_proto.h"
#include "hierarchy.h"
#include "selva_db.h"
#include "selva_onload.h"
#include "subscriptions.h"
#include "resolve.h"

int SelvaResolve_NodeId(
        SelvaHierarchy *hierarchy,
        struct selva_string **ids,
        size_t nr_ids,
        Selva_NodeId node_id) {
    int res = SELVA_ENOENT;

    if (nr_ids == 0) {
        memcpy(node_id, ROOT_NODE_ID, SELVA_NODE_ID_SIZE);

        return 0;
    }

    for (size_t i = 0; i < nr_ids; i++) {
        const struct selva_string *id = ids[i];
        TO_STR(id);

        /* First check if it's a nodeId. */
        if (id_len <= SELVA_NODE_ID_SIZE) {
            Selva_NodeIdCpy(node_id, id_str);

            /* We assume that root always exists. */
            if (!memcmp(node_id, ROOT_NODE_ID, SELVA_NODE_ID_SIZE)) {
                res = SELVA_RESOLVE_NODE_ID | i;
                break;
            }

            if (SelvaHierarchy_NodeExists(hierarchy, node_id)) {
                res = SELVA_RESOLVE_NODE_ID | i;
                break;
            }
        }

        /* Then check if there is an alias with this string. */
        Selva_NodeId tmp_id;
        if (!get_alias(hierarchy, id, tmp_id)) {
            if (SelvaHierarchy_NodeExists(hierarchy, tmp_id)) {
                memcpy(node_id, tmp_id, SELVA_NODE_ID_SIZE);
                res = SELVA_RESOLVE_ALIAS | i;
                break;
            }
        }
    }

    return res;
}

/*
 * SUB_ID IDS...
 */
void SelvaResolve_NodeIdCommand(struct selva_server_response_out *resp, const void *buf, size_t len) {
    SelvaHierarchy *hierarchy = main_hierarchy;
    __auto_finalizer struct finalizer fin;
    Selva_SubscriptionId sub_id;
    struct selva_string **ids;
    int argc;

    finalizer_init(&fin);

    argc = selva_proto_scanf(&fin, buf, len, "%" PRIsubId ", ...",
                             &sub_id,
                             &ids);
    if (argc < 2) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    } else if (argc >= SELVA_RESOLVE_MAX) {
        selva_send_errorf(resp, SELVA_EINVAL, "Too many aliases");
        return;
    }

    const size_t nr_ids = argc - 1;
    Selva_NodeId node_id;
    const int resolved = SelvaResolve_NodeId(hierarchy, ids, nr_ids, node_id);
    if (resolved == SELVA_ENOENT) {
        /*
         * Create a missing marker if a sub_id was given.
         */
        if (sub_id && nr_ids > 0) {
            Selva_SubscriptionMarkerId marker_id = 0;
            int err;

            for (size_t i = 0; i < nr_ids; i++) {
                marker_id = Selva_GenSubscriptionMarkerId(marker_id, selva_string_to_str(ids[i], NULL));
            }

            err = SelvaSubscriptions_AddMissingMarker(hierarchy, sub_id, marker_id, ids, nr_ids);
            if (err) {
                (void)SelvaSubscriptions_DeleteMarker(hierarchy, sub_id, marker_id);

                selva_send_errorf(resp, err, "Failed to add a missing marker");
                return;
            }
        }

        selva_send_null(resp);
        return;
    } else if (resolved < 0) {
        selva_send_errorf(resp, resolved, "Resolve failed");
        return;
    }

    /*
     * Create an alias marker if a sub_id was given.
     */
    if ((resolved & SELVA_RESOLVE_ALIAS) && sub_id && nr_ids > 0) {
        struct selva_string *alias_name = ids[(resolved & ~SELVA_RESOLVE_FLAGS)];
        Selva_SubscriptionMarkerId marker_id;
        int err;

        marker_id = Selva_GenSubscriptionMarkerId(0, selva_string_to_str(alias_name, NULL));

        err = SelvaSubscriptions_AddAliasMarker(hierarchy, sub_id, marker_id, alias_name, node_id);
        if (err && err != SELVA_SUBSCRIPTIONS_EEXIST) {
            selva_send_errorf(resp, err, "Failed to subscribe sub_id: \"%" PRIsubId ".%" PRImrkId "\" alias_name: %s node_id: %.*s\n",
                              sub_id, marker_id,
                              selva_string_to_str(alias_name, NULL),
                              (int)SELVA_NODE_ID_SIZE, node_id);
            return;
        }
    }

    selva_send_array(resp, 2);
    if (nr_ids == 0) {
        selva_send_str(resp, ROOT_NODE_ID, Selva_NodeIdLen(ROOT_NODE_ID));
    } else {
        selva_send_string(resp, ids[(resolved & ~SELVA_RESOLVE_FLAGS)]);
    }
    selva_send_str(resp, node_id, Selva_NodeIdLen(node_id));
}

static int SelvaResolve_OnLoad(void) {
    selva_mk_command(CMD_ID_RESOLVE_NODEID, SELVA_CMD_MODE_PURE, "resolve.nodeid", SelvaResolve_NodeIdCommand);

    return 0;
}
SELVA_ONLOAD(SelvaResolve_OnLoad);
