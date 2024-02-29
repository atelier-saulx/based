/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "typestr.h"
#include "util/array_field.h"
#include "util/cstrings.h"
#include "util/finalizer.h"
#include "util/selva_string.h"
#include "util/svector.h"
#include "selva_error.h"
#include "selva_proto.h"
#include "selva_io.h"
#include "selva_server.h"
#include "selva_db.h"
#include "hierarchy.h"
#include "subscriptions.h"
#include "selva_onload.h"
#include "selva_set.h"
#include "selva_object.h"

static void publish_field_change_str(struct SelvaHierarchyNode *node, const char *field_str, size_t field_len)
{
    struct SelvaHierarchy *hierarchy = main_hierarchy;

    SelvaSubscriptions_DeferFieldChangeEvents(hierarchy, node, field_str, field_len);
    SelvaSubscriptions_SendDeferredEvents(hierarchy);
}

static void touch_updated_at(struct selva_server_response_out *resp, struct SelvaObject *root_obj)
{
    SelvaObject_SetLongLongStr(root_obj, SELVA_UPDATED_AT_FIELD, sizeof(SELVA_UPDATED_AT_FIELD) - 1, selva_resp_to_ts(resp));
}

#define so_send_x(resp, x) _Generic((x), \
        struct selva_string *: selva_send_string, \
        double: selva_send_double, \
        default: selva_send_ll \
        )((resp), (x))

#define MODIFIED(resp, resp_value) \
    touch_updated_at(resp, obj); \
    so_send_x((resp), (resp_value)); \
    selva_io_set_dirty(); \
    selva_replication_replicate(selva_resp_to_ts(resp), selva_resp_to_cmd_id(resp), buf, len); \
    publish_field_change_str(node, okey_str, okey_len)

static void SelvaObject_DelCommand(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    Selva_NodeId node_id;
    const char *okey_str;
    size_t okey_len;
    int argc, err;
    struct SelvaHierarchyNode *node;
    struct SelvaObject *obj;

    argc = selva_proto_scanf(NULL, buf, len, "%" SELVA_SCA_NODE_ID ", %.*s", node_id, &okey_len, &okey_str);
    if (argc != 2) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    if (!selva_field_prot_check_str(okey_str, okey_len, SELVA_OBJECT_NULL, SELVA_FIELD_PROT_DEL)) {
        selva_send_errorf(resp, SELVA_ENOTSUP, "Protected field");
        return;
    }

    node = SelvaHierarchy_FindNode(main_hierarchy, node_id);
    if (!node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    obj = SelvaHierarchy_GetNodeObject(node);
    SelvaSubscriptions_FieldChangePrecheck(main_hierarchy, node);

    if (SELVA_IS_ALIASES_FIELD(okey_str, okey_len)) {
        delete_all_node_aliases(main_hierarchy, obj);
        MODIFIED(resp, 1);
    } else {
        err = SelvaObject_DelKeyStr(obj, okey_str, okey_len);
        if (err == SELVA_ENOENT) {
            selva_send_ll(resp, 0);
        } else if (err) {
            selva_send_error(resp, err, NULL, 0);
            return;
        } else {
            MODIFIED(resp, 1);
        }
    }
}

static void SelvaObject_ExistsCommand(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    Selva_NodeId node_id;
    const char *okey_str;
    size_t okey_len;
    int argc, err;
    struct SelvaHierarchyNode *node;
    struct SelvaObject *obj;

    argc = selva_proto_scanf(NULL, buf, len, "%" SELVA_SCA_NODE_ID ", %.*s", node_id, &okey_len, &okey_str);
    if (argc != 2) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    node = SelvaHierarchy_FindNode(main_hierarchy, node_id);
    if (!node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    obj = SelvaHierarchy_GetNodeObject(node);
    err = SelvaObject_ExistsStr(obj, okey_str, okey_len);
    if (err == SELVA_ENOENT) {
        selva_send_ll(resp, 0);
    } else if (err) {
        selva_send_error(resp, err, NULL, 0);
    } else {
        selva_send_ll(resp, 1);
    }
}


static void SelvaObject_GetCommand(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    __auto_finalizer struct finalizer fin;
    struct selva_string *lang;
    Selva_NodeId node_id;
    const char *okey_str = NULL;
    size_t okey_len = 0;
    int argc;
    struct SelvaHierarchyNode *node;
    struct SelvaObject *obj;

    finalizer_init(&fin);

    argc = selva_proto_scanf(&fin, buf, len, "%p, %" SELVA_SCA_NODE_ID ", %.*s",
                             &lang,
                             &node_id,
                             &okey_len, &okey_str);
    if (argc < 2 || argc > 3) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    node = SelvaHierarchy_FindNode(main_hierarchy, node_id);
    if (!node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    obj = SelvaHierarchy_GetNodeObject(node);

    if (okey_len && strstr(okey_str, ".*.")) {
        int err;
        long resp_count = 0;

        selva_send_array(resp, -1);
        err = SelvaObject_ReplyWithWildcardStr(resp, lang, obj, okey_str, okey_len,
                                               &resp_count, -1,
                                               SELVA_OBJECT_REPLY_SPLICE_FLAG);
        if (err == SELVA_ENOENT) {
            selva_send_array_end(resp);
        } else if (err) {
            selva_send_errorf(resp, err, "Wildcard failed");
            selva_send_array_end(resp);
        } else { /* found */
            selva_send_array_end(resp);
        }

    } else {
        int err;

        err = SelvaObject_ReplyWithObjectStr(resp, lang, obj, okey_str, okey_len, 0);
        if (err == SELVA_ENOENT) {
            selva_send_null(resp);
        } else if (err) {
            selva_send_error(resp, err, NULL, 0);
        }
    }
}

static enum SelvaObjectType set2so_type(char ch)
{
    switch (ch) {
    case 'f':
        return SELVA_OBJECT_DOUBLE;
    case 'i':
        return SELVA_OBJECT_LONGLONG;
    case 's':
        return SELVA_OBJECT_STRING;
    case 'S':
        return SELVA_OBJECT_SET;
    case 'H':
        return SELVA_OBJECT_HLL;
    default:
        return SELVA_OBJECT_NULL;
    }
}

static void SelvaObject_SetCommand(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    __auto_finalizer struct finalizer fin;
    int argc;
    Selva_NodeId node_id;
    size_t okey_len;
    const char *okey_str;
    char type_ch;
    struct selva_string **oval;
    struct SelvaHierarchyNode *node;
    struct SelvaObject *obj;
    size_t values_set = 0;
    int err;

    finalizer_init(&fin);

    argc = selva_proto_scanf(&fin, buf, len, "%" SELVA_SCA_NODE_ID ", %.*s, %c, ...",
                             &node_id,
                             &okey_len, &okey_str,
                             &type_ch,
                             &oval);
    if (argc < 4) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    enum SelvaObjectType type = set2so_type(type_ch);
    if (!selva_field_prot_check_str(okey_str, okey_len, type, SELVA_FIELD_PROT_WRITE)) {
        selva_send_errorf(resp, SELVA_ENOTSUP, "Protected field");
        return;
    }

    assert(oval);
    if (type != SELVA_OBJECT_SET && type != SELVA_OBJECT_HLL && oval[1]) {
        selva_send_error_arity(resp);
        return;
    }

    node = SelvaHierarchy_FindNode(main_hierarchy, node_id);
    if (!node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    obj = SelvaHierarchy_GetNodeObject(node);
    SelvaSubscriptions_FieldChangePrecheck(main_hierarchy, node);

    int is_aliases;
    switch (type) {
    case SELVA_OBJECT_DOUBLE:
        err = SelvaObject_SetDoubleStr(
            obj, okey_str, okey_len,
            strtod(selva_string_to_str(oval[0], NULL), NULL));
        values_set++;
        break;
    case SELVA_OBJECT_LONGLONG:
        err = SelvaObject_SetLongLongStr(
            obj, okey_str, okey_len,
            strtoll(selva_string_to_str(oval[0], NULL), NULL, 10));
        values_set++;
        break;
    case SELVA_OBJECT_STRING:
        err = SelvaObject_SetStringStr(obj, okey_str, okey_len, oval[0]);
        if (err == 0) {
            finalizer_forget(&fin, oval[0]);
        }
        values_set++;
        break;
    case SELVA_OBJECT_SET:
        is_aliases = SELVA_IS_ALIASES_FIELD(okey_str, okey_len);
        for (int i = 0; i < argc - 3; i++) {
            struct selva_string *el = oval[i];

            err = SelvaObject_AddStringSetStr(obj, okey_str, okey_len, el);
            if (err == 0) {
                finalizer_forget(&fin, el);
                values_set++;
            } else if (values_set == 0) {
                break;
            }
            err = 0;

            if (is_aliases) {
                update_alias(main_hierarchy, node_id, el);
            }
        }
        break;
    case SELVA_OBJECT_HLL:
        for (int i = 0; i < argc - 3; i++) {
            size_t el_len;
            const char *el_str = selva_string_to_str(oval[i], &el_len);

            values_set += SelvaObject_AddHllStr(obj, okey_str, okey_len, el_str, el_len);
        }
        err = 0;
        break;
    default:
        err = SELVA_EINTYPE;
    }
    if (err) {
        selva_send_error(resp, err, NULL, 0);
        return;
    }

    MODIFIED(resp, values_set);
}

static void SelvaObject_IncrbyCommand(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    Selva_NodeId node_id;
    const char *okey_str;
    size_t okey_len;
    long long incr, new;
    int argc, err;
    struct SelvaHierarchyNode *node;
    struct SelvaObject *obj;

    argc = selva_proto_scanf(NULL, buf, len, "%" SELVA_SCA_NODE_ID ", %.*s, %lld", node_id, &okey_len, &okey_str, &incr);
    if (argc < 0) {
        selva_send_errorf(resp, argc, "Failed to parse args");
        return;
    } else if (argc != 3) {
        selva_send_error_arity(resp);
        return;
    }

    if (!selva_field_prot_check_str(okey_str, okey_len, SELVA_OBJECT_LONGLONG, SELVA_FIELD_PROT_WRITE)) {
        selva_send_errorf(resp, SELVA_ENOTSUP, "Protected field");
        return;
    }

    node = SelvaHierarchy_FindNode(main_hierarchy, node_id);
    if (!node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    SelvaSubscriptions_FieldChangePrecheck(main_hierarchy, node);
    obj = SelvaHierarchy_GetNodeObject(node);
    err = SelvaObject_IncrementLongLongStr(obj, okey_str, okey_len, incr, incr, &new);
    if (err) {
        selva_send_errorf(resp, err, "Failed to increment");
        return;
    }

    MODIFIED(resp, new);
}

static void SelvaObject_IncrbyDoubleCommand(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    Selva_NodeId node_id;
    const char *okey_str;
    size_t okey_len;
    double incr, new;
    int argc, err;
    struct SelvaHierarchyNode *node;
    struct SelvaObject *obj;

    argc = selva_proto_scanf(NULL, buf, len, "%" SELVA_SCA_NODE_ID ", %.*s, %lf", node_id, &okey_len, &okey_str, &incr);
    if (argc < 0) {
        selva_send_errorf(resp, argc, "Failed to parse args");
        return;
    } else if (argc != 3) {
        selva_send_error_arity(resp);
        return;
    }

    if (!selva_field_prot_check_str(okey_str, okey_len, SELVA_OBJECT_DOUBLE, SELVA_FIELD_PROT_WRITE)) {
        selva_send_errorf(resp, SELVA_ENOTSUP, "Protected field");
        return;
    }

    node = SelvaHierarchy_FindNode(main_hierarchy, node_id);
    if (!node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    obj = SelvaHierarchy_GetNodeObject(node);
    err = SelvaObject_IncrementDoubleStr(obj, okey_str, okey_len, incr, incr, &new);
    if (err) {
        selva_send_errorf(resp, err, "Failed to increment");
        return;
    }

    MODIFIED(resp, new);
}

static void SelvaObject_KeysCommand(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    Selva_NodeId node_id;
    const char *okey_str;
    size_t okey_len;
    int argc;
    struct SelvaHierarchyNode *node;
    struct SelvaObject *obj;

    argc = selva_proto_scanf(NULL, buf, len, "%" SELVA_SCA_NODE_ID ", %.*s", node_id, &okey_len, &okey_str);
    if (argc != 1 && argc != 2) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    node = SelvaHierarchy_FindNode(main_hierarchy, node_id);
    if (!node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    obj = SelvaHierarchy_GetNodeObject(node);
    if (argc == 2) {
        int err;

        err = SelvaObject_GetObjectStr(obj, okey_str, okey_len, &obj);
        if (err || !obj) {
            selva_send_errorf(resp, err, "Get key");
            return;
        }
    }

    selva_send_array(resp, -1);

    const char *skey;
    SelvaObject_Iterator *it = SelvaObject_ForeachBegin(obj);
    while ((skey = SelvaObject_ForeachKey(obj, &it))) {
        selva_send_strf(resp, "%s", skey);
    }

    selva_send_array_end(resp);
}

static void SelvaObject_TypeCommand(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    Selva_NodeId node_id;
    const char *okey_str;
    size_t okey_len;
    int argc;
    struct SelvaHierarchyNode *node;
    struct SelvaObject *obj;

    argc = selva_proto_scanf(NULL, buf, len, "%" SELVA_SCA_NODE_ID ", %.*s", node_id, &okey_len, &okey_str);
    if (argc != 2) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    node = SelvaHierarchy_FindNode(main_hierarchy, node_id);
    if (!node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    obj = SelvaHierarchy_GetNodeObject(node);

    enum SelvaObjectType type;
    const char *type_str;
    size_t type_len;

    type = SelvaObject_GetTypeStr(obj, okey_str, okey_len);
    if (type == SELVA_OBJECT_NULL) {
        selva_send_errorf(resp, SELVA_ENOENT, "Field not found");
        return;
    }

    type_str = SelvaObject_Type2String(type, &type_len);
    if (!type_str) {
        selva_send_errorf(resp, SELVA_EINTYPE, "invalid key type %d", (int)type);
        return;
    }

    if (type == SELVA_OBJECT_ARRAY) {
        enum SelvaObjectType subtype = SELVA_OBJECT_NULL;
        const char *subtype_str;
        size_t subtype_len;

        (void)SelvaObject_GetArrayStr(obj, okey_str, okey_len, &subtype, NULL);
        subtype_str = SelvaObject_Type2String(subtype, &subtype_len);

        if (!subtype_str) {
            selva_send_array(resp, 2);
            selva_send_str(resp, type_str, type_len);
            selva_send_errorf(resp, SELVA_EINTYPE, "invalid key subtype %d", (int)subtype);
        } else if (get_array_field_index(okey_str, okey_len, NULL) > 0) {
            selva_send_array(resp, 1);
            selva_send_str(resp, subtype_str, subtype_len);
        } else {
            selva_send_array(resp, 2);
            selva_send_str(resp, type_str, type_len);
            selva_send_str(resp, subtype_str, subtype_len);
        }
    } else if (type == SELVA_OBJECT_SET) {
        const struct SelvaSet *set;

        selva_send_array(resp, 2);
        selva_send_str(resp, type_str, type_len);

        set = SelvaObject_GetSetStr(obj, okey_str, okey_len);
        if (set) {
            switch (set->type) {
            case SELVA_SET_TYPE_STRING:
                selva_send_str(resp, "string", 6);
                break;
            case SELVA_SET_TYPE_DOUBLE:
                selva_send_str(resp, "double", 6);
                break;
            case SELVA_SET_TYPE_LONGLONG:
                selva_send_str(resp, "long long", 9);
                break;
            case SELVA_SET_TYPE_NODEID:
                selva_send_str(resp, "nodeId", 6);
                break;
            default:
                selva_send_errorf(resp, SELVA_EINTYPE, "invalid set type %d", (int)set->type);
                break;
            }
        } else {
            /* Technically ENOENT but we already found the key once. */
            selva_send_errorf(resp, SELVA_EINTYPE, "invalid set key");
        }
    } else {
        selva_send_array(resp, 1);
        selva_send_str(resp, type_str, type_len);
    }
}

static void SelvaObject_LenCommand(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    Selva_NodeId node_id;
    const char *okey_str = NULL;
    size_t okey_len = 0;
    int argc;
    struct SelvaHierarchyNode *node;
    struct SelvaObject *obj;

    argc = selva_proto_scanf(NULL, buf, len, "%" SELVA_SCA_NODE_ID ", %.*s", node_id, &okey_len, &okey_str);
    if (argc != 1 && argc != 2) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    node = SelvaHierarchy_FindNode(main_hierarchy, node_id);
    if (!node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    obj = SelvaHierarchy_GetNodeObject(node);

    const ssize_t obj_len = SelvaObject_LenStr(obj, okey_str, okey_len);
    if (obj_len < 0) {
        int err = (int)obj_len;

        if (err == SELVA_EINTYPE) {
            selva_send_errorf(resp, SELVA_EINTYPE, "key type not supported");
            return;
        } else {
            selva_send_error(resp, err, NULL, 0);
            return;
        }
    }

    selva_send_ll(resp, obj_len);
}

static void SelvaObject_GetMetaCommand(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    Selva_NodeId node_id;
    const char *okey_str = NULL;
    size_t okey_len = 0;
    int argc, err;
    struct SelvaHierarchyNode *node;
    struct SelvaObject *obj;

    argc = selva_proto_scanf(NULL, buf, len, "%" SELVA_SCA_NODE_ID ", %.*s", node_id, &okey_len, &okey_str);
    if (argc != 2) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    node = SelvaHierarchy_FindNode(main_hierarchy, node_id);
    if (!node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    obj = SelvaHierarchy_GetNodeObject(node);

    SelvaObjectMeta_t user_meta;
    err = SelvaObject_GetUserMetaStr(obj, okey_str, okey_len, &user_meta);
    if (err) {
        selva_send_errorf(resp, err, "Failed to get key metadata");
        return;
    }

    selva_send_ll(resp, user_meta);
}

static void SelvaObject_SetMetaCommand(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    Selva_NodeId node_id;
    const char *okey_str = NULL;
    size_t okey_len = 0;
    int argc, err;
    struct SelvaHierarchyNode *node;
    struct SelvaObject *obj;
    SelvaObjectMeta_t user_meta;

    argc = selva_proto_scanf(NULL, buf, len, "%" SELVA_SCA_NODE_ID ", %.*s, %" PRIu32,
                             node_id,
                             &okey_len, &okey_str,
                             &user_meta);
    if (argc != 3) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    if (!selva_field_prot_check_str(okey_str, okey_len, SELVA_OBJECT_OBJECT, SELVA_FIELD_PROT_WRITE)) {
        selva_send_errorf(resp, SELVA_ENOTSUP, "Protected field");
        return;
    }

    node = SelvaHierarchy_FindNode(main_hierarchy, node_id);
    if (!node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    obj = SelvaHierarchy_GetNodeObject(node);

    err = SelvaObject_SetUserMetaStr(obj, okey_str, okey_len, user_meta, NULL);
    if (err) {
        selva_send_errorf(resp, err, "Failed to set key metadata");
        return;
    }

    MODIFIED(resp, 1);
}

static void SelvaObject_GetStringCommand(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    Selva_NodeId node_id;
    const char *okey_str = NULL;
    size_t okey_len = 0;
    struct SelvaHierarchyNode *node;
    struct SelvaObject *obj;
    struct selva_string *value;
    int argc, err;

    argc = selva_proto_scanf(NULL, buf, len, "%" SELVA_SCA_NODE_ID ", %.*s",
                             &node_id,
                             &okey_len, &okey_str);
    if (argc != 2) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    node = SelvaHierarchy_FindNode(main_hierarchy, node_id);
    if (!node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    obj = SelvaHierarchy_GetNodeObject(node);
    err = SelvaObject_GetStringStr(obj, okey_str, okey_len, &value);
    if (err) {
        selva_send_errorf(resp, err, "Failed to get the field value");
        return;
    }

    selva_send_array(resp, 3);
    selva_send_ll(resp, selva_string_get_flags(value));
    selva_send_ll(resp, selva_string_get_crc(value));
    selva_send_string(resp, value);
}

static void SelvaObject_CasCommand(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    __auto_finalizer struct finalizer fin;
    Selva_NodeId node_id;
    size_t okey_len;
    const char *okey_str;
    uint32_t old_crc;
    struct selva_string *new_value;
    struct SelvaHierarchyNode *node;
    struct SelvaObject *obj;
    int argc, err;

    finalizer_init(&fin);

    argc = selva_proto_scanf(&fin, buf, len, "%" SELVA_SCA_NODE_ID ", %.*s, %" SCNu32 ", %s",
                             &node_id,
                             &okey_len, &okey_str,
                             &old_crc,
                             &new_value);
    if (argc != 4) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    if (!selva_field_prot_check_str(okey_str, okey_len, SELVA_OBJECT_STRING, SELVA_FIELD_PROT_WRITE)) {
        selva_send_errorf(resp, SELVA_ENOTSUP, "Protected field");
        return;
    }

    node = SelvaHierarchy_FindNode(main_hierarchy, node_id);
    if (!node) {
        selva_send_error(resp, SELVA_HIERARCHY_ENOENT, NULL, 0);
        return;
    }

    obj = SelvaHierarchy_GetNodeObject(node);
    SelvaSubscriptions_FieldChangePrecheck(main_hierarchy, node);

    struct selva_string *old_value = NULL;
    err = SelvaObject_GetStringStr(obj, okey_str, okey_len, &old_value);
    if (err && err != SELVA_ENOENT) {
        selva_send_errorf(resp, err, "Failed to get the old value");
        return;
    }

    if (old_value && selva_string_get_crc(old_value) != old_crc) {
        selva_send_errorf(resp, SELVA_OBJECT_EMISMATCH, "CRC mismatch");
        return;
    }

    selva_string_en_crc(new_value);
    err = SelvaObject_SetStringStr(obj, okey_str, okey_len, new_value);
    if (err == 0) {
        finalizer_forget(&fin, new_value);
    } else if (err) {
        selva_send_error(resp, err, NULL, 0);
        return;
    }

    MODIFIED(resp, 1);
}

static int SelvaObject_OnLoad(void)
{
    selva_mk_command(CMD_ID_OBJECT_DEL, SELVA_CMD_MODE_MUTATE, "object.del", SelvaObject_DelCommand);
    selva_mk_command(CMD_ID_OBJECT_EXISTS, SELVA_CMD_MODE_PURE, "object.exists", SelvaObject_ExistsCommand);
    selva_mk_command(CMD_ID_OBJECT_GET, SELVA_CMD_MODE_PURE, "object.get", SelvaObject_GetCommand);
    selva_mk_command(CMD_ID_OBJECT_SET, SELVA_CMD_MODE_MUTATE, "object.set", SelvaObject_SetCommand);
    selva_mk_command(CMD_ID_OBJECT_INCRBY, SELVA_CMD_MODE_MUTATE, "object.incrby", SelvaObject_IncrbyCommand);
    selva_mk_command(CMD_ID_OBJECT_INCRBY_DOUBLE, SELVA_CMD_MODE_MUTATE, "object.incrbydouble", SelvaObject_IncrbyDoubleCommand);
    selva_mk_command(CMD_ID_OBJECT_KEYS, SELVA_CMD_MODE_PURE, "object.keys", SelvaObject_KeysCommand);
    selva_mk_command(CMD_ID_OBJECT_TYPE, SELVA_CMD_MODE_PURE, "object.type", SelvaObject_TypeCommand);
    selva_mk_command(CMD_ID_OBJECT_LEN, SELVA_CMD_MODE_PURE, "object.len", SelvaObject_LenCommand);
    selva_mk_command(CMD_ID_OBJECT_GETMETA, SELVA_CMD_MODE_PURE, "object.getMeta", SelvaObject_GetMetaCommand);
    selva_mk_command(CMD_ID_OBJECT_SETMETA, SELVA_CMD_MODE_MUTATE, "object.setMeta", SelvaObject_SetMetaCommand);
    selva_mk_command(CMD_ID_OBJECT_GET_STRING, SELVA_CMD_MODE_MUTATE, "object.getString", SelvaObject_GetStringCommand);
    selva_mk_command(CMD_ID_OBJECT_CAS, SELVA_CMD_MODE_MUTATE, "object.cas", SelvaObject_CasCommand);

    return 0;
}
SELVA_ONLOAD(SelvaObject_OnLoad);
