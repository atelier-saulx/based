/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <float.h>
#include "endian.h"
#include "util/auto_free.h"
#include "util/data-record.h"
#include "util/finalizer.h"
#include "util/funmap.h"
#include "util/ptag.h"
#include "util/selva_string.h"
#include "util/svector.h"
#include "selva_error.h"
#include "selva_log.h"
#include "selva_proto.h"
#include "selva_server.h"
#include "selva_db.h"
#include "db_config.h"
#include "hierarchy.h"
#include "parsers.h"
#include "rpn.h"
#include "selva_index.h"
#include "selva_object.h"
#include "selva_onload.h"
#include "selva_set.h"
#include "subscriptions.h"
#include "traversal.h"
#include "query.h"
#include "count_filter_regs.h"
#include "find.h"
#include "aggregate_cmd.h"

struct AggregateCommand_Args;
typedef int (*agg_func)(struct SelvaObject *, struct AggregateCommand_Args *);

struct AggregateCommand_Args {
    struct finalizer *fin;
    struct selva_server_response_out *resp;
    struct FindCommand_Args find_args;

    agg_func agg;
    enum SelvaHierarchy_AggregateType aggregate_type;
    int uniq_initialized;

    /*
     * Aggregation state.
     */
    long long int aggregation_result_int;
    double aggregation_result_double;
    size_t item_count;
    struct {
        struct SelvaSet set_rmstring;
        struct SelvaSet set_double;
        struct SelvaSet set_longlong;
    } uniq;
};

static void init_uniq(struct AggregateCommand_Args *args) {
    if (args->aggregate_type == SELVA_AGGREGATE_TYPE_COUNT_UNIQUE_FIELD) {
        SelvaSet_Init(&args->uniq.set_rmstring, SELVA_SET_TYPE_STRING);
        SelvaSet_Init(&args->uniq.set_double, SELVA_SET_TYPE_DOUBLE);
        SelvaSet_Init(&args->uniq.set_longlong, SELVA_SET_TYPE_LONGLONG);
        args->uniq_initialized = 1;
    } else {
        args->uniq_initialized = 0;
    }
}

static void destroy_uniq(struct AggregateCommand_Args *args) {
    if (args->uniq_initialized) {
        SelvaSet_Destroy(&args->uniq.set_rmstring);
        SelvaSet_Destroy(&args->uniq.set_double);
        SelvaSet_Destroy(&args->uniq.set_longlong);
        args->uniq_initialized = 0;
    }
}

static void count_uniq(struct AggregateCommand_Args *args) {
    if (args->uniq_initialized && args->aggregate_type == SELVA_AGGREGATE_TYPE_COUNT_UNIQUE_FIELD) {
        args->aggregation_result_int = SelvaSet_Size(&args->uniq.set_rmstring) +
                                       SelvaSet_Size(&args->uniq.set_double) +
                                       SelvaSet_Size(&args->uniq.set_longlong);
    }
}

static int agg_fn_count_obj(struct SelvaObject *obj __unused, struct AggregateCommand_Args* args) {
    args->item_count++;
    return 0;
}

static int get_first_field_value_double(struct SelvaObject *obj, struct SelvaObject *fields_obj, double *out) {
    SVector *fields;
    struct SVectorIterator it;
    const struct selva_string *field;
    int err;

    err = SelvaObject_GetArrayStr(fields_obj, "0", 1, NULL, &fields);
    if (err || !fields) {
        return SELVA_ENOENT;
    }

    SVector_ForeachBegin(&it, fields);
    while ((field = SVector_Foreach(&it))) {
        struct SelvaObjectAny value;

        err = SelvaObject_GetAny(obj, field, &value);
        if (!err) {
            if (value.type == SELVA_OBJECT_LONGLONG) {
                *out = (double)value.ll;
                return 0;
            } else if (value.type == SELVA_OBJECT_DOUBLE) {
                *out = value.d;
                return 0;
            }
        }
    }

    return SELVA_ENOENT;
}

static int agg_fn_count_uniq_obj(struct SelvaObject *obj, struct AggregateCommand_Args* args) {
    struct SelvaObject *fields_obj = args->find_args.send_param.fields;
    SVector *fields;
    struct SVectorIterator it;
    const struct selva_string *field;
    int err;

    err = SelvaObject_GetArrayStr(fields_obj, "0", 1, NULL, &fields);
    if (err || !fields) {
        return SELVA_ENOENT;
    }

    SVector_ForeachBegin(&it, fields);
    while ((field = SVector_Foreach(&it))) {
        struct SelvaObjectAny value;

        err = SelvaObject_GetAny(obj, field, &value);
        if (!err) {
            if (value.type == SELVA_OBJECT_DOUBLE) {
                SelvaSet_Add(&args->uniq.set_double, value.d);
                break;
            } else if (value.type == SELVA_OBJECT_LONGLONG) {
                SelvaSet_Add(&args->uniq.set_longlong, value.ll);
                break;
            } else if (value.type == SELVA_OBJECT_STRING) {
                struct selva_string *tmp = selva_string_dup(value.str, 0);

                if (SelvaSet_Add(&args->uniq.set_rmstring, tmp)) {
                    selva_string_free(tmp);
                }
                break;
            }
        }
    }

    return 0;
}

static int agg_fn_sum_obj(struct SelvaObject *obj, struct AggregateCommand_Args* args) {
    struct SelvaObject *fields_obj = args->find_args.send_param.fields;
    double d;

    if (!get_first_field_value_double(obj, fields_obj, &d)) {
        args->aggregation_result_double += d;
        args->item_count++;
    }

    return 0;
}

static int agg_fn_avg_obj(struct SelvaObject *obj, struct AggregateCommand_Args* args) {
    return agg_fn_sum_obj(obj, args);
}

static int agg_fn_min_obj(struct SelvaObject *obj, struct AggregateCommand_Args* args) {
    struct SelvaObject *fields_obj = args->find_args.send_param.fields;
    double d;

    if (!get_first_field_value_double(obj, fields_obj, &d)) {
        if (d < args->aggregation_result_double) {
            args->aggregation_result_double = d;
        }
    }

    return 0;
}

static int agg_fn_max_obj(struct SelvaObject *obj, struct AggregateCommand_Args* args) {
    struct SelvaObject *fields_obj = args->find_args.send_param.fields;
    double d;

    if (!get_first_field_value_double(obj, fields_obj, &d)) {
        if (d > args->aggregation_result_double) {
            args->aggregation_result_double = d;
        }
    }

    return 0;
}

static int agg_fn_none(struct SelvaObject *obj __unused, struct AggregateCommand_Args* args __unused) {
    return 0;
}

static agg_func agg_funcs[] = {
    agg_fn_count_obj,
    agg_fn_count_uniq_obj,
    agg_fn_sum_obj,
    agg_fn_avg_obj,
    agg_fn_min_obj,
    agg_fn_max_obj,
    agg_fn_none,
};

GENERATE_STATIC_FUNMAP(get_agg_func, agg_funcs, int, num_elem(agg_funcs) - 2);

static int AggregateCommand_NodeCb(
        struct SelvaHierarchy *hierarchy,
        const struct SelvaHierarchyTraversalMetadata *traversal_metadata,
        struct SelvaHierarchyNode *node,
        void *arg) {
    Selva_NodeId nodeId;
    struct AggregateCommand_Args *args = (struct AggregateCommand_Args *)arg;
    struct rpn_ctx *rpn_ctx = args->find_args.rpn_ctx;
    int take = find_process_skip(&args->find_args);

    SelvaHierarchy_GetNodeId(nodeId, node);

    args->find_args.acc_tot++;
    if (take && rpn_ctx) {
        int err;

        rpn_set_reg(rpn_ctx, 0, nodeId, SELVA_NODE_ID_SIZE, RPN_SET_REG_FLAG_IS_NAN);
        rpn_ctx->data.hierarchy = hierarchy;
        rpn_ctx->data.node = node;
        rpn_ctx->data.obj = SelvaHierarchy_GetNodeObject(node);

        /*
         * Resolve the expression and get the result.
         */
        err = rpn_bool(rpn_ctx, args->find_args.filter, &take);
        if (err) {
            SELVA_LOG(SELVA_LOGL_ERR, "Expression failed (node: \"%.*s\"): \"%s\"",
                      (int)SELVA_NODE_ID_SIZE, nodeId,
                      rpn_str_error[err]);
            return 1;
        }
    }

    take = take && find_process_offset(&args->find_args);
    if (take) {
        const int sort = !!args->find_args.send_param.order_field;

        args->find_args.acc_take++;

        if (!sort) {
            ssize_t *nr_nodes = args->find_args.nr_nodes;
            ssize_t * restrict limit = args->find_args.limit;
            int err;

            err = args->agg(SelvaHierarchy_GetNodeObject(node), args);
            if (err) {
                SELVA_LOG(SELVA_LOGL_ERR, "Failed to handle field(s) of the node: \"%.*s\" err: \"%s\"",
                          (int)SELVA_NODE_ID_SIZE, nodeId,
                          selva_strerror(err));
            }

            *nr_nodes = *nr_nodes + 1;

            *limit = *limit - 1;
            if (*limit == 0) {
                return 1;
            }
        } else {
            struct TraversalOrderItem *item;

            item = SelvaTraversalOrder_CreateNodeOrderItem(args->fin, args->find_args.lang, traversal_metadata, node, args->find_args.send_param.order_field);
            if (item) {
                SVector_Insert(args->find_args.result, item);
            } else {
                Selva_NodeId nodeId;

                /*
                 * It's not so easy to make the response fail at this point.
                 * Given that we shouldn't generally even end up here in real
                 * life, it's fairly ok to just log the error and return what
                 * we can.
                 */

                SelvaHierarchy_GetNodeId(nodeId, node);
                SELVA_LOG(SELVA_LOGL_ERR, "Failed to create an order result item for node: %.*s field: \"%s\"",
                          (int)SELVA_NODE_ID_SIZE, nodeId,
                          selva_string_to_str(args->find_args.send_param.order_field, NULL));
            }
        }
    }

    return 0;
}

static int AggregateCommand_ArrayObjectCb(
        union SelvaObjectArrayForeachValue value,
        enum SelvaObjectType subtype,
        void *arg) {
    struct SelvaObject *obj = value.obj;
    struct AggregateCommand_Args *args = (struct AggregateCommand_Args *)arg;
    struct rpn_ctx *rpn_ctx = args->find_args.rpn_ctx;
    int take = find_process_skip(&args->find_args);

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
            SELVA_LOG(SELVA_LOGL_ERR, "Set register obj value failed: \"%s\"",
                      rpn_str_error[err]);
            return 1;
        }
        rpn_ctx->data.obj = obj;

        /*
         * Resolve the expression and get the result.
         */
        err = rpn_bool(rpn_ctx, args->find_args.filter, &take);
        if (err) {
            SELVA_LOG(SELVA_LOGL_ERR, "Expression failed: \"%s\"",
                      rpn_str_error[err]);
            return 1;
        }
    }

    take = take && find_process_offset(&args->find_args);
    if (take) {
        const int sort = !!args->find_args.send_param.order_field;

        if (!sort) {
            ssize_t *nr_nodes = args->find_args.nr_nodes;
            ssize_t * restrict limit = args->find_args.limit;

            (void)args->agg(obj, args);

            *nr_nodes = *nr_nodes + 1;

            *limit = *limit - 1;
            if (*limit == 0) {
                return 1;
            }
        } else {
            struct TraversalOrderItem *item;

            item = SelvaTraversalOrder_CreateObjectOrderItem(args->fin, args->find_args.lang, obj, args->find_args.send_param.order_field);
            if (item) {
                SVector_Insert(args->find_args.result, item);
            } else {
                /*
                 * It's not so easy to make the response fail at this point.
                 * Given that we shouldn't generally even end up here in real
                 * life, it's fairly ok to just log the error and return what
                 * we can.
                 */
                SELVA_LOG(SELVA_LOGL_ERR, "Failed to create an object order item using field: \"%.s\"",
                          selva_string_to_str(args->find_args.send_param.order_field, NULL));
            }
        }
    }

    return 0;
}

static size_t AggregateCommand_AggregateOrderResult(
        void *arg,
        ssize_t offset,
        ssize_t limit,
        SVector *order_result) {
    struct AggregateCommand_Args *args = (struct AggregateCommand_Args *)arg;
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
        struct SelvaHierarchyNode *node = PTAG_GETP(item->tagp);
        int err;

        assert(PTAG_GETTAG(item->tagp) == TRAVERSAL_ORDER_ITEM_PTYPE_NODE);

        if (limit-- == 0) {
            break;
        }

        if (node) {
            err = args->agg(SelvaHierarchy_GetNodeObject(node), args);
        } else {
            err = SELVA_HIERARCHY_ENOENT;
        }
        if (err) {
            SELVA_LOG(SELVA_LOGL_ERR, "Failed to aggregate field(s) of the node: \"%.*s\" err: \"%s\"",
                      (int)SELVA_NODE_ID_SIZE, item->node_id,
                      selva_strerror(err));
            continue;
        }

        len++;
    }

    return len;
}

static size_t AggregateCommand_AggregateOrderArrayResult(
        void *arg,
        ssize_t offset,
        ssize_t limit,
        SVector *order_result) {
    struct AggregateCommand_Args *args = (struct AggregateCommand_Args *)arg;
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
        int err;

        if (limit-- == 0) {
            break;
        }

        assert(PTAG_GETTAG(item->tagp) == TRAVERSAL_ORDER_ITEM_PTYPE_OBJ);
        err = args->agg(PTAG_GETP(item->tagp), args);
        if (err) {
            selva_send_null(args->resp);
            SELVA_LOG(SELVA_LOGL_ERR, "Failed to aggregate field(s) of the node: \"%.*s\" err: \"%s\"",
                      (int)SELVA_NODE_ID_SIZE, item->node_id,
                      selva_strerror(err));
        }

        len++;
    }

    return len;
}

static size_t postprocess_aggregate_sort(
        void *arg,
        ssize_t offset,
        ssize_t limit,
        SVector *order_result) {
    const struct TraversalOrderItem *first_item = SVector_Peek(order_result);
    const enum TraversalOrderItemPtype result_type = first_item
        ? PTAG_GETTAG(first_item->tagp)
        : TRAVERSAL_ORDER_ITEM_PTYPE_NULL;

    /*
     * Note that the previous will fail/be invalid if the items in the `result`
     * SVector are not type of struct TraversalOrderItem and created by one of
     * the SelvaTraversalOrder_Create functions.
     */

    switch (result_type) {
    case TRAVERSAL_ORDER_ITEM_PTYPE_NULL:
        break;
    case TRAVERSAL_ORDER_ITEM_PTYPE_OBJ:
        return AggregateCommand_AggregateOrderArrayResult(arg, offset, limit, order_result);
    case TRAVERSAL_ORDER_ITEM_PTYPE_NODE:
        return AggregateCommand_AggregateOrderResult(arg, offset, limit, order_result);
    }

    return 0;
}

static int fixup_query_opts(struct SelvaAggregate_QueryOpts *qo, const char *base, size_t size) {
    static_assert(sizeof(qo->agg_fn) == sizeof(int32_t));
    qo->agg_fn = le32toh(qo->agg_fn);

    static_assert(sizeof(qo->dir) == sizeof(int32_t));
    qo->dir = le32toh(qo->dir);

    static_assert(sizeof(qo->order) == sizeof(int32_t));
    qo->order = le32toh(qo->order);

    static_assert(sizeof(qo->skip) == sizeof(int64_t));
    qo->skip = le64toh(qo->skip);

    static_assert(sizeof(qo->offset) == sizeof(int64_t));
    qo->offset = le64toh(qo->offset);

    static_assert(sizeof(qo->limit) == sizeof(int64_t));
    qo->limit = le64toh(qo->limit);

    DATA_RECORD_FIXUP_CSTRING_P(qo, base, size,
            dir_opt, edge_filter, edge_filter_regs, index_hints, order_by_field);
    return 0;
}

static size_t AggregateCommand_SendAggregateResult(const struct AggregateCommand_Args *args) {
    switch (args->aggregate_type) {
    case SELVA_AGGREGATE_TYPE_COUNT_NODE:
        selva_send_ll(args->resp, args->item_count);
        break;
    case SELVA_AGGREGATE_TYPE_COUNT_UNIQUE_FIELD:
        selva_send_ll(args->resp, args->aggregation_result_int);
        break;
    case SELVA_AGGREGATE_TYPE_AVG_FIELD:
        selva_send_double(args->resp, args->aggregation_result_double / (double)args->item_count);
        break;
    default:
        selva_send_double(args->resp, args->aggregation_result_double);
        break;
    }

    return 0;
}

/**
 * hierarchy.aggregate lang SelvaAggregate_QueryOpts fields ids filter_expr filter_args
 */
static void SelvaHierarchy_AggregateCommand(struct selva_server_response_out *resp, const void *buf, size_t buf_len) {
    __auto_finalizer struct finalizer fin;
    SelvaHierarchy *hierarchy = main_hierarchy;
    int argc, err;

    finalizer_init(&fin);

    const int ARGV_FILTER_EXPR     = 4;
    const int ARGV_FILTER_ARGS     = 5;

    struct selva_string *lang;
    const char *query_opts_str;
    size_t query_opts_len;
    struct SelvaAggregate_QueryOpts query_opts;
    SVECTOR_AUTOFREE(order_result); /*!< for order result. */
    const struct selva_string *ids;
    struct selva_string *fields_raw = NULL;
    struct selva_string *filter_expr = NULL;
    struct selva_string **filter_expr_args = NULL;

    argc = selva_proto_scanf(&fin, buf, buf_len, "%p, %.*s, %p, %p, %p, ...",
                             &lang,
                             &query_opts_len, &query_opts_str,
                             &ids,
                             &fields_raw,
                             &filter_expr,
                             &filter_expr_args
                            );
    if (argc < 4) {
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

    if (query_opts.agg_fn < 0 || query_opts.agg_fn > SELVA_AGGREGATE_TYPE_MAX_FIELD) {
        selva_send_errorf(resp, SELVA_EINVAL, "Invalid function");
        return;
    }

    if (!(query_opts.dir & (
          SELVA_HIERARCHY_TRAVERSAL_NONE |
          SELVA_HIERARCHY_TRAVERSAL_NODE |
          SELVA_HIERARCHY_TRAVERSAL_ALL |
          SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD |
          SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD |
          SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION |
          SELVA_HIERARCHY_TRAVERSAL_EXPRESSION |
          SELVA_HIERARCHY_TRAVERSAL_FIELD |
          SELVA_HIERARCHY_TRAVERSAL_BFS_FIELD)
         ) || __builtin_popcount(query_opts.dir) > 1
       ) {
        selva_send_errorf(resp, SELVA_EINVAL, "Invalid dir");
        return;
    }

    struct selva_string *dir_expr = NULL;
    __auto_free_rpn_ctx struct rpn_ctx *traversal_rpn_ctx = NULL;
    __auto_free_rpn_expression struct rpn_expression *traversal_expression = NULL;
    if (query_opts.dir & (
         SELVA_HIERARCHY_TRAVERSAL_EDGE_FIELD |
         SELVA_HIERARCHY_TRAVERSAL_BFS_EDGE_FIELD |
         SELVA_HIERARCHY_TRAVERSAL_FIELD |
         SELVA_HIERARCHY_TRAVERSAL_BFS_FIELD) &&
        query_opts.dir_opt_len == 0) {
        selva_send_errorf(resp, SELVA_EINVAL, "Missing ref field");
        return;
    } else if (query_opts.dir & (SELVA_HIERARCHY_TRAVERSAL_BFS_EXPRESSION |
                                 SELVA_HIERARCHY_TRAVERSAL_EXPRESSION)) {
        dir_expr = selva_string_create(query_opts_str, query_opts_len, 0);
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

        const int nr_regs = query_count_filter_regs(query_opts.edge_filter_regs_str, query_opts.edge_filter_regs_len);
        if (nr_regs < 0) {
            selva_send_errorf(resp, nr_regs, "Invalid edge_filter_regs");
        }

        edge_filter_ctx = rpn_init(1 + nr_regs);
        edge_filter = rpn_compile_len(query_opts.edge_filter_str, query_opts.edge_filter_len);
        if (!edge_filter) {
            selva_send_errorf(resp, SELVA_RPN_ECOMP, "edge_filter");
            return;
        }

        if (nr_regs) {
            enum rpn_error rpn_err;

            rpn_err = rpn_set_regs(edge_filter_ctx, query_opts.edge_filter_regs_str, query_opts.edge_filter_regs_len);
            if (rpn_err) {
                selva_send_errorf(resp, SELVA_EGENERAL, "Failed to initialize edge_filter registers: %s", rpn_str_error[rpn_err]);
                return;
            }
        }
    }

    double initial_double_val = 0;
    if (query_opts.agg_fn == SELVA_AGGREGATE_TYPE_MAX_FIELD) {
        initial_double_val = DBL_MIN;
    } else if (query_opts.agg_fn == SELVA_AGGREGATE_TYPE_MIN_FIELD) {
        initial_double_val = DBL_MAX;
    }

    struct selva_string **index_hints = NULL;
    int nr_index_hints = 0;
    if (query_opts.index_hints_len && selva_glob_config.index_max > 0) {
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

    /*
     * Parse fields.
     */
    selvaobject_autofree struct SelvaObject *fields = NULL;
    err = parse_string_set(&fin, fields_raw, &fields, "", NULL);
    if (err) {
        selva_send_errorf(resp, err, "Parsing fields list failed");
        return;
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

        if (rpn_set_string_regs(rpn_ctx, nr_reg, filter_expr_args)) {
            selva_send_errorf(resp, SELVA_EGENERAL, "Failed to initialize RPN registers");
            return;
        }
    }

    if (query_opts.order != SELVA_RESULT_ORDER_NONE) {
        SelvaTraversalOrder_InitOrderResult(&order_result, query_opts.order, query_opts.limit);
    }

    /*
     * Run for each NODE_ID.
     */
    struct AggregateCommand_Args args = {
        .fin = &fin,
        .resp = resp,
        .aggregate_type = query_opts.agg_fn,
        .agg = get_agg_func(query_opts.agg_fn),
        .aggregation_result_int = 0,
        .aggregation_result_double = initial_double_val,
        .item_count = 0,
    };

    init_uniq(&args);

    ssize_t nr_nodes = 0;
    for (size_t i = 0; i < ids_len; i += SELVA_NODE_ID_SIZE) {
        Selva_NodeId nodeId;

        Selva_NodeIdCpy(nodeId, ids_str + i);
        if (nodeId[0] == '\0') {
            /* Just skip empty IDs. */
            continue;
        }

        const size_t nr_ind_icb = max(nr_index_hints, 1);
        struct SelvaIndexControlBlock *ind_icb[nr_ind_icb];
        int ind_select = -1; /* Selected index. The smallest of all found. */

        memset(ind_icb, 0, nr_ind_icb * sizeof(struct SelvaIndexControlBlock *));

        if (nr_index_hints > 0) {
            /*
             * Select the best index res set.
             */
            ind_select = SelvaIndex_AutoMulti(hierarchy, query_opts.dir, query_opts.dir_opt_str, query_opts.dir_opt_len, nodeId, query_opts.order, order_by_field, nr_index_hints, index_hints, ind_icb);

            /*
             * If the index is already ordered then we don't need to sort the
             * response. This won't work if we have multiple nodeIds because
             * obviously the order might differ and we may not have an ordered
             * index for each id.
             */
            if (ind_select >= 0 &&
                ids_len == SELVA_NODE_ID_SIZE &&
                SelvaIndex_IsOrdered(ind_icb[ind_select], query_opts.order, order_by_field)) {
                query_opts.order = SELVA_RESULT_ORDER_NONE;
                order_by_field = NULL; /* This controls sorting in the callback. */
            }
        }

        /*
         * Run BFS/DFS.
         */
        ssize_t tmp_limit = -1;
        args.find_args = (struct FindCommand_Args){
            .lang = lang,
            .nr_nodes = &nr_nodes,
            .skip = ind_select >= 0 ? 0 : SelvaTraversal_GetSkip(query_opts.dir, query_opts.skip),
            .offset = (query_opts.order == SELVA_RESULT_ORDER_NONE) ? query_opts.offset : 0,
            .limit = (query_opts.order == SELVA_RESULT_ORDER_NONE) ? &query_opts.limit : &tmp_limit,
            .rpn_ctx = rpn_ctx,
            .filter = filter_expression,
            .send_param.fields = fields,
            .send_param.excluded_fields = NULL,
            .send_param.order = query_opts.order,
            .send_param.order_field = order_by_field,
            .result = &order_result,
        };

        if (query_opts.limit == 0) {
            break;
        }

        if (ind_select >= 0) {
            /*
             * There is no need to run the filter again if the indexing was
             * executing the same filter already.
             */
            if (filter_expr && !selva_string_cmp(filter_expr, index_hints[ind_select])) {
                args.find_args.rpn_ctx = NULL;
                args.find_args.filter = NULL;
            }

            err = SelvaIndex_Traverse(hierarchy, ind_icb[ind_select], AggregateCommand_NodeCb, &args);
        } else {
            struct query_traverse qt = {
                .dir = query_opts.dir,
                .dir_opt_str = query_opts.dir_opt_str,
                .dir_opt_len = query_opts.dir_opt_len,

                .traversal_rpn_ctx = traversal_rpn_ctx,
                .traversal_expression = traversal_expression,

                .edge_filter_ctx = edge_filter_ctx,
                .edge_filter = edge_filter,

                .node_cb = AggregateCommand_NodeCb,
                .ary_cb = AggregateCommand_ArrayObjectCb,
            };

            err = query_traverse(hierarchy, nodeId, &qt, &args);
        }
        if (err != 0) {
            /*
             * We can't send an error to the client at this point so we'll just log
             * it and ignore the error.
             */
            SELVA_LOG(SELVA_LOGL_ERR, "Aggregate failed. dir: %s node_id: \"%.*s\" err: \"%s\"",
                      SelvaTraversal_Dir2str(query_opts.dir),
                      (int)SELVA_NODE_ID_SIZE, nodeId,
                      selva_strerror(err));
        }

        /*
         * Do index accounting.
         */
        SelvaIndex_AccMulti(ind_icb, nr_index_hints, ind_select, args.find_args.acc_take, args.find_args.acc_tot);
    }

    /*
     * If an order request was requested then nothing was send to the client yet
     * and we need to do it now.
     */
    if (query_opts.order != SELVA_RESULT_ORDER_NONE) {
        struct AggregateCommand_Args ord_args = {
            .fin = &fin,
            .resp = resp,
            .aggregate_type = query_opts.agg_fn,
            .agg = get_agg_func(query_opts.agg_fn),
            .aggregation_result_int = 0,
            .aggregation_result_double = initial_double_val,
            .item_count = 0,
            .find_args = {
                .send_param.fields = fields,
            }
        };

        init_uniq(&ord_args);
        nr_nodes = postprocess_aggregate_sort(&ord_args, query_opts.offset, query_opts.limit, &order_result);
        count_uniq(&args);
        AggregateCommand_SendAggregateResult(&ord_args);
        destroy_uniq(&args);
    } else {
        count_uniq(&args);
        AggregateCommand_SendAggregateResult(&args);
    }

    destroy_uniq(&args);
}

static int Aggregate_OnLoad(void) {
    selva_mk_command(CMD_ID_HIERARCHY_AGGREGATE, SELVA_CMD_MODE_PURE, "hierarchy.aggregate", SelvaHierarchy_AggregateCommand);

    return 0;
}
SELVA_ONLOAD(Aggregate_OnLoad);
