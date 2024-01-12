/*
 * Message encapsulation handling functions.
 * Copyright (c) 2023-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdint.h>
#include <sys/types.h>
#include "selva_error.h"
#include "selva_proto.h"
#include "../../tunables.h"
#include "server.h"

static ssize_t none_recv_frame(struct conn_ctx *ctx __unused)
{
    return SELVA_PROTO_ECONNRESET;
}

static int none_flush(struct selva_server_response_out *resp __unused, bool last_frame __unused)
{
    return 0;
}

static ssize_t none_send_buf(
        struct selva_server_response_out *restrict resp __unused,
        const void *restrict buf __unused, size_t len,
        enum server_send_flags flags __unused)
{
    return len;
}

static ssize_t none_send_file(
        struct selva_server_response_out *resp __unused,
        int fd __unused,
        size_t size __unused,
        enum server_send_flags flags __unused)
{
    return size;
}

static int none_start_stream(
        struct selva_server_response_out *resp __unused,
        struct selva_server_response_out **stream_resp_out __unused)
{
    return 0;
}

static void none_cancel_stream(
        struct selva_server_response_out *resp __unused,
        struct selva_server_response_out *stream_resp __unused)
{
}

void message_none_init(struct message_handlers_vtable *vt)
{
    *vt = (struct message_handlers_vtable){
        .recv_frame = none_recv_frame,
        .flush = none_flush,
        .send_buf = none_send_buf,
        .send_file = none_send_file,
        .start_stream = none_start_stream,
        .cancel_stream = none_cancel_stream,
    };
}
