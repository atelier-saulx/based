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

/* TODO Would be nice to have a C API */
static void set_schema(void)
{
    struct client_schema { /* from db/hierarchy/schema.c */
        uint32_t nr_emb_fields;
        char type[SELVA_NODE_TYPE_SIZE];
        uint8_t created_en;
        uint8_t updated_en;
        const char *field_schema_str;
        size_t field_schema_len;
        const char *edge_constraints_str; /* n * EdgeFieldDynConstraintParams */
        size_t edge_constraints_len;
    };
    struct {
        struct selva_proto_array arr;
        struct selva_proto_string type0_hdr;
        struct client_schema type0;
        /* Flexible/heap data for type0 */
        char type0_fs[1 * sizeof(struct SelvaFieldSchema)];
    } __packed buf = {
        .arr = {
            .type = SELVA_PROTO_ARRAY,
            .flags = 0,
            .length = htole32(1),
        },
        .type0_hdr = {
            .type = SELVA_PROTO_STRING,
            .bsize = htole32(sizeof(buf.type0) + sizeof(buf.type0_fs)),
        },
        .type0 = {
            .type = "op",
            .nr_emb_fields = 1,
            .created_en = false,
            .updated_en = false,
            .edge_constraints_len = 0,
            .field_schema_str = (void *)sizeof(struct client_schema), /* offset */
            .field_schema_len = sizeof(buf.type0_fs),
        },
    };

    memcpy(buf.type0_fs,
           &(struct SelvaFieldSchema){
               .field_name = "vc",
               .type1 = SELVA_FIELD_SCHEMA_TYPE_DATA,
               .type2 = SELVA_OBJECT_LONGLONG,
               .meta = 0,
           }, sizeof(struct SelvaFieldSchema));

    int err = selva_server_run_cmd(CMD_ID_HIERARCHY_SCHEMA_SET, 0, &buf, sizeof(buf));
    if (err) {
        SELVA_LOG(SELVA_LOGL_ERR, "Failed to update schema %s", selva_strerror(err));
    }
}

static void do_find(struct selva_string *out_buf)
{
#define FIND_EXPRESSION "#1 \"vc\" g I"
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
        (void)SelvaObject_SetLongLongStr(SelvaHierarchy_GetNodeObject(node), "vc", 2, i % 4);
    }
    ts_monotime(&ts_end);

    timespec_sub(&ts_diff, &ts_end, &ts_start);
    t = timespec2ms(&ts_diff);

    SELVA_LOG(SELVA_LOGL_INFO, "n: %d t: %f ms", N_MODIFY, t);

    ts_monotime(&ts_start);
    struct selva_string *out_buf = selva_string_create(NULL, 0, SELVA_STRING_MUTABLE);
    do_find(out_buf);
    ts_monotime(&ts_end);

    timespec_sub(&ts_diff, &ts_end, &ts_start);
    t = timespec2ms(&ts_diff);

    SELVA_LOG(SELVA_LOGL_INFO, "find took: %f ms", t);

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
}

static int Modify_OnLoad(void)
{
    SELVA_MK_COMMAND(CMD_ID_SELFAST, SELVA_CMD_MODE_MUTATE, selfast);

    return 0;
}
SELVA_ONLOAD(Modify_OnLoad);
