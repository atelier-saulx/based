/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <arpa/inet.h>
#include <string.h>
#include "util/net.h"
#include "endian.h"
#include "selva_error.h"
#include "selva_log.h"
#include "selva_proto.h"
#include "server.h"

static int handle_frame(struct conn_ctx *ctx)
{
    struct selva_proto_header *hdr = &ctx->recv_frame_hdr_buf;
    const uint32_t seqno = le32toh(hdr->seqno);
    const unsigned frame_state = hdr->flags & SELVA_PROTO_HDR_FFMASK;
#if 0
    char peer[CONN_STR_LEN];

    conn_to_str(ctx, peer, sizeof(peer));
    SELVA_LOG(SELVA_LOGL_DBG, "Received a frame. client: %s seqno: %d bytes: %d",
              peer,
              (int)seqno,
              (int)frame_bsize);
#endif

    if (ctx->flags.recv_state == CONN_CTX_RECV_STATE_NEW) {
        ctx->cur_seqno = seqno;
        size_t msg_bsize = le32toh(hdr->msg_bsize);

        /*
         * This is supposed to be the beginning of a new sequence.
         */
        if (!(frame_state & SELVA_PROTO_HDR_FFIRST)) {
            char peer[CONN_STR_LEN];

            conn_to_str(ctx, peer, sizeof(peer));
            SELVA_LOG(SELVA_LOGL_WARN, "Sequence tracking error client: %s seqno: %d",
                      peer,
                      seqno);
            /*
             * Drop the connection.
             * It's the easiest way because the client might be rogue or
             * in a broken state.
             */
            return SELVA_PROTO_EBADMSG;
        }

        /*
         * msg_bsize isn't necessarily set but if it is then we can alloc a
         * big enough buffer right away.
         */
        if (msg_bsize > SELVA_PROTO_MSG_SIZE_MAX) {
            char peer[CONN_STR_LEN];

            conn_to_str(ctx, peer, sizeof(peer));
            SELVA_LOG(SELVA_LOGL_WARN, "Invalid message size. client: %s seqno: %d msg_bsize: %zu",
                      peer, seqno, msg_bsize);

            return SELVA_PROTO_EBADMSG;
        } else if (ctx->recv.msg_buf_size < msg_bsize) {
            realloc_ctx_msg_buf(ctx, msg_bsize);
        }
    } else if (ctx->flags.recv_state == CONN_CTX_RECV_STATE_FRAGMENT) {
        if (seqno != ctx->cur_seqno) {
            char peer[CONN_STR_LEN];

            conn_to_str(ctx, peer, sizeof(peer));
            SELVA_LOG(SELVA_LOGL_WARN, "Unexpected frame seqno. client: %s seqno: %d expected_seqno: %d",
                      peer, seqno, ctx->cur_seqno);
            /*
             * This is the point where we might want to do reassembly.
             */

            return SELVA_PROTO_EBADMSG; /* Drop. */
        }
        if (frame_state & SELVA_PROTO_HDR_FFIRST) {
            char peer[CONN_STR_LEN];

            conn_to_str(ctx, peer, sizeof(peer));
            SELVA_LOG(SELVA_LOGL_WARN, "Received invalid frame. client: %s seqno: %d",
                      peer, seqno);
            ctx->flags.recv_state = CONN_CTX_RECV_STATE_NEW;
            return 0;
        }
    } else {
        char peer[CONN_STR_LEN];

        conn_to_str(ctx, peer, sizeof(peer));
        SELVA_LOG(SELVA_LOGL_ERR, "Invalid connection state. client: %s", peer);
        return SELVA_PROTO_EBADMSG; /* Drop the connection. */
    }

    return 0;
}

int server_recv_message(struct conn_ctx *ctx)
{
    /*
     * TODO Currently we don't do frame reassembly for multiple simultaneous
     *      sequences and expect the client to only send one message sequence
     *      at time.
     */

    if (ctx->flags.recv_state == CONN_CTX_RECV_STATE_NEW) {
        /*
         * Reset the message buffer state.
         */
        ctx->recv.msg_buf_i = 0;
    }

    if (ctx->recv.msg_buf_size - ctx->recv.msg_buf_i < SELVA_PROTO_FRAME_PAYLOAD_SIZE_MAX) {
        realloc_ctx_msg_buf(ctx, ctx->recv.msg_buf_size + SELVA_PROTO_FRAME_PAYLOAD_SIZE_MAX);
    }

    /* Only sockets are suported for now. */
    ssize_t frame_bsize = message_handlers[SERVER_MESSAGE_HANDLER_SOCK].recv_frame(ctx);
    if (frame_bsize < 0) {
        return frame_bsize;
    }

    int err = handle_frame(ctx);
    if (err) {
        return err;
    }

    /*
     * Setting the flag is enough because we'll eventually cork the socket
     * and further attempts to uncork will be blocked as long as this flag
     * is set.
     */
    ctx->flags.batch_active = !!(ctx->recv_frame_hdr_buf.flags & SELVA_PROTO_HDR_BATCH);

    /*
     * Update recv message reassembly state.
     */
    if (ctx->recv_frame_hdr_buf.flags & SELVA_PROTO_HDR_FLAST) {
        ctx->flags.recv_state = CONN_CTX_RECV_STATE_NEW;
        return 1;
    } else {
        ctx->flags.recv_state = CONN_CTX_RECV_STATE_FRAGMENT;
        return 0;
    }
}
