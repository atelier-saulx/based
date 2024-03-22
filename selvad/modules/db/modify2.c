/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "endian.h"
#include "jemalloc.h"
#include "util/bitmap.h"
#include "util/data-record.h"
#include "util/finalizer.h"
#include "util/selva_string.h"
#include "selva_error.h"
#include "selva_log.h"
#include "selva_proto.h"
#include "selva_server.h"
#include "selva_io.h"
#include "selva_trace.h"
#include "edge.h"
#include "hierarchy.h"
#include "schema.h"
#include "selva_db_types.h"
#include "selva_object.h"
#include "selva_onload.h"
#include "subscriptions.h"
#include "typestr.h"

struct SelvaModifyFieldOp {
    enum SelvaModifyOpCode {
        SELVA_MODIFY_OP_DEL = 0, /*!< Delete field. */
        SELVA_MODIFY_OP_STRING = 1,
        SELVA_MODIFY_OP_STRING_DEFAULT = 2,
        SELVA_MODIFY_OP_LONGLONG = 3,
        SELVA_MODIFY_OP_LONGLONG_DEFAULT = 4,
        SELVA_MODIFY_OP_LONGLONG_INCREMENT = 5,
        SELVA_MODIFY_OP_DOUBLE = 6,
        SELVA_MODIFY_OP_DOUBLE_DEFAULT = 7,
        SELVA_MODIFY_OP_DOUBLE_INCREMENT = 8,
        SELVA_MODIFY_OP_SET_VALUE = 9,
        SELVA_MODIFY_OP_SET_INSERT = 10,
        SELVA_MODIFY_OP_SET_REMOVE = 11,
        SELVA_MODIFY_OP_SET_ASSIGN = 12,
        SELVA_MODIFY_OP_SET_MOVE = 13,
        SELVA_MODIFY_OP_EDGE_META = 14, /*!< Value is `struct SelvaModifyEdgeMeta`. */
    } __packed op;
    enum {
        SELVA_MODIFY_OP_FLAGS_VALUE_IS_DEFLATED = 0x01,
    } __packed flags;
    char lang[2];
    uint32_t index;
    char field_name[SELVA_SHORT_FIELD_NAME_LEN];
    const char *value_str;
    size_t value_len;
};

struct SelvaModifyEdgeMeta {
    enum SelvaModifyOpCode op;
    int8_t delete_all; /*!< Delete all metadata from this edge field. */

    char dst_node_id[SELVA_NODE_ID_SIZE];

    const char *meta_field_name_str;
    size_t meta_field_name_len;

    const char *meta_field_value_str;
    size_t meta_field_value_len;
};

struct modify_header {
    Selva_NodeId node_id;
    enum {
        FLAG_NO_MERGE = 0x01, /*!< Clear any existing fields. */
        FLAG_CREATE =   0x02, /*!< Only create a new node or fail. */
        FLAG_UPDATE =   0x04, /*!< Only update an existing node. */
    } flags;
    uint32_t nr_changes;
};

struct modify_ctx {
    struct selva_server_response_out *resp;
    struct finalizer *fin;
    struct modify_header head;
    struct SelvaHierarchy *hierarchy;
#if 0
    struct bitmap *replset;
#endif
    struct SelvaHierarchyNode *node;
    bool created; /* Will be set if the node was created during this command. */
    bool updated;
    struct SelvaNodeSchema *ns;
    struct {
        struct SelvaFieldSchema *fs;
        size_t name_len;
        char name_str[SELVA_SHORT_FIELD_NAME_LEN + 12];
    } cur_field;
};

#define SELVA_OP_REPL_STATE_UNCHANGED 0
#define SELVA_OP_REPL_STATE_UPDATED 1

#define REPLY_WITH_ARG_TYPE_ERROR(v) do { \
    selva_send_errorf(ctx->resp, SELVA_EINTYPE, "Expected: %s", typeof_str(v)); \
    return SELVA_EINTYPE; \
} while (0)

static int selva_modify_op_del(struct modify_ctx *ctx, struct SelvaModifyFieldOp *op)
{
    return 0;
}

static int selva_modify_op_string(struct modify_ctx *ctx, struct SelvaModifyFieldOp *op)
{
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(ctx->node);
    const char *field_str = ctx->cur_field.name_str;
    size_t field_len = ctx->cur_field.name_len;
    const enum SelvaObjectType old_type = SelvaObject_GetTypeStr(obj, field_str, field_len);
    struct selva_string *new_value;
    int err;

    if (op->op == SELVA_MODIFY_OP_STRING_DEFAULT && old_type != SELVA_OBJECT_NULL) {
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    new_value = selva_string_create(op->value_str, op->value_len, 0);

    if (old_type == SELVA_OBJECT_STRING) {
        struct selva_string *old_value;

        if (!SelvaObject_GetStringStr(obj, field_str, field_len, &old_value)) {
            if (old_value && !selva_string_cmp(old_value, new_value)) {
                selva_string_free(new_value);
                return SELVA_OP_REPL_STATE_UNCHANGED;
            }
        }
    }

    err = SelvaObject_SetStringStr(obj, field_str, field_len, new_value);
    if (err) {
        selva_string_free(new_value);
        selva_send_errorf(ctx->resp, err, "Failed to set a string value");
        return SELVA_OP_REPL_STATE_UNCHANGED;
    }

    return SELVA_OP_REPL_STATE_UPDATED;
}

static int selva_modify_op_longlong(struct modify_ctx *ctx, struct SelvaModifyFieldOp *op)
{
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(ctx->node);
    long long ll;
    int err;

    if (op->value_len != sizeof(ll)) {
        REPLY_WITH_ARG_TYPE_ERROR(ll);
    }

    memcpy(&ll, op->value_str, sizeof(ll));

    err = (op->op == SELVA_MODIFY_OP_LONGLONG_DEFAULT)
        ? SelvaObject_SetLongLongDefaultStr(obj, ctx->cur_field.name_str, ctx->cur_field.name_len, ll)
        : SelvaObject_UpdateLongLongStr(obj, ctx->cur_field.name_str, ctx->cur_field.name_len, ll);
    if (err == SELVA_EEXIST) { /* Default handling. */
        return SELVA_OP_REPL_STATE_UNCHANGED;
    } else if (err) {
        selva_send_error(ctx->resp, err, NULL, 0);
        return err;
    }

    return SELVA_OP_REPL_STATE_UPDATED;
}

static int selva_modify_op_longlong_increment(struct modify_ctx *ctx, struct SelvaModifyFieldOp *op)
{
    return 0;
}

static int selva_modify_op_double(struct modify_ctx *ctx, struct SelvaModifyFieldOp *op)
{
    struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(ctx->node);
    double d;
    int err;

    if (op->value_len != sizeof(d)) {
        REPLY_WITH_ARG_TYPE_ERROR(d);
    }

    memcpy(&d, op->value_str, sizeof(d));

    err = (op->op == SELVA_MODIFY_OP_LONGLONG_DEFAULT)
        ? SelvaObject_SetDoubleDefaultStr(obj, ctx->cur_field.name_str, ctx->cur_field.name_len, d)
        : SelvaObject_UpdateDoubleStr(obj, ctx->cur_field.name_str, ctx->cur_field.name_len, d);
    if (err == SELVA_EEXIST) { /* Default handling. */
        return SELVA_OP_REPL_STATE_UNCHANGED;
    } else if (err) {
        selva_send_error(ctx->resp, err, NULL, 0);
        return err;
    }

    return SELVA_OP_REPL_STATE_UPDATED;
}

static int selva_modify_op_double_increment(struct modify_ctx *ctx, struct SelvaModifyFieldOp *op)
{
    return 0;
}

static int selva_modify_op_set_value(struct modify_ctx *ctx, struct SelvaModifyFieldOp *op)
{
    return 0;
}

static int selva_modify_op_set_insert(struct modify_ctx *ctx, struct SelvaModifyFieldOp *op)
{
    return 0;
}

static int selva_modify_op_set_remove(struct modify_ctx *ctx, struct SelvaModifyFieldOp *op)
{
    return 0;
}

static int selva_modify_op_set_assign(struct modify_ctx *ctx, struct SelvaModifyFieldOp *op)
{
    return 0;
}

static int selva_modify_op_set_move(struct modify_ctx *ctx, struct SelvaModifyFieldOp *op)
{
    return 0;
}

static int selva_modify_op_edge_meta(struct modify_ctx *ctx, struct SelvaModifyFieldOp *op)
{
    return 0;
}

static int (*modify_op_fn[])(struct modify_ctx *ctx, struct SelvaModifyFieldOp *op) = {
    [SELVA_MODIFY_OP_DEL] = selva_modify_op_del,
    [SELVA_MODIFY_OP_STRING] = selva_modify_op_string,
    [SELVA_MODIFY_OP_STRING_DEFAULT] = selva_modify_op_string,
    [SELVA_MODIFY_OP_LONGLONG] = selva_modify_op_longlong,
    [SELVA_MODIFY_OP_LONGLONG_DEFAULT] = selva_modify_op_longlong,
    [SELVA_MODIFY_OP_LONGLONG_INCREMENT] = selva_modify_op_longlong_increment,
    [SELVA_MODIFY_OP_DOUBLE] = selva_modify_op_double,
    [SELVA_MODIFY_OP_DOUBLE_DEFAULT] = selva_modify_op_double,
    [SELVA_MODIFY_OP_DOUBLE_INCREMENT] = selva_modify_op_double_increment,
    [SELVA_MODIFY_OP_SET_VALUE] = selva_modify_op_set_value,
    [SELVA_MODIFY_OP_SET_INSERT] = selva_modify_op_set_insert,
    [SELVA_MODIFY_OP_SET_REMOVE] = selva_modify_op_set_remove,
    [SELVA_MODIFY_OP_SET_ASSIGN] = selva_modify_op_set_assign,
    [SELVA_MODIFY_OP_SET_MOVE] = selva_modify_op_set_move,
    [SELVA_MODIFY_OP_EDGE_META] = selva_modify_op_edge_meta,
};

static int parse_head_get_node(struct modify_ctx *ctx)
{
    struct SelvaHierarchyNode *node = NULL;

    if (!(ctx->head.flags & FLAG_CREATE) && !(ctx->head.flags & FLAG_UPDATE)) {
        int err;
upsert:
        err = SelvaHierarchy_UpsertNode(ctx->hierarchy, ctx->head.node_id, &node);
        if (err < 0 && err != SELVA_HIERARCHY_EEXIST) {
            selva_send_errorf(ctx->resp, err, "Failed to initialize the node");
            return err;
        }
    } else if (ctx->head.flags & (FLAG_CREATE | FLAG_UPDATE)) {
        node = SelvaHierarchy_FindNode(ctx->hierarchy, ctx->head.node_id);
        if (node) {
            if (ctx->head.flags & FLAG_CREATE) {
                selva_send_errorf(ctx->resp, SELVA_HIERARCHY_EEXIST, "Node already exists");
                return SELVA_HIERARCHY_EEXIST;
            }
        } else {
            if (ctx->head.flags & FLAG_UPDATE) {
                selva_send_errorf(ctx->resp, SELVA_HIERARCHY_ENOENT, "Node not found");
                return SELVA_HIERARCHY_ENOENT;
            }

            goto upsert;
        }
    }
    assert(node);

    ctx->created = ctx->updated = SelvaHierarchy_ClearNodeFlagImplicit(node);
    SelvaSubscriptions_FieldChangePrecheck(ctx->hierarchy, node);

    if (!ctx->created && (ctx->head.flags & FLAG_NO_MERGE)) {
        SelvaHierarchy_ClearNodeFields(SelvaHierarchy_GetNodeObject(node));
    }

    ctx->node = node;
    return 0;
}

static int parse_head(struct modify_ctx *ctx, const void *data, size_t data_len)
{
    int err;

    assert(ctx->head.nr_changes == 0);

    if (data_len != sizeof(ctx->head)) {
        selva_send_errorf(ctx->resp, SELVA_EINVAL, "Invalid head");
        return SELVA_EINVAL;
    }
    memcpy(&ctx->head, (char *)data, data_len);
    ctx->head.flags = htole(ctx->head.flags);
    ctx->head.nr_changes = htole(ctx->head.nr_changes);

#if 0
    ctx->replset = selva_calloc(1, BITMAP_ALLOC_SIZE(ctx->head.nr_changes + 1));
    finalizer_add(ctx->fin, ctx->replset, selva_free);
    ctx->replset->nbits = ctx->head.nr_changes + 1;
    bitmap_erase(ctx->replset);
#endif

    err = parse_head_get_node(ctx);
    if (err) {
        return err;
    }

    ctx->ns = SelvaSchema_FindNodeSchema(ctx->hierarchy, ctx->head.node_id);
    if (!ctx->ns) {
        selva_send_errorf(ctx->resp, SELVA_ENOENT, "Node schema not found");
        return SELVA_ENOENT;
    }

    return 0;
}

static int op_fixup(struct SelvaModifyFieldOp *op, const char *data, size_t data_len)
{
    op->index = htole(op->index);
    DATA_RECORD_FIXUP_CSTRING_P(op, data, data_len, value);
    return 0;
}

static int parse_field_change(struct modify_ctx *ctx, const void *data, size_t data_len)
{
    struct SelvaModifyFieldOp op;
    int err;

    if (data_len < sizeof(struct SelvaModifyFieldOp)) {
        selva_send_errorf(ctx->resp, SELVA_EINVAL, "Op size too small");
        return SELVA_EINVAL;
    }

    memcpy(&op, data, sizeof(struct SelvaModifyFieldOp));
    err = op_fixup(&op, data, data_len);
    if (err) {
        selva_send_errorf(ctx->resp, SELVA_EINVAL, "Failed to parse field op");
        return SELVA_EINVAL;
    }

    if ((size_t)op.op >= num_elem(modify_op_fn)) {
        selva_send_errorf(ctx->resp, SELVA_EINVAL, "Invalid opcode");
        return SELVA_EINVAL;
    }

    /* FIXME field prot, if needed??? */
#if 0
    if (!SelvaModify_field_prot_check(field_str, field_len, type_code)) {
        selva_send_errorf(resp, SELVA_ENOTSUP, "Protected field. type_code: %c field: \"%.*s\"",
                          type_code, (int)field_len, field_str);
        return SELVA_ENOTSUP;
    }
#endif

#if 0
    ctx->cur_field.fs = SelvaSchema_FindFieldSchema(ctx->ns, op.field_name);
    if (!ctx->cur_field.fs) {
        selva_send_errorf(ctx->resp, SELVA_ENOENT, "Field schema not found");
        return SELVA_ENOENT;
    }
#endif

#if 0
    /*
     * TODO This is not enough to know if index is needed, unless we use 1 based index??
     * However, we may not even need index this way, not at least for now.
     */
    if (op.index) {
        int res;

        res = snprintf(ctx->cur_field.name_str, sizeof(ctx->cur_field.name_str),
                       "%.*s[%u]",
                       SELVA_SHORT_FIELD_NAME_LEN, op.field_name,
                       (unsigned)op.index);
        if (res < 0 && res > (int)sizeof(ctx->cur_field.name_str)) {
            selva_send_errorf(ctx->resp, SELVA_ENOBUFS, "field_name buffer too small");
            return SELVA_ENOBUFS;
        }
        ctx->cur_field.name_len = res;
    } else
#endif
    if (op.lang[0] && op.lang[1]) {
        int res;

        res = snprintf(ctx->cur_field.name_str, sizeof(ctx->cur_field.name_str),
                       "%.*s.%c%c",
                       SELVA_SHORT_FIELD_NAME_LEN, op.field_name,
                       op.lang[0], op.lang[1]);
        if (res < 0 && res > (int)sizeof(ctx->cur_field.name_str)) {
            selva_send_errorf(ctx->resp, SELVA_ENOBUFS, "field_name buffer too small");
            return SELVA_ENOBUFS;
        }
        ctx->cur_field.name_len = res;
    } else {
        memcpy(ctx->cur_field.name_str, op.field_name, sizeof(ctx->cur_field.name_str));
        ctx->cur_field.name_len = strnlen(op.field_name, SELVA_SHORT_FIELD_NAME_LEN);
    }

    return modify_op_fn[op.op](ctx, &op);
}

static void modify(struct selva_server_response_out *resp, const void *buf, size_t len) {
    /* FIXME */
#if 0
    SELVA_TRACE_BEGIN_AUTO(cmd_modify);
#endif
    __auto_finalizer struct finalizer fin;
    struct modify_ctx ctx = {
        .resp = resp,
        .hierarchy = main_hierarchy,
        .fin = &fin,
    };
    int (*parse_arg)(struct modify_ctx *ctx, const void *data, size_t data_len) = parse_head;
    size_t i = 0; /*!< Index into buf. */
    size_t arg_idx = 0;

    finalizer_init(&fin);

    while (i < len) {
        enum selva_proto_data_type sp_type;
        size_t data_len;
        int off;

        off = selva_proto_parse_vtype(buf, len, i, &sp_type, &data_len);
        if (off <= 0) {
            if (off < 0) {
                selva_send_errorf(resp, SELVA_EINVAL, "Failed to parse a value header: %s", selva_strerror(off));
            }
            break;
        }

        i += off;

        if (sp_type != SELVA_PROTO_STRING) {
            selva_send_errorf(resp, SELVA_EINTYPE, "Unexpected message type");
            break;
        }

        const char *data = (char *)buf + i - data_len;
        int res; /*!< err < 0; ok = 0; updated = 1 */

        res = parse_arg(&ctx, data, data_len);
        parse_arg = parse_field_change;
        if (res < 0) {
            /* An error should have been already sent by the parse function. */
            if (arg_idx == 0) {
                break;
            }
        } else if (res == 0) {
#if 0
            bitmap_set(ctx.replset, arg_idx);
#endif
            selva_send_ll(resp, 0);
        } else {
            SelvaSubscriptions_DeferFieldChangeEvents(ctx.hierarchy, ctx.node,
                                                      ctx.cur_field.name_str, ctx.cur_field.name_len);

#if 0
            bitmap_set(ctx.replset, arg_idx);
#endif
            selva_send_ll(resp, 1);
            ctx.updated = true;
        }

        if (++arg_idx > ctx.head.nr_changes) {
            break;
        }
    }

    if (ctx.created) {
        SelvaSubscriptions_DeferTriggerEvents(ctx.hierarchy, ctx.node, SELVA_SUBSCRIPTION_TRIGGER_TYPE_CREATED);
    } else if (ctx.updated) {
        /*
         * If nodeId wasn't created by this command call but it was updated
         * then we need to defer the updated trigger.
         */
        SelvaSubscriptions_DeferTriggerEvents(ctx.hierarchy, ctx.node, SELVA_SUBSCRIPTION_TRIGGER_TYPE_UPDATED);

        /* FIXME updated_en */
        if (selva_replication_get_mode() == SELVA_REPLICATION_MODE_REPLICA && ctx.ns && ctx.ns->updated_en) {
            struct SelvaObject *obj = SelvaHierarchy_GetNodeObject(ctx.node);
            const int64_t now = selva_resp_to_ts(resp);

            /*
             * If the node was created then the field was already updated by hierarchy.
             * If the command was replicated then the master should send us the correct
             * timestamp.
             */
            SelvaObject_SetLongLongStr(obj, SELVA_UPDATED_AT_FIELD, sizeof(SELVA_UPDATED_AT_FIELD) - 1, now);
            SelvaSubscriptions_DeferFieldChangeEvents(ctx.hierarchy, ctx.node, SELVA_UPDATED_AT_FIELD, sizeof(SELVA_UPDATED_AT_FIELD) - 1);
        }
    }

    if (ctx.created || ctx.updated) {
        selva_io_set_dirty();

        if (selva_replication_get_mode() == SELVA_REPLICATION_MODE_ORIGIN) {
            /* TODO Fix replication optimization */
#if 0
            struct replicate_ts replicate_ts;

            get_replicate_ts(&replicate_ts, node, created, updated);
            replicate_modify(resp, replset, argv, &replicate_ts);
#endif
            if ((ctx.updated || ctx.created)) { /* && (bitmap_popcount(ctx.replset) > 0)) { */
                selva_replication_replicate(selva_resp_to_ts(resp), selva_resp_to_cmd_id(resp), buf, len);
            }
        }
    }

    SelvaSubscriptions_SendDeferredEvents(ctx.hierarchy);
}

static int Modify_OnLoad(void) {
    SELVA_MK_COMMAND(CMD_ID_MODIFY, SELVA_CMD_MODE_MUTATE, modify);

    return 0;
}
SELVA_ONLOAD(Modify_OnLoad);
