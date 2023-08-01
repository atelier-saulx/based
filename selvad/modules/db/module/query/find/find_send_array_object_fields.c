/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#define _GNU_SOURCE
#include <stddef.h>
#include <sys/types.h>
#include "util/finalizer.h"
#include "util/selva_string.h"
#include "util/svector.h"
#include "selva_error.h"
#include "selva_error.h"
#include "selva_object.h"
#include "selva_proto.h"
#include "selva_log.h"
#include "selva_server.h"
#include "selva_db.h"
#include "traversal.h"
#include "../field_names.h"
#include "find_send.h"

static int send_array_object_field(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct selva_string *lang,
        struct SelvaObject *obj,
        const char *field_prefix_str,
        size_t field_prefix_len,
        struct selva_string *field) {
    struct selva_string *full_field_name = make_full_field_name(fin, field_prefix_str, field_prefix_len, field);
    TO_STR(field);
    int err;

    /*
     * Check if we have a wildcard in the middle of the field name
     * and process it.
     */
    if (containswildcard(field_str, field_len)) {
        long resp_count = 0;

        err = SelvaObject_ReplyWithWildcardStr(resp, lang, obj, field_str, field_len, &resp_count, -1, 0);
        if (err && err != SELVA_ENOENT) {
            SELVA_LOG(SELVA_LOGL_ERR, "Sending wildcard field \"%.*s\" in array object failed. err: \"%s\"",
                      (int)field_len, field_str,
                      selva_strerror(err));
        }

        return (int)(resp_count / 2);
    }

    /*
     * Finally check if the field name is a key on the node object.
     */
    if (SelvaObject_Exists(obj, field)) {
        /* Field didn't exist in the node. */
        return 0;
    }

    /*
     * Send the reply.
     */
    selva_send_string(resp, full_field_name);
    err = SelvaObject_ReplyWithObject(resp, lang, obj, field, 0);
    if (err) {
        SELVA_LOG(SELVA_LOGL_ERR, "Failed to send the field \"%s\" in array object err: \"%s\"",
                  field_str,
                  selva_strerror(err));
        selva_send_null(resp);
    }

    return 1;
}

int find_send_array_object_fields(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct selva_string *lang,
        struct SelvaObject *obj,
        struct SelvaObject *fields) {
    const char wildcard[2] = { WILDCARD_CHAR, '\0' };
    int err;

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
    selva_send_str(resp, EMPTY_NODE_ID, SELVA_NODE_ID_SIZE);

    const ssize_t fields_len = SelvaObject_Len(fields, NULL);
    if (fields_len == 1 &&
        SelvaTraversal_FieldsContains(fields, wildcard, sizeof(wildcard) - 1)) {
        err = SelvaObject_ReplyWithObject(resp, lang, obj, NULL, 0);
        if (err) {
            SELVA_LOG(SELVA_LOGL_ERR, "Failed to send all fields for selva object in array. err: \"%s\"",
                      selva_strerror(err));
        }
    } else {
        void *iterator;
        const SVector *vec;

        selva_send_array(resp, -1);

        iterator = SelvaObject_ForeachBegin(fields);
        while ((vec = SelvaObject_ForeachValue(fields, &iterator, NULL, SELVA_OBJECT_ARRAY))) {
            struct SVectorIterator it;
            struct selva_string *field;

            SVector_ForeachBegin(&it, vec);
            while ((field = SVector_Foreach(&it))) {
                int res;

                res = send_array_object_field(fin, resp, lang, obj, NULL, 0, field);
                if (res <= 0) {
                    continue;
                } else {
                    break; /* Only send one of the fields in the list. */
                }
            }
        }

        selva_send_array_end(resp);
    }

    return 0;
}
