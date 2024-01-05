/*
 * Copyright (c) 2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/types.h>
#include "jemalloc.h"
#include "util/finalizer.h"
#include "util/selva_proto_builder.h"
#include "util/selva_string.h"
#include "selva_db_types.h"
#include "selva_error.h"
#include "selva_log.h"
#include "piper.h"

static const char *make_ids_str(struct finalizer *fin, struct selva_string **ids, int nr_ids, size_t *len_out)
{
    char *ids_str;
    const size_t ids_len = nr_ids * SELVA_NODE_ID_SIZE;

    ids_str = selva_malloc(ids_len + 1);
    for (int i = 0; i < nr_ids; i++) {
        snprintf(ids_str + i * SELVA_NODE_ID_SIZE, SELVA_NODE_ID_SIZE + 1, "%s", selva_string_to_str(ids[0], NULL));
    }
    finalizer_add(fin, ids_str, selva_free);

    *len_out = ids_len;
    return ids_str;
}

static void build_query(
        struct finalizer *fin,
        struct selva_proto_builder_msg *msg,
        const char *template_str, size_t template_len,
        struct selva_string **ids, int nr_ids)
{
    const char *lang_str;
    size_t lang_len;
    const char *query_opts_str;
    size_t query_opts_len;
    struct selva_string **rest = NULL;
    int argc;
    const char *ids_str;
    size_t ids_len;

    argc = selva_proto_scanf(fin, template_str, template_len, "%.*s, %.*s, , ...",
                             &lang_len, &lang_str,
                             &query_opts_len, &query_opts_str,
                             &ids,
                             &rest
                            );
    if (argc < 0) {
        static const char err_msg[] = "Failed to parse find args template";

        selva_proto_builder_insert_error(msg, argc, err_msg, sizeof(err_msg) - 1);
        goto out;
    } else if (argc < 3) {
        selva_proto_builder_insert_error(msg, SELVA_EINVAL, "Wrong arity", 11);
        goto out;
    }

    ids_str = make_ids_str(fin, ids, nr_ids, &ids_len);

    selva_proto_builder_init(msg);
    selva_proto_builder_insert_string(msg, lang_str, lang_len);
    selva_proto_builder_insert_string(msg, query_opts_str, query_opts_len);
    selva_proto_builder_insert_string(msg, ids_str, ids_len);

    if (rest) {
        for (size_t i = 0; rest[i]; i++) {
            size_t len;
            const char *str = selva_string_to_str(rest[i], &len);

            selva_proto_builder_insert_string(msg, str, len);
        }
    }

out:
    selva_proto_builder_end(msg);
}

void find2find_glue(
        cmd_t cmd_id,
        int64_t ts,
        const char *template_str,
        size_t template_len,
        struct selva_string *in_buf,
        struct selva_string *out_buf)
{
    __auto_finalizer struct finalizer fin;
    TO_STR(in_buf);
    struct selva_string **ids = NULL;
    struct selva_proto_builder_msg msg;
    int nr_ids, err;

    finalizer_init(&fin);

    /*
     * RFE Technically buffering into selva_strings would be unnecessary if we'd
     * have a nice way to loop over the strings values or at least a way to use
     * selva_proto_scanf() to get an array of pointers to the strings.
     */
    err = selva_proto_buf2strings(&fin, in_buf_str, in_buf_len, &ids);
    if (err) {
        static const char err_msg[] = "Failed to parse the piped response";

        piper_error(out_buf, SELVA_EINVAL, err_msg, sizeof(err_msg) - 1);
        return;
    }
    nr_ids = err;

    build_query(&fin, &msg, template_str, template_len, ids, nr_ids);

    (void)selva_server_run_cmd2buf(cmd_id, ts, msg.buf, msg.bsize, out_buf);
    selva_proto_builder_deinit(&msg);
}
