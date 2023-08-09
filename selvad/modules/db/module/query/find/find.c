/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#define _GNU_SOURCE
#include <assert.h>
#include <stddef.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <sys/types.h>
#include <tgmath.h>
#include "endian.h"
#include "jemalloc.h"
#include "util/auto_free.h"
#include "util/cstrings.h"
#include "util/data-record.h"
#include "util/finalizer.h"
#include "util/ptag.h"
#include "util/selva_string.h"
#include "util/svector.h"
#include "selva_error.h"
#include "selva_log.h"
#include "selva_proto.h"
#include "selva_server.h"
#include "selva_db.h"
#include "hierarchy.h"
#include "rpn.h"
#include "db_config.h"
#include "selva_lang.h"
#include "selva_object.h"
#include "selva_onload.h"
#include "selva_set.h"
#include "selva_trace.h"
#include "parsers.h"
#include "subscriptions.h"
#include "edge.h"
#include "traversal.h"
#include "inherit.h"
#include "find_index.h"
#include "../field_names.h"
#include "../query_traverse.h"
#include "find_send.h"
#include "find_cmd.h"

/*
 * Trace handles.
 */
SELVA_TRACE_HANDLE(cmd_find_index);
SELVA_TRACE_HANDLE(cmd_find_sort_result);

static int parse_fields(
        struct finalizer *fin,
        const struct selva_string *raw_in,
        struct SelvaObject **fields_out,
        struct selva_string ***inherit_fields_out,
        size_t *nr_inherit_fields_out,
        struct selva_string **excluded_fields_out
) {
    struct selva_string *inherit_fields_tmp = NULL;
    int err;

    err = parse_string_set(fin, raw_in, fields_out,
            (char []){ STRING_SET_INH_PREFIX, STRING_SET_EXCL_PREFIX, '\0' },
            (struct selva_string **[]){ &inherit_fields_tmp, excluded_fields_out });
    if (err) {
        return err;
    }

    if (inherit_fields_tmp) {
        TO_STR(inherit_fields_tmp);
        struct selva_string **inherit_fields;
        size_t n = 0;

        inherit_fields = parse_string_list(fin, inherit_fields_tmp_str, inherit_fields_tmp_len, '\n');

        struct selva_string *s = inherit_fields[0];
        while (s) {
            s = inherit_fields[++n];
        }
        *inherit_fields_out = inherit_fields;
        *nr_inherit_fields_out = n;
    }

    return 0;
}

static int exec_fields_expression(
        struct finalizer *fin,
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        struct rpn_ctx *rpn_ctx,
        const struct rpn_expression *expr,
        struct SelvaObject **fields,
        struct selva_string ***inherit,
        size_t *nr_inherit,
        struct selva_string **excluded) {
    Selva_NodeId nodeId;
    struct selva_string *out;
    enum rpn_error rpn_err;
    int err;

    SelvaHierarchy_GetNodeId(nodeId, node);
    rpn_set_reg(rpn_ctx, 0, nodeId, SELVA_NODE_ID_SIZE, RPN_SET_REG_FLAG_IS_NAN);
    rpn_set_hierarchy_node(rpn_ctx, hierarchy, node);
    rpn_set_obj(rpn_ctx, SelvaHierarchy_GetNodeObject(node));

    rpn_err = rpn_string(rpn_ctx, expr, &out);
    if (rpn_err) {
        /*
         * The exact error code is not important here because it's not passed
         * to the client. EGENERAL is fine enough.
         */
        return SELVA_EGENERAL;
    }

    err = parse_fields(fin, out, fields, inherit, nr_inherit, excluded);
    selva_string_free(out);

    return err;
}

/**
 * Send out given node to the client.
 * The sent data can be one of the following:
 * - a merge result,
 * - selected node fields,
 * - just the node_id.
 */
static void send_node(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        SelvaHierarchy *hierarchy,
        struct selva_string *lang,
        struct SelvaHierarchyNode *node,
        struct SelvaNodeSendParam *args) {
    int err;

    if (args->merge_strategy != MERGE_STRATEGY_NONE) {
        err = send_node_merge(fin, resp, lang, node, args->merge_strategy, args->merge_path, args->fields);
    } else if (args->fields) { /* Predefined list of fields. */
        err = find_send_node_fields(fin, resp, lang, hierarchy, node,
                                    args->fields,
                                    args->inherit_fields, args->nr_inherit_fields,
                                    args->excluded_fields);
    } else if (args->fields_expression) { /* Select fields using an RPN expression. */
        struct finalizer fin2;
        struct rpn_expression *expr = args->fields_expression;

        /*
         * The following variables are set by exec_fields_expression().
         */
        selvaobject_autofree struct SelvaObject *fields = NULL;
        struct selva_string **inherit_fields = NULL;
        size_t nr_inherit_fields = 0;
        struct selva_string *excluded_fields = NULL;

        /*
         * The expressions are mutually exclusive alternative to field name lists.
         */
        assert(!args->inherit_fields && !args->excluded_fields);

        finalizer_init(&fin2);

        err = exec_fields_expression(&fin2, hierarchy, node,
                                     args->fields_rpn_ctx, expr,
                                     &fields,
                                     &inherit_fields, &nr_inherit_fields,
                                     &excluded_fields);
        if (!err) {
            err = find_send_node_fields(fin, resp, lang, hierarchy, node,
                                        fields,
                                        inherit_fields, nr_inherit_fields,
                                        excluded_fields);
        }

        finalizer_run(&fin2);
    } else { /* Otherwise the nodeId is sent. */
        Selva_NodeId nodeId;

        SelvaHierarchy_GetNodeId(nodeId, node);
        selva_send_str(resp, nodeId, Selva_NodeIdLen(nodeId));
        err = 0;
    }

    if (err) {
        Selva_NodeId nodeId;

        selva_send_null(resp);

        SELVA_LOG(SELVA_LOGL_ERR, "Failed to handle field(s) of the node: \"%.*s\" err: \"%s\"",
                  (int)SELVA_NODE_ID_SIZE, SelvaHierarchy_GetNodeId(nodeId, node),
                  selva_strerror(err));
    }
}

static int process_node_send(
        SelvaHierarchy *hierarchy,
        struct FindCommand_Args *args,
        struct SelvaHierarchyNode *node) {
    ssize_t *nr_nodes = args->nr_nodes;
    ssize_t * restrict limit = args->limit;

    send_node(args->fin, args->resp, hierarchy, args->lang, node, &args->send_param);

    *nr_nodes = *nr_nodes + 1;
    *limit = *limit - 1;

    return *limit == 0;
}

static int process_node_sort(
        SelvaHierarchy *hierarchy __unused,
        struct FindCommand_Args *args,
        struct SelvaHierarchyNode *node) {
    struct TraversalOrderItem *item;

    item = SelvaTraversalOrder_CreateNodeOrderItem(args->fin, args->lang, node, args->send_param.order_field);
    if (item) {
        (void)SVector_InsertFast(args->result, item);
    } else {
        Selva_NodeId nodeId;

        /*
         * It's not so easy to make the response fail at this point.
         * Given that we shouldn't generally even end up here in real
         * life, it's fairly ok to just log the error and return what
         * we can.
         */
        SelvaHierarchy_GetNodeId(nodeId, node);
        SELVA_LOG(SELVA_LOGL_ERR, "Failed to create an order item for the node %.*s",
                  (int)SELVA_NODE_ID_SIZE, nodeId);
    }

    return 0;
}

static int process_node_inherit(
        SelvaHierarchy *hierarchy __unused,
        struct FindCommand_Args *args,
        struct SelvaHierarchyNode *node) {
    SVector_Insert(args->result, node);

    return 0;
}

static __hot int FindCommand_NodeCb(
        struct SelvaHierarchy *hierarchy,
        struct SelvaHierarchyNode *node,
        void *arg) {
    struct FindCommand_Args *args = (struct FindCommand_Args *)arg;
    struct rpn_ctx *rpn_ctx = args->rpn_ctx;
    int take = (args->offset > 0) ? !args->offset-- : 1;

    args->acc_tot++;
    if (take && rpn_ctx) {
        Selva_NodeId nodeId;
        int err;

        SelvaHierarchy_GetNodeId(nodeId, node);

        /* Set node_id to the register */
        rpn_set_reg(rpn_ctx, 0, nodeId, SELVA_NODE_ID_SIZE, RPN_SET_REG_FLAG_IS_NAN);
        rpn_set_hierarchy_node(rpn_ctx, hierarchy, node);
        rpn_set_obj(rpn_ctx, SelvaHierarchy_GetNodeObject(node));

        /*
         * Resolve the expression and get the result.
         */
        err = rpn_bool(rpn_ctx, args->filter, &take);
        if (err) {
            SELVA_LOG(SELVA_LOGL_ERR, "Expression failed (node: \"%.*s\"): \"%s\"",
                      (int)SELVA_NODE_ID_SIZE, nodeId,
                      rpn_str_error[err]);
            return 1;
        }
    }

    if (take) {
        args->acc_take++;

        return args->process_node(hierarchy, args, node);
    }

    return 0;
}

static int process_array_obj_send(
        struct FindCommand_Args *args,
        struct SelvaObject *obj) {
    ssize_t *nr_nodes = args->nr_nodes;
    ssize_t * restrict limit =  args->limit;

    if (args->send_param.fields) {
        int err;

        err = find_send_array_object_fields(args->fin, args->resp, args->lang, obj, args->send_param.fields);
        if (err) {
            selva_send_null(args->resp);
            SELVA_LOG(SELVA_LOGL_ERR, "Failed to handle field(s), err: \"%s\"",
                      selva_strerror(err));
        }
    } else {
        selva_send_str(args->resp, EMPTY_NODE_ID, SELVA_NODE_ID_SIZE);
    }

    *nr_nodes = *nr_nodes + 1;
    *limit = *limit - 1;

    return *limit == 0;
}

static int process_array_obj_sort(
        struct FindCommand_Args *args,
        struct SelvaObject *obj) {
    struct TraversalOrderItem *item;

    item = SelvaTraversalOrder_CreateObjectOrderItem(args->fin, args->lang, obj, args->send_param.order_field);
    if (item) {
        SVector_InsertFast(args->result, item);
    } else {
        /*
         * It's not so easy to make the response fail at this point.
         * Given that we shouldn't generally even end up here in real
         * life, it's fairly ok to just log the error and return what
         * we can.
         */
        SELVA_LOG(SELVA_LOGL_ERR, "Failed to create an order item");
    }

    return 0;
}

static int FindCommand_ArrayObjectCb(
        union SelvaObjectArrayForeachValue value,
        enum SelvaObjectType subtype,
        void *arg) {
    struct SelvaObject *obj = value.obj;
    struct FindCommand_Args *find_args = (struct FindCommand_Args *)arg;
    struct rpn_ctx *rpn_ctx = find_args->rpn_ctx;
    int take = (find_args->offset > 0) ? !find_args->offset-- : 1;

    if (subtype != SELVA_OBJECT_OBJECT) {
        SELVA_LOG(SELVA_LOGL_ERR, "Array subtype not supported: %s",
                  SelvaObject_Type2String(subtype, NULL));
        return 1;
    }

    if (take && rpn_ctx) {
        int err;

        /* Set obj to the register */
        err = rpn_set_reg_slvobj(rpn_ctx, 0, obj, 0);
        if (err) {
            SELVA_LOG(SELVA_LOGL_ERR, "Register set failed: \"%s\"",
                      rpn_str_error[err]);
            return 1;
        }
        rpn_set_obj(rpn_ctx, obj);

        /*
         * Resolve the expression and get the result.
         */
        err = rpn_bool(rpn_ctx, find_args->filter, &take);
        if (err) {
            SELVA_LOG(SELVA_LOGL_ERR, "Expression failed: \"%s\"",
                      rpn_str_error[err]);
            return 1;
        }
    }

    if (take) {
        return find_args->process_obj(find_args, obj);
    }

    return 0;
}

static size_t FindCommand_SendOrderedResult(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        SelvaHierarchy *hierarchy,
        struct selva_string *lang,
        ssize_t offset,
        ssize_t limit,
        struct SelvaNodeSendParam *args,
        SVector *order_result) {
    struct TraversalOrderItem *item;
    struct SVectorIterator it;
    size_t len = 0;

    /*
     * First handle the offsetting.
     */
    for (ssize_t i = 0; i < offset; i++) {
        SVector_Shift(order_result);
    }
    SVector_ShiftReset(order_result);

    /*
     * Then send out node IDs upto the limit.
     */
    SVector_ForeachBegin(&it, order_result);
    while ((item = SVector_Foreach(&it))) {
        if (limit-- == 0) {
            break;
        }

        assert(PTAG_GETTAG(item->tagp) == TRAVERSAL_ORDER_ITEM_PTYPE_NODE);
        send_node(fin, resp, hierarchy, lang, PTAG_GETP(item->tagp), args);

        len++;
    }

    return len;
}

static void postprocess_array(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct SelvaHierarchy *hierarchy __unused,
        struct selva_string *lang,
        ssize_t offset,
        ssize_t limit,
        struct SelvaNodeSendParam *args,
        SVector *result) {
    struct TraversalOrderItem *item;
    struct SVectorIterator it;

    /*
     * First handle the offsetting.
     */
    for (ssize_t i = 0; i < offset; i++) {
        SVector_Shift(result);
    }
    SVector_ShiftReset(result);

    /*
     * Then send out node IDs upto the limit.
     */
    SVector_ForeachBegin(&it, result);
    while ((item = SVector_Foreach(&it))) {
        int err;
        if (limit-- == 0) {
            break;
        }

        assert(PTAG_GETTAG(item->tagp) == TRAVERSAL_ORDER_ITEM_PTYPE_OBJ);
        err = find_send_array_object_fields(fin, resp, lang, PTAG_GETP(item->tagp), args->fields);
        if (err) {
            selva_send_null(resp);
            SELVA_LOG(SELVA_LOGL_ERR, "Failed to handle field(s) of the node: \"%.*s\" err: \"%s\"",
                      (int)SELVA_NODE_ID_SIZE, item->node_id,
                      selva_strerror(err));
        }
    }

    selva_send_array_end(resp);
}

/**
 * Send nodes from the result SVector to the client.
 */
static void postprocess_sort(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct SelvaHierarchy *hierarchy,
        struct selva_string *lang,
        ssize_t offset,
        ssize_t limit,
        struct SelvaNodeSendParam *args,
        SVector *result) {
    (void)FindCommand_SendOrderedResult(fin, resp, hierarchy, lang, offset, limit, args, result);
    selva_send_array_end(resp);
}

static void postprocess_inherit(
        struct finalizer *fin,
        struct selva_server_response_out *resp,
        struct SelvaHierarchy *hierarchy,
        struct selva_string *lang,
        ssize_t offset,
        ssize_t limit,
        struct SelvaNodeSendParam *args,
        SVector *result) {
    /* Merge + inherit == not supported */
    assert(args->merge_strategy == MERGE_STRATEGY_NONE);

    /*
     * If order is set we need to sort the nodes first.
     * In case of inherit we also want to inherit the sort-by field.
     */
    if (args->order != SELVA_RESULT_ORDER_NONE) {
        SVECTOR_AUTOFREE(order_result);
        size_t order_by_field_len;
        const char *order_by_field_str = selva_string_to_str(args->order_field, &order_by_field_len);
        struct SelvaHierarchyNode *node;
        struct SVectorIterator it;

        SelvaTraversalOrder_InitOrderResult(&order_result, args->order, limit);

        /* result contains nodes in this case instead of items. */
        assert(!result->vec_compar);

        SVector_ForeachBegin(&it, result);
        while ((node = SVector_Foreach(&it))) {
            Selva_NodeId node_id;
            struct SelvaObjectAny fv;
            struct TraversalOrderItem *item;
            int err;

            SelvaHierarchy_GetNodeId(node_id, node);
            err = Inherit_FieldValue(hierarchy, lang, node_id, NULL, 0, order_by_field_str, order_by_field_len, &fv);
            if (err) {
                SELVA_LOG(SELVA_LOGL_ERR, "Inherit_FieldValue(%.*s, NULL, %.*s) failed: %s",
                          (int)SELVA_NODE_ID_SIZE, node_id,
                          (int)order_by_field_len, order_by_field_str,
                          selva_strerror(err));
                continue;
            }

            item = SelvaTraversalOrder_CreateAnyNodeOrderItem(fin, node, &fv);
            if (item) {
                SVector_InsertFast(&order_result, item);
            } else {
                SELVA_LOG(SELVA_LOGL_ERR, "Failed to create an order item for the node %.*s",
                          (int)SELVA_NODE_ID_SIZE, node_id);
            }

        }

        FindCommand_SendOrderedResult(fin, resp, hierarchy, lang, offset, limit, args, &order_result);
        selva_send_array_end(resp);
    } else {
        struct SelvaHierarchyNode *node;
        struct SVectorIterator it;

        /*
         * First handle the offsetting.
         */
        for (ssize_t i = 0; i < offset; i++) {
            SVector_Shift(result);
        }
        SVector_ShiftReset(result);

        /*
         * Then send out node IDs upto the limit.
         */
        SVector_ForeachBegin(&it, result);
        while ((node = SVector_Foreach(&it))) {
            if (limit-- == 0) {
                break;
            }

            send_node(fin, resp, hierarchy, lang, node, args);
        }

        selva_send_array_end(resp);
    }
}

/* TODO It wouldn't be necessary to call this in the loop. */
static SelvaFind_Postprocess select_processing(struct FindCommand_Args *args, enum SelvaTraversal dir, enum SelvaResultOrder order, enum SelvaFind_ResType res_type) {
    SelvaFind_Postprocess postprocess;

    if (dir == SELVA_HIERARCHY_TRAVERSAL_ARRAY) {
        if (order != SELVA_RESULT_ORDER_NONE) {
            args->process_obj = &process_array_obj_sort;
            postprocess = &postprocess_array;
        } else {
            args->process_obj = &process_array_obj_send;
            postprocess = NULL;
        }
    } else {
        if (res_type == SELVA_FIND_QUERY_RES_INHERIT_RPN) {
            /* This will also handle sorting if it was requested. */
            args->process_node = &process_node_inherit;
            postprocess = &postprocess_inherit;
        } else if (order != SELVA_RESULT_ORDER_NONE) {
            args->process_node = &process_node_sort;
            postprocess = &postprocess_sort;
        } else {
            args->process_node = &process_node_send;
            postprocess = NULL;
        }
    }

    return postprocess;
}

static int fixup_query_opts(struct SelvaFind_QueryOpts *qo, const char *base, size_t size) {
    static_assert(sizeof(qo->dir) == sizeof(int32_t));
    qo->dir = le32toh(qo->dir);

    static_assert(sizeof(qo->order) == sizeof(int32_t));
    qo->order = le32toh(qo->order);

    static_assert(sizeof(qo->offset) == sizeof(int64_t));
    qo->offset = le64toh(qo->offset);

    static_assert(sizeof(qo->limit) == sizeof(int64_t));
    qo->limit = le64toh(qo->limit);

    static_assert(sizeof(qo->merge_strategy) == sizeof(int32_t));
    qo->merge_strategy = le32toh(qo->merge_strategy);

    static_assert(sizeof(qo->res_type) == sizeof(int32_t));
    qo->res_type = le32toh(qo->res_type);

    DATA_RECORD_FIXUP_CSTRING_P(qo, base, size,
            dir_opt, edge_filter, index_hints, order_by_field, merge, res_opt);
    return 0;
}

/**
 * Find node(s) matching the query.
 *
 * hierarchy.find
 * lang
 * SelvaFind_QueryOpts
 * ids
 * [expression]                                         RPN filter expression
 * [args...]                                            Register arguments for the RPN filter
 */
static void SelvaHierarchy_FindCommand(struct selva_server_response_out *resp, const void *buf, size_t buf_len) {
    SelvaHierarchy *hierarchy = main_hierarchy;
    __auto_finalizer struct finalizer fin;
    int argc;
    int err;

    finalizer_init(&fin);

    int ARGV_FILTER_EXPR     = 3;
    int ARGV_FILTER_ARGS     = 4;

    struct selva_string *lang = NULL;
    SVECTOR_AUTOFREE(traverse_result); /*!< for postprocessing the result. */

    const char *query_opts_str;
    size_t query_opts_len;
    struct SelvaFind_QueryOpts query_opts;
    const struct selva_string *ids;
    struct selva_string *filter_expr = NULL;
    struct selva_string **filter_expr_args = NULL;

    argc = selva_proto_scanf(&fin, buf, buf_len, "%p, %.*s, %p, %p, ...",
                             &lang,
                             &query_opts_len, &query_opts_str,
                             &ids,
                             &filter_expr,
                             &filter_expr_args
                            );
    if (argc < 0) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }
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
    TO_STR(ids);

    if (!(query_opts.dir & (
          SELVA_HIERARCHY_TRAVERSAL_NONE |
          SELVA_HIERARCHY_TRAVERSAL_NODE |
          SELVA_HIERARCHY_TRAVERSAL_ARRAY |
          SELVA_HIERARCHY_TRAVERSAL_SET |
          SELVA_HIERARCHY_TRAVERSAL_REF |
          SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD |
          SELVA_HIERARCHY_TRAVERSAL_CHILDREN |
          SELVA_HIERARCHY_TRAVERSAL_PARENTS |
          SELVA_HIERARCHY_TRAVERSAL_BFS_ANCESTORS |
          SELVA_HIERARCHY_TRAVERSAL_BFS_DESCENDANTS |
          SELVA_HIERARCHY_TRAVERSAL_DFS_ANCESTORS |
          SELVA_HIERARCHY_TRAVERSAL_DFS_DESCENDANTS |
          SELVA_HIERARCHY_TRAVERSAL_DFS_FULL |
          SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD |
          SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION |
          SELVA_HIERARCHY_TRAVERSAL_EXPRESSION)
         ) || __builtin_popcount(query_opts.dir) > 1
       ) {
        selva_send_errorf(resp, SELVA_EINVAL, "Invalid dir");
        return;
    }

    struct selva_string *dir_expr = NULL;
    __auto_free_rpn_ctx struct rpn_ctx *traversal_rpn_ctx = NULL;
    __auto_free_rpn_expression struct rpn_expression *traversal_expression = NULL;
    if (query_opts.dir & (
         SELVA_HIERARCHY_TRAVERSAL_ARRAY |
         SELVA_HIERARCHY_TRAVERSAL_REF |
         SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD |
         SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD) &&
        query_opts.dir_opt_len == 0) {
        selva_send_errorf(resp, SELVA_EINVAL, "Missing ref field");
        return;
    } else if (query_opts.dir & (SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION |
                                 SELVA_HIERARCHY_TRAVERSAL_EXPRESSION)) {
        dir_expr = selva_string_create(query_opts.dir_opt_str, query_opts.dir_opt_len, 0);
        selva_string_auto_finalize(&fin, dir_expr);

        traversal_rpn_ctx = rpn_init(1);
        traversal_expression = rpn_compile(selva_string_to_str(dir_expr, NULL));
        if (!traversal_expression) {
            selva_send_errorf(resp, SELVA_RPN_ECOMP, "Failed to compile the traversal expression");
            return;
        }
    }

    __auto_free_rpn_ctx struct rpn_ctx *edge_filter_ctx = NULL;
    __auto_free_rpn_expression struct rpn_expression *edge_filter = NULL;
    if (query_opts.edge_filter_len) {
        if (!(query_opts.dir & (SELVA_HIERARCHY_TRAVERSAL_EXPRESSION |
                                SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION))) {
            selva_send_errorf(resp, SELVA_EINVAL, "edge_filter can be only used with expression traversals");
            return;
        }

        edge_filter_ctx = rpn_init(1);
        edge_filter = rpn_compile_len(query_opts.edge_filter_str, query_opts.edge_filter_len);
        if (!edge_filter) {
            selva_send_errorf(resp, SELVA_RPN_ECOMP, "edge_filter");
            return;
        }
    }

    struct selva_string **index_hints = NULL;
    int nr_index_hints = 0;
    if (query_opts.index_hints_len && selva_glob_config.find_indices_max > 0) {
        index_hints = parse_index_hints(&fin, query_opts.index_hints_str, query_opts.index_hints_len, &nr_index_hints);
    }

    struct selva_string *order_by_field = NULL;
    if (query_opts.order == SELVA_RESULT_ORDER_ASC ||
        query_opts.order == SELVA_RESULT_ORDER_DESC) {
        if (query_opts.order_by_field_len == 0) {
            selva_send_errorf(resp, SELVA_EINVAL, "order_by_field must be set");
            return;
        }

        order_by_field = selva_string_create(query_opts.order_by_field_str, query_opts.order_by_field_len, 0);
        selva_string_auto_finalize(&fin, order_by_field);
    } else if (query_opts.order != SELVA_RESULT_ORDER_NONE) {
        selva_send_errorf(resp, SELVA_EINVAL, "order invalid or unsupported");
        return;
    }

    if (query_opts.offset < -1) {
        selva_send_errorf(resp, SELVA_EINVAL, "offset < -1");
        return;
    }

    if (query_opts.limit < -1) {
        selva_send_errorf(resp, SELVA_EINVAL, "limit < -1");
        return;
    }

    struct selva_string *merge_path = NULL;
    if (query_opts.merge_strategy != MERGE_STRATEGY_NONE) {
        if (query_opts.merge_strategy != MERGE_STRATEGY_ALL &&
            query_opts.merge_strategy != MERGE_STRATEGY_NAMED &&
            query_opts.merge_strategy != MERGE_STRATEGY_DEEP) {
            selva_send_errorf(resp, SELVA_EINVAL, "invalid merge strategy");
            return;
        }

        if (query_opts.limit != -1) {
            selva_send_errorf(resp, SELVA_EINVAL, "merge is not supported with limit");
            return;
        }

        merge_path = selva_string_create(query_opts.merge_str, query_opts.merge_len, 0);
        selva_string_auto_finalize(&fin, merge_path);
    }

    /*
     * Parse fields.
     */
    selvaobject_autofree struct SelvaObject *fields = NULL;
    struct selva_string **inherit_fields = NULL;
    size_t nr_inherit_fields = 0;
    struct selva_string *excluded_fields = NULL;
    __auto_free_rpn_ctx struct rpn_ctx *fields_rpn_ctx = NULL;
    __auto_free_rpn_expression struct rpn_expression *fields_expression = NULL;

    if (query_opts.res_type == SELVA_FIND_QUERY_RES_FIELDS) {
        if (query_opts.merge_strategy != MERGE_STRATEGY_NONE &&
            query_opts.merge_strategy != MERGE_STRATEGY_NAMED) {
            selva_send_errorf(resp, SELVA_EINVAL, "Only named merge is supported with fields");
            return;
        }

        struct selva_string *raw;

        raw = selva_string_create(query_opts.res_opt_str, query_opts.res_opt_len, 0);
        selva_string_auto_finalize(&fin, raw);

        err = parse_fields(&fin, raw, &fields, &inherit_fields, &nr_inherit_fields, &excluded_fields);
        if (err) {
            selva_send_errorf(resp, err, "Parsing fields list failed");
            return;
        }
    } else if (query_opts.res_type == SELVA_FIND_QUERY_RES_FIELDS_RPN ||
               query_opts.res_type == SELVA_FIND_QUERY_RES_INHERIT_RPN) {
        /*
         * Note that fields_rpn and merge can't work together because the
         * field names can't vary in a merge.
         */
        if (query_opts.merge_strategy != MERGE_STRATEGY_NONE) {
            selva_send_errorf(resp, SELVA_EINVAL, "fields_rpn with merge not supported");
            return;
        }

        fields_rpn_ctx = rpn_init(1);
        fields_expression = rpn_compile_len(query_opts.res_opt_str, query_opts.res_opt_len);
        if (!fields_expression) {
            selva_send_errorf(resp, SELVA_RPN_ECOMP, "fields_rpn");
            return;
        }
    } else if (query_opts.res_type != SELVA_FIND_QUERY_RES_IDS) {
        selva_send_errorf(resp, SELVA_EINVAL, "Invalid res_type: %d", (int)query_opts.res_type);
        return;
    }
    if (query_opts.merge_strategy != MERGE_STRATEGY_NONE &&
        (!fields || SelvaTraversal_FieldsContains(fields, "*", 1))) {
        /* Merge needs a fields object but it must be empty. */
        if (fields) {
            SelvaObject_Clear(fields, NULL);
        } else {
            fields = SelvaObject_New();
        }
    }

    /*
     * Prepare the filter expression if given.
     */
    __auto_free_rpn_ctx struct rpn_ctx *rpn_ctx = NULL;
    __auto_free_rpn_expression struct rpn_expression *filter_expression = NULL;
    if (argc >= ARGV_FILTER_EXPR + 1) {
        const int nr_reg = argc - ARGV_FILTER_ARGS;

        rpn_ctx = rpn_init(nr_reg + 1);
        filter_expression = rpn_compile(selva_string_to_str(filter_expr, NULL));
        if (!filter_expression) {
            selva_send_errorf(resp, SELVA_RPN_ECOMP, "Failed to compile the filter expression");
            return;
        }

        if (rpn_set_string_regs(rpn_ctx, filter_expr_args, nr_reg)) {
            selva_send_errorf(resp, SELVA_EGENERAL, "Failed to initialize RPN registers");
            return;
        }
    }

    if (query_opts.res_type == SELVA_FIND_QUERY_RES_INHERIT_RPN) {
        SVector_Init(&traverse_result, selva_glob_config.hierarchy_expected_resp_len, NULL);
    } else if (query_opts.order != SELVA_RESULT_ORDER_NONE) {
        SelvaTraversalOrder_InitOrderResult(&traverse_result, query_opts.order, query_opts.limit);
    }

    selva_send_array(resp, -1);

    /*
     * Limit and indexing can be only used together when an order is requested
     * to guarantee a deterministic response order.
     */
    if (nr_index_hints > 0 &&
        query_opts.limit != -1 &&
        query_opts.order == SELVA_RESULT_ORDER_NONE) {
        nr_index_hints = 0;
    }

    /*
     * Run for each NODE_ID.
     */
    ssize_t nr_nodes = 0;
    SelvaFind_Postprocess postprocess = NULL;
    for (size_t i = 0; i < ids_len; i += SELVA_NODE_ID_SIZE) {
        Selva_NodeId nodeId;

        Selva_NodeIdCpy(nodeId, ids_str + i);
        if (nodeId[0] == '\0') {
            /* Just skip empty IDs. */
            continue;
        }

        if (query_opts.limit == 0) {
            break;
        }

        const size_t nr_ind_icb = max(nr_index_hints, 1);
        struct SelvaFindIndexControlBlock *ind_icb[nr_ind_icb];
        int ind_select = -1; /* Selected index. The smallest of all found. */

        memset(ind_icb, 0, nr_ind_icb * sizeof(struct SelvaFindIndexControlBlock *));

        if (nr_index_hints > 0) {
            /*
             * Select the best index res set.
             */
            ind_select = SelvaFindIndex_AutoMulti(hierarchy, query_opts.dir, dir_expr, nodeId, query_opts.order, order_by_field, index_hints, nr_index_hints, ind_icb);

            /*
             * Query optimization.
             * If the index is already ordered then we don't need to sort the
             * response. This won't work if we have multiple nodeIds because
             * obviously the order might differ and we may not have an ordered
             * index for each id.
             */
            if (ind_select >= 0 &&
                ids_len == SELVA_NODE_ID_SIZE &&
                SelvaFindIndex_IsOrdered(ind_icb[ind_select], query_opts.order, order_by_field)) {
                query_opts.order = SELVA_RESULT_ORDER_NONE;
                order_by_field = NULL; /* This controls sorting in the callback. */
            }
        }

        ssize_t tmp_limit = -1;
        const size_t skip = ind_select >= 0 ? 0 : SelvaTraversal_GetSkip(query_opts.dir); /* Skip n nodes from the results. */
        struct FindCommand_Args args = {
            .fin = &fin,
            .resp = resp,
            .lang = lang,
            .nr_nodes = &nr_nodes,
            .offset = (query_opts.order == SELVA_RESULT_ORDER_NONE) ? query_opts.offset + skip : skip,
            .limit = (query_opts.order == SELVA_RESULT_ORDER_NONE) ? &query_opts.limit : &tmp_limit,
            .rpn_ctx = rpn_ctx,
            .filter = filter_expression,
            .send_param.merge_strategy = query_opts.merge_strategy,
            .send_param.merge_path = merge_path,
            .send_param.fields = fields,
            .send_param.inherit_fields = inherit_fields,
            .send_param.nr_inherit_fields = nr_inherit_fields,
            .send_param.excluded_fields = excluded_fields,
            .send_param.fields_rpn_ctx = fields_rpn_ctx,
            .send_param.fields_expression = fields_expression,
            .send_param.order = query_opts.order,
            .send_param.order_field = order_by_field,
            .result = &traverse_result,
            .acc_tot = 0,
            .acc_take = 0,
        };

        postprocess = select_processing(&args, query_opts.dir, query_opts.order, query_opts.res_type);

        if (ind_select >= 0) {
            /*
             * There is no need to run the filter again if the indexing was
             * executing the same filter already.
             */
            if (filter_expr && !selva_string_cmp(filter_expr, index_hints[ind_select])) {
                args.rpn_ctx = NULL;
                args.filter = NULL;
            }

            SELVA_TRACE_BEGIN(cmd_find_index);
            err = SelvaFindIndex_Traverse(hierarchy, ind_icb[ind_select], FindCommand_NodeCb, &args);
            SELVA_TRACE_END(cmd_find_index);
        } else {
            struct query_traverse qt = {
                .dir = query_opts.dir,
                .dir_opt_str = query_opts.dir_opt_str,
                .dir_opt_len = query_opts.dir_opt_len,

                .traversal_rpn_ctx = traversal_rpn_ctx,
                .traversal_expression = traversal_expression,

                .edge_filter_ctx = edge_filter_ctx,
                .edge_filter = edge_filter,

                .node_cb = FindCommand_NodeCb,
                .ary_cb = FindCommand_ArrayObjectCb,
            };

            err = query_traverse(hierarchy, nodeId, &qt, &args);
        }
        if (err != 0) {
            /*
             * We can't send an error to the client at this point so we'll just log
             * it and ignore the error.
             */
            SELVA_LOG(SELVA_LOGL_ERR, "Find failed. dir: %s node_id: \"%.*s\" err: \"%s\"",
                      SelvaTraversal_Dir2str(query_opts.dir),
                      (int)SELVA_NODE_ID_SIZE, nodeId,
                      selva_strerror(err));
        }

        /*
         * Do index accounting.
         */
        SelvaFindIndex_AccMulti(ind_icb, nr_index_hints, ind_select, args.acc_take, args.acc_tot);
    }

    if (postprocess) {
        struct SelvaNodeSendParam send_args = {
            .order = query_opts.order,
            .order_field = order_by_field,
            .merge_strategy = query_opts.merge_strategy,
            .merge_path = merge_path,
            .fields = fields,
            .inherit_fields = inherit_fields,
            .nr_inherit_fields = nr_inherit_fields,
            .excluded_fields = excluded_fields,
            .fields_rpn_ctx = fields_rpn_ctx,
            .fields_expression = fields_expression,
        };

        SELVA_TRACE_BEGIN(cmd_find_sort_result);
        postprocess(&fin, resp, hierarchy, lang, query_opts.offset, query_opts.limit, &send_args, &traverse_result);
        SELVA_TRACE_END(cmd_find_sort_result);
    } else {
        selva_send_array_end(resp);
    }
}

static int Find_OnLoad(void) {
    selva_mk_command(CMD_ID_HIERARCHY_FIND, SELVA_CMD_MODE_PURE, "hierarchy.find", SelvaHierarchy_FindCommand);

    return 0;
}
SELVA_ONLOAD(Find_OnLoad);
