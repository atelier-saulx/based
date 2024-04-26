/*
 * Copyright (c) 2024 SAULX
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
#include "../db/include/modify.h"

[[nodiscard]]
static void *build_modify(
        Selva_NodeId node_id,
        uint32_t nr_changes,
        const char *template_str, size_t template_len,
        size_t *msg_len)
{
    struct modify_header hdr = {
        .flags = FLAG_UPDATE,
        .nr_changes = nr_changes,
    };
    memcpy(hdr.node_id, node_id, SELVA_NODE_ID_SIZE);

    const size_t len = sizeof(hdr) + template_len;
    char *buf = selva_malloc(len);
    memcpy(buf, &hdr, sizeof(hdr));
    memcpy(buf + sizeof(hdr), template_str, template_len);

    *msg_len = len;
    return buf;
}

void find2modify_glue(
        cmd_t cmd_id,
        int64_t ts,
        const char *template_str,
        size_t template_len,
        struct selva_string * restrict in_buf,
        struct selva_string * restrict out_buf)
{
    __auto_finalizer struct finalizer fin;
    TO_STR(in_buf);
    struct selva_string **ids = NULL;
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

    /*
     * The modify template should start with nr_changes.
     */
    if (template_len <= sizeof(uint32_t)) {
        static const char err_msg[] = "Invalid modify template";

        piper_error(out_buf, SELVA_EINVAL, err_msg, sizeof(err_msg) - 1);
    }
    uint32_t nr_changes;
    memcpy(&nr_changes, template_str, sizeof(nr_changes));

    for (int i = 0; i < nr_ids; i++) {
        Selva_NodeId node_id;
        void *msg_buf;
        size_t msg_len;

        selva_string2node_id(node_id, ids[i]);
        msg_buf = build_modify(node_id, nr_changes, template_str + sizeof(nr_changes), template_len - sizeof(nr_changes), &msg_len);

        (void)selva_server_run_cmd2buf(cmd_id, ts, msg_buf, msg_len, out_buf);
        selva_free(msg_buf);
    }
}
