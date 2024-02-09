/*
 * Message encapsulation handling functions.
 * Send to a buffer (selva_string).
 * Recv not supported.
 * Copyright (c) 2023-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdint.h>
#include <sys/types.h>
#include "util/selva_string.h"
#include "selva_error.h"
#include "selva_proto.h"
#include "server.h"

static ssize_t buf_recv_frame(struct conn_ctx *ctx __unused)
{
    return SELVA_PROTO_ENOTSUP;
}

static int buf_flush(struct selva_server_response_out *resp __unused, bool last_frame __unused)
{
    return 0;
}

static ssize_t buf_send_buf(
        struct selva_server_response_out *restrict resp,
        const void *restrict buf, size_t len,
        enum server_send_flags flags __unused)
{
    return selva_string_append(resp->msg_buf, buf, len);
}

static ssize_t buf_send_file(
        struct selva_server_response_out *resp __unused,
        int fd __unused,
        size_t size __unused,
        enum server_send_flags flags __unused)
{
    return SELVA_PROTO_ENOTSUP;
}

static int buf_start_stream(
        struct selva_server_response_out *resp __unused,
        struct selva_server_response_out **stream_resp_out __unused)
{
    return SELVA_PROTO_ENOTSUP;
}

static void buf_cancel_stream(
        struct selva_server_response_out *resp __unused,
        struct selva_server_response_out *stream_resp __unused)
{
}

void message_buf_init(struct message_handlers_vtable *vt)
{
    *vt = (struct message_handlers_vtable){
        .recv_frame = buf_recv_frame,
        .flush = buf_flush,
        .send_buf = buf_send_buf,
        .send_file = buf_send_file,
        .start_stream = buf_start_stream,
        .cancel_stream = buf_cancel_stream,
    };
}
