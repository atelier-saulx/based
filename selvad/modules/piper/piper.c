/*
 * Copyright (c) 2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <dlfcn.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include "endian.h"
#include "jemalloc.h"
#include "util/data-record.h"
#include "util/finalizer.h"
#include "util/selva_string.h"
#include "module.h"
#include "selva_error.h"
#include "selva_log.h"
#include "piper.h"

#define SWAP(x, y) do { typeof(x) SWAP = x; x = y; y = SWAP; } while (0)

enum pipe_glue_id {
    PIPE_GLUE_NIL = 0,
    PIPE_GLUE_FIND2FIND,
    PIPE_GLUE_FIND2MODIFY,
};

struct pipe_op {
    cmd_t cmd; /*!< Command id. */
    uint8_t _spare1;
    uint16_t _spare2;
    uint16_t _spare3;
    /**
     * Pipe glue function.
     * 0 for the first item.
     */
    uint16_t pipe_glue_id;
    const char *buf_str;
    uint64_t buf_len; /*!< Command msg length. */
};

typedef void (*pipe_glue_t)(cmd_t cmd_id,
                            int64_t ts,
                            const char *template_str,
                            size_t template_len,
                            struct selva_string *in_buf,
                            struct selva_string *out_buf);

struct pipe_mat_el {
    cmd_t src;
    cmd_t dst;
    enum pipe_glue_id pipe_glue_id;
    pipe_glue_t pipe_glue;
};

static pipe_glue_t find_pipe_glue(cmd_t src_cmd_id, cmd_t dst_cmd_id, enum pipe_glue_id glue_id)
{
    static const struct pipe_mat_el pipe_mat[] = {
        {
            .src = CMD_ID_HIERARCHY_FIND,
            .dst = CMD_ID_HIERARCHY_FIND,
            .pipe_glue_id = PIPE_GLUE_FIND2FIND,
            .pipe_glue = find2find_glue,
        },
        {
            .src = CMD_ID_HIERARCHY_FIND,
            .dst = CMD_ID_MODIFY,
            .pipe_glue_id = PIPE_GLUE_FIND2MODIFY,
            .pipe_glue = find2modify_glue,
        },
        {
            .pipe_glue_id = PIPE_GLUE_NIL /* end of list */
        }
    };
    const struct pipe_mat_el *el = pipe_mat;
    pipe_glue_t glue = NULL;

    while (el->pipe_glue_id != PIPE_GLUE_NIL) {
        if (el->pipe_glue_id == glue_id &&
            el->src == src_cmd_id &&
            el->dst == dst_cmd_id) {
            glue = el->pipe_glue;
            break;
        }
    }

    return glue;
}

static ssize_t read_op(struct pipe_op *op, const void *buf, size_t len)
{
    if (len < sizeof(*op)) {
        return SELVA_EINVAL;
    }

    memcpy(op, buf, sizeof(*op));
    op->pipe_glue_id = letoh(op->pipe_glue_id);
    DATA_RECORD_FIXUP_CSTRING_P(op, buf, len, buf);

    return sizeof(*op) + op->buf_len;
}

static void send_buf_response(
        struct selva_server_response_out *restrict resp,
        const struct selva_string *buf)
{
    TO_STR(buf);

    (void)selva_send_raw(resp, buf_str, buf_len);
}

/**
 * Pipe commands.
 * *Input:*
 * ```
 * +---------+----------+---------+----------+----
 * | pipe_op | cmd args | pipe_op | cmd_args | ...
 * +---------+----------+---------+----------+----
 * ```
 * Note that the input is not encapsulated in a selva_proto_string but sent as
 * raw data encapsulated in selva_proto frames.
 *
 * *Output:*
 * ```
 * +-------------------+------------------....-+----------------------+----
 * | selva_proto_array | selva_proto values... | seva_proto_array_end | ...
 * +-------------------+------------------....-+----------------------+----
 * ```
 * An array containing selva cmd response is sent for each command in the
 * original order. The responses are in the same format as the specified
 * commands would normally send them.
 */
static void cmd_pipe(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    __auto_finalizer struct finalizer fin;
    const int64_t ts = selva_resp_to_ts(resp);
    const void *p = buf;
    size_t left = len;
    cmd_t prev_cmd_id;
    struct selva_string *in_buf = selva_string_create(NULL, 0, SELVA_STRING_MUTABLE);
    struct selva_string *out_buf = selva_string_create(NULL, 0, SELVA_STRING_MUTABLE);
    struct pipe_op op;
    ssize_t res, err;

    finalizer_init(&fin);
    selva_string_auto_finalize(&fin, in_buf);
    selva_string_auto_finalize(&fin, out_buf);

    res = read_op(&op, p, left);
    if (res < 0) {
        selva_send_errorf(resp, res, "Failed to read the first pipe_op");
        return;
    } else {
        left -= res;
        p = (const char *)p + res;
    }

    /*
     * Run the first command.
     * The first command should write to the in_buf of the next command.
     */
    err = selva_server_run_cmd2buf(op.cmd, ts, op.buf_str, op.buf_len, in_buf);
    selva_send_array(resp, -1);
    send_buf_response(resp, in_buf);
    selva_send_array_end(resp);
    if (err) {
        /* Error was sent in buf. */
        return;
    }
    prev_cmd_id = op.cmd;

    while (left) {
        pipe_glue_t glue;

        selva_send_array(resp, -1);

        res = read_op(&op, p, left);
        if (res < 0) {
            selva_send_errorf(resp, res, "Failed to read pipe_op");
            return;
        } else {
            left -= res;
            p = (const char *)p + res;
        }

        glue = find_pipe_glue(prev_cmd_id, op.cmd, op.pipe_glue_id);
        if (!glue) {
            selva_send_errorf(resp, SELVA_ENOENT, "Glue not found");
            return;
        }

        glue(op.cmd, ts, op.buf_str, op.buf_len, in_buf, out_buf);
        send_buf_response(resp, out_buf);

        SWAP(in_buf, out_buf);
        selva_string_truncate(out_buf, 0);
        prev_cmd_id = op.cmd;

        selva_send_array_end(resp);
    }
}

IMPORT() {
    evl_import_main(selva_log);
    import_selva_server();
}

__constructor static void init(void)
{
    evl_module_init("piper");

    selva_mk_command(CMD_ID_PIPE, SELVA_CMD_MODE_MUTATE, "pipe", cmd_pipe);
}
