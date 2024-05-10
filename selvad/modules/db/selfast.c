#include <stdio.h>
#include <time.h>
#include <string.h>
#include "endian.h"
#include "jemalloc.h"
#include "util/bitmap.h"
#include "util/cstrings.h"
#include "util/ctime.h"
#include "util/data-record.h"
#include "util/finalizer.h"
#include "util/selva_string.h"
#include "util/timestamp.h"
#include "selva_error.h"
#include "selva_log.h"
#include "selva_proto.h"
#include "selva_server.h"
#include "selva_io.h"
#include "rpn.h"
#include "comparator.h"
#include "edge.h"
#include "hierarchy.h"
#include "schema.h"
#include "selva_db_types.h"
#include "selva_object.h"
#include "selva_onload.h"
#include "typestr.h"
#include "find_cmd.h"

#define N_MODIFY 2000000
//#define N_MODIFY 10000000
#define OP_SCHEMA {'o', 'p', 0, 5 /* SCHEMA_INTEGER */, 0}

/* TODO Would be nice to have a C API */
static void set_schema(void)
{
    struct {
        struct selva_proto_string type0_hdr;
        char type0[sizeof((char [])OP_SCHEMA)];
    } __packed buf = {
        .type0_hdr = {
            .type = SELVA_PROTO_STRING,
            .bsize = htole32(sizeof(buf.type0)),
        },
        .type0 = OP_SCHEMA,
    };

    int err = selva_server_run_cmd(CMD_ID_HIERARCHY_SCHEMA_SET, 0, &buf, sizeof(buf));
    if (err) {
        SELVA_LOG(SELVA_LOGL_ERR, "Failed to update schema %s", selva_strerror(err));
    }
}

static void do_find(struct selva_string *out_buf)
{
#define FIND_EXPRESSION "#1 \"0\" g I"
    struct {
        struct selva_proto_string lang_hdr;
        struct selva_proto_string query_opts_hdr;
        struct SelvaFind_QueryOpts query_opts;
        struct selva_proto_string nodes_hdr;
        Selva_NodeId bogus;
        struct selva_proto_string expr_hdr;
        char expr[sizeof(FIND_EXPRESSION) - 1];
    } __packed buf = {
        .lang_hdr = {
            .type = SELVA_PROTO_STRING,
            .bsize = 0,
        },
        .query_opts_hdr = {
            .type = SELVA_PROTO_STRING,
            .bsize = sizeof(buf.query_opts),
        },
        .query_opts = {
            .dir = SELVA_HIERARCHY_TRAVERSAL_ALL,
            .limit = 10000,
            .res_type = SELVA_FIND_QUERY_RES_IDS,
        },
        .nodes_hdr = {
            .type = SELVA_PROTO_STRING,
            .bsize = sizeof(buf.bogus),
        },
        .bogus = "1337",
        .expr_hdr = {
            .type = SELVA_PROTO_STRING,
            .bsize = sizeof(FIND_EXPRESSION) - 1,
        },
        .expr = FIND_EXPRESSION,
    };

    (void)selva_server_run_cmd2buf(CMD_ID_HIERARCHY_FIND, ts_now(), &buf, sizeof(buf), out_buf);
}

struct fast_find_ctx {
    struct rpn_ctx *rpn_ctx;
    struct rpn_expression *filter;
    ssize_t limit;
    struct selva_string *out_buf;
};

static int fast_find_cb(
        struct SelvaHierarchy *hierarchy,
        const struct SelvaHierarchyTraversalMetadata *,
        struct SelvaHierarchyNode *node,
        void *arg)
{
    struct fast_find_ctx *ctx = (struct fast_find_ctx *)arg;
    struct rpn_ctx *rpn_ctx = ctx->rpn_ctx;
    int take = false;

    rpn_set_reg(rpn_ctx, 0, node->id, SELVA_NODE_ID_SIZE, RPN_SET_REG_FLAG_IS_NAN);
    rpn_ctx->data.hierarchy = hierarchy;
    rpn_ctx->data.node = node;
    rpn_ctx->data.obj = SelvaHierarchy_GetNodeObject(node);

    (void)rpn_bool(rpn_ctx, ctx->filter, &take);
    if (take) {
        selva_string_append(ctx->out_buf, node->id, SELVA_NODE_ID_SIZE);
        if (ctx->limit > 0) ctx->limit--;
    }

    return ctx->limit == 0;
}


static void do_fast_find(struct selva_string *out_buf)
{
    __auto_free_rpn_ctx struct rpn_ctx *rpn_ctx = rpn_init(1);
    __auto_free_rpn_expression struct rpn_expression *filter = rpn_compile("#1 \"0\" g I");
    struct SelvaHierarchyCallback cb = {
        .node_cb = fast_find_cb,
        .node_arg = &(struct fast_find_ctx){
            .rpn_ctx = rpn_ctx,
            .filter = filter,
            .limit = 1000,
            .out_buf = out_buf,
        },
    };

    (void)SelvaHierarchy_TraverseAll(main_hierarchy, &cb);
}

static void selfast(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    struct timespec ts_start, ts_end, ts_diff;
    double t;

    set_schema();

    ts_monotime(&ts_start);
    for (size_t i = 0; i < N_MODIFY; i++) {
        char node_id[SELVA_NODE_ID_SIZE + 1]; /* +1 to fix snprintf */
        struct SelvaHierarchyNode *node;
        int err;

        snprintf(node_id, sizeof(node_id), "op%.*zx", (int)(SELVA_NODE_ID_SIZE - 2), i);

        err = SelvaHierarchy_UpsertNode(main_hierarchy, node_id, &node);
        if (err) {
            SELVA_LOG(SELVA_LOGL_ERR, "UpsertNode(\"%.*s\") failed: %s", (int)SELVA_NODE_ID_SIZE, node_id, selva_strerror(err));
            return;
        }
        (void)SelvaObject_SetLongLongStr(SelvaHierarchy_GetNodeObject(node), "0", 2, i % 4);
    }
    ts_monotime(&ts_end);

    timespec_sub(&ts_diff, &ts_end, &ts_start);
    t = timespec2ms(&ts_diff);

    SELVA_LOG(SELVA_LOGL_INFO, "n: %d t: %f ms", N_MODIFY, t);

#if 0
    ts_monotime(&ts_start);
    struct selva_string *out_buf = selva_string_create(NULL, 0, SELVA_STRING_MUTABLE);
    do_find(out_buf);
    ts_monotime(&ts_end);

    timespec_sub(&ts_diff, &ts_end, &ts_start);
    t = timespec2ms(&ts_diff);

    SELVA_LOG(SELVA_LOGL_INFO, "find took: %f ms", t);
#endif

    /*
     * Print response.
     */
#if 0
    size_t msg_len;
    const char *msg = selva_string_to_str(out_buf, &msg_len);
    SELVA_LOG(SELVA_LOGL_ERR, "len: %zu", msg_len);
    selva_proto_print(stdout, msg, msg_len);
    selva_string_free(out_buf);
#endif

    ts_monotime(&ts_start);
    struct selva_string *out_buf = selva_string_create(NULL, 0, SELVA_STRING_MUTABLE);
    do_fast_find(out_buf);
    ts_monotime(&ts_end);

    timespec_sub(&ts_diff, &ts_end, &ts_start);
    t = timespec2ms(&ts_diff);

    SELVA_LOG(SELVA_LOGL_INFO, "find took: %f ms", t);

#if 0
    size_t out_len;
    const char *out_str = selva_string_to_str(out_buf, &out_len);
    for (size_t i = 0; i < out_len; i += SELVA_NODE_ID_SIZE) {
        SELVA_LOG(SELVA_LOGL_INFO, "%.*s", (int)SELVA_NODE_ID_SIZE, &out_str[i]);
    }
#endif
}

static int Modify_OnLoad(void)
{
    SELVA_MK_COMMAND(CMD_ID_SELFAST, SELVA_CMD_MODE_MUTATE, selfast);

    return 0;
}
SELVA_ONLOAD(Modify_OnLoad);
