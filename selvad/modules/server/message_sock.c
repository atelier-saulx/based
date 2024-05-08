/*
 * Message encapsulation handling functions.
 * Send to a sock.
 * Recv from a sock.
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <errno.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <time.h>
#include <unistd.h>
#include "util/crc32c.h"
#include "util/tcp.h"
#include "endian.h"
#include "selva_error.h"
#include "selva_log.h"
#include "selva_proto.h"
#include "server.h"

/*
 * NOTICE: All logs are commented out for perf. Please keep it this way in prod.
 */
#define SERVER_MESSAGE_SOCK_ENABLE_DBG 0

/**
 * Cork the underlying socket if not yet corked.
 */
static void maybe_cork(struct selva_server_response_out *resp)
{
    struct conn_ctx *ctx = resp->ctx;

    if (ctx && !ctx->flags.corked) {
        tcp_cork(ctx->fd);
        ctx->flags.corked = 1;
    }
}

/**
 * Uncork the underlying socket if conditions are met.
 * Uncorks the underlying socket if response or conn_ctx properties don't require
 * corked socket.
 */
static void maybe_uncork(struct selva_server_response_out *resp, enum server_send_flags flags)
{
    struct conn_ctx *ctx = resp->ctx;

    if ((flags & SERVER_SEND_MORE) == 0 && resp->cork == 0 && ctx && !ctx->flags.batch_active) {
        tcp_uncork(ctx->fd);
        ctx->flags.corked = 0;
    }
}

static char *sendbufs_get_next_buf(struct server_sendbufs *sendbufs)
{
    int i;

    if (sendbufs->buf_res_map == 0) {
        /* TODO We could try to flush. */
        return NULL;
    }

    i = __builtin_ffs(sendbufs->buf_res_map) - 1;
    sendbufs->buf_res_map &= ~(1 << i); /* Reserve it. */

    return sendbufs->buf[i];
}

static bool sendbufs_put_buf(struct server_sendbufs *sendbufs, char *buf)
{
    assert(sendbufs->i < num_elem(sendbufs->vec));

    sendbufs->vec[sendbufs->i] = (struct iovec){
        .iov_base = buf,
        .iov_len = SELVA_PROTO_FRAME_SIZE_MAX,
    };
    sendbufs->i++;

    return sendbufs->i >= num_elem(sendbufs->vec) || sendbufs->buf_res_map == 0;
}

static ssize_t sendbufs_flush(int fd, struct server_sendbufs *sendbufs)
{
    ssize_t res;
    size_t n = sendbufs->i;
    uint16_t free_map = 0;

    /*
     * We need to make a bit mask now because sendbufs->vec will be
     * modifed by tcp_writev().
     * TODO We assume here that vecs 0 to n are in use but what if that's not the case?
     */
    for (size_t i = 0; i < n; i++) {
        size_t buf_i = (size_t)(((ptrdiff_t)sendbufs->vec[i].iov_base - (ptrdiff_t)sendbufs->buf) / SELVA_PROTO_FRAME_SIZE_MAX);
        free_map |= 1 << buf_i;
    }

    res = tcp_writev(fd, sendbufs->vec, n);
    if (res < 0) {
        return res;
    }
    sendbufs->i = 0;
    sendbufs->buf_res_map |= free_map;

    return 0;
}

/**
 * Start a new frame in resp.
 * Must not be called if resp->ctx is not set.
 */
[[nodiscard]]
static int resp_frame_start(struct selva_server_response_out *resp)
{
    char *buf = sendbufs_get_next_buf(&resp->ctx->send);
    struct selva_proto_header *hdr = (struct selva_proto_header *)buf;

    if (!buf) {
        return SELVA_ENOBUFS;
    }

    /* Make sure it's really zeroed as initializers might leave some bits. */
    memset(hdr, 0, sizeof(*hdr));
    hdr->cmd = resp->cmd;
    hdr->flags = SELVA_PROTO_HDR_FREQ_RES | resp->frame_flags;
    hdr->seqno = htole32(resp->seqno);

    resp->buf_i = sizeof(*hdr);
    resp->frame_flags &= ~SELVA_PROTO_HDR_FFMASK;

    resp->buf = buf;

    return 0;
}

/**
 * Set message length in resp frame.
 */
static void resp_frame_set_msg_len(struct selva_server_response_out *resp, size_t bsize)
{
    struct selva_proto_header *hdr = (struct selva_proto_header *)resp->buf;

    hdr->msg_bsize = bsize;
}

/**
 * Finalize the frame header in resp.
 */
static void resp_frame_finalize(void *buf, size_t bsize, int last_frame)
{
    struct selva_proto_header *hdr = (struct selva_proto_header *)buf;

    hdr->flags |= last_frame ? SELVA_PROTO_HDR_FLAST : 0;
    hdr->frame_bsize = htole16(bsize);
    hdr->chk = 0;
    hdr->chk = htole32(crc32c(0, buf, bsize));
}

static int sock_flush_frame_buf(struct selva_server_response_out *resp, enum server_flush_flags flags)
{
    const bool last_frame = flags & SERVER_FLUSH_FLAG_LAST_FRAME;

    if (!resp->ctx) {
        return SELVA_PROTO_ENOTCONN;
    }

    struct server_sendbufs *sendbufs = &resp->ctx->send;

    if (resp->buf_i == 0) {
        if (last_frame) {
            int err;

            err = resp_frame_start(resp);
            if (err) {
                return err;
            }
        } else {
            /*
             * Nothing to flush.
             * Usually this means that the caller is starting a stream.
             */
            return 0;
        }
    }

    resp_frame_finalize(resp->buf, resp->buf_i, last_frame);

    const bool needs_flush = sendbufs_put_buf(sendbufs, resp->buf);
    if ((flags & SERVER_FLUSH_FLAG_FORCE) || needs_flush ||
        (last_frame && !resp->ctx->flags.batch_active)) {
        sendbufs_flush(resp->ctx->fd, sendbufs);
    }
    resp->buf_i = 0;

    if (last_frame) {
        resp->cork = 0;
        maybe_uncork(resp, 0);
    }

    return 0;
}

static ssize_t sock_send_buf(struct selva_server_response_out *restrict resp, const void *restrict buf, size_t len, enum server_send_flags flags)
{
    size_t i = 0;
    ssize_t ret = (ssize_t)len;

    if (!resp->ctx) {
        return SELVA_PROTO_ENOTCONN;
    }

    maybe_cork(resp);
    while (i < len) {
        if (resp->buf_i >= SELVA_PROTO_FRAME_SIZE_MAX) {
            int err;

            err = sock_flush_frame_buf(resp, 0);
            if (err) {
                ret = err;
                break;
            }
            continue;
        }
        if (resp->buf_i == 0) {
            int err;

            err = resp_frame_start(resp);
            if (err) {
                return err;
            }
        }

        char *frame_buf = resp->buf;
        const size_t wr = min(SELVA_PROTO_FRAME_SIZE_MAX - resp->buf_i, len - i);
        memcpy(frame_buf + resp->buf_i, (uint8_t *)buf + i, wr);
        i += wr;
        resp->buf_i += wr;
    }

    maybe_uncork(resp, (ret < 0) ? flags & ~SERVER_SEND_MORE : flags);
    return ret;
}

static ssize_t sock_send_file(struct selva_server_response_out *resp, int fd, size_t size, enum server_send_flags flags)
{
    int err;
    off_t bytes_sent;

    if (!resp->ctx) {
        return SELVA_PROTO_ENOTCONN;
    }

    maybe_cork(resp);

    /*
     * Create and send a new frame header with no payload and msg_bsize set.
     */
    sock_flush_frame_buf(resp, 0);
    err = resp_frame_start(resp);
    if (err) {
        return err;
    }
    resp_frame_set_msg_len(resp, size);
    sock_flush_frame_buf(resp, SERVER_FLUSH_FLAG_FORCE);

    bytes_sent = tcp_sendfile(resp->ctx->fd, fd, &(off_t){0}, size);
    maybe_uncork(resp, (bytes_sent < 0) ? flags & ~SERVER_SEND_MORE : flags);

    return bytes_sent;
}

static int sock_start_stream(struct selva_server_response_out *resp, struct selva_server_response_out **stream_resp_out)
{
    struct selva_server_response_out *stream_resp;

    if (!resp->ctx) {
        return SELVA_PROTO_ENOTCONN;
    }

    if (resp->frame_flags & SELVA_PROTO_HDR_STREAM) {
        /* Stream already started. */
        return SELVA_PROTO_EALREADY;
    }

    stream_resp = alloc_stream_resp(resp->ctx);
    if (!stream_resp) {
        return SELVA_PROTO_ENOBUFS;
    }

    sock_flush_frame_buf(resp, 0);
    resp->frame_flags |= SELVA_PROTO_HDR_STREAM;
    memcpy(stream_resp, resp, sizeof(*stream_resp));
    stream_resp->cork = 0; /* Streams should not be corked at response level. */

    *stream_resp_out = stream_resp;
    return 0;
}

static void sock_cancel_stream(struct selva_server_response_out *resp, struct selva_server_response_out *stream_resp)
{
    resp->frame_flags &= ~SELVA_PROTO_HDR_STREAM;
    free_stream_resp(stream_resp);
}

static ssize_t sock_recv_frame(struct conn_ctx *ctx)
{
    int fd = ctx->fd;
    ssize_t r;

    if (ctx->recv.msg_buf_size - ctx->recv.msg_buf_i < SELVA_PROTO_FRAME_SIZE_MAX) {
        realloc_ctx_msg_buf(ctx, ctx->recv.msg_buf_size + SELVA_PROTO_FRAME_PAYLOAD_SIZE_MAX);
    }

    struct iovec rd[2] = {
        {
            .iov_base = &ctx->recv_frame_hdr_buf,
            .iov_len = sizeof(ctx->recv_frame_hdr_buf),
        },
        {
            .iov_base = ctx->recv.msg_buf + ctx->recv.msg_buf_i,
            .iov_len = SELVA_PROTO_FRAME_PAYLOAD_SIZE_MAX,
        }
    };

    r = tcp_readv(fd, rd, num_elem(rd));
    if (r < 0) {
#if SERVER_MESSAGE_SOCK_ENABLE_DBG
        SELVA_LOG(SELVA_LOGL_DBG, "Sock read error: %s", selva_strerror(r));
#endif
        return r;
    } else if (r != (ssize_t)SELVA_PROTO_FRAME_SIZE_MAX) {
#if SERVER_MESSAGE_SOCK_ENABLE_DBG
        SELVA_LOG(SELVA_LOGL_DBG, "Incorrent frame size: %zd", r);
#endif
        return SELVA_PROTO_EBADMSG;
    }

    const ssize_t frame_bsize = le16toh(ctx->recv_frame_hdr_buf.frame_bsize);
    const size_t frame_payload_size = frame_bsize - sizeof(struct selva_proto_header);

    if (frame_payload_size > SELVA_PROTO_FRAME_SIZE_MAX) {
#if SERVER_MESSAGE_SOCK_ENABLE_DBG
        SELVA_LOG(SELVA_LOGL_DBG, "Frame too large: %zu/%zu", frame_payload_size, frame_bsize);
#endif
        return SELVA_PROTO_EBADMSG;
    }
    ctx->recv.msg_buf_i += frame_payload_size;

    /*
     * Verify the frame checksum.
     */
    if (!selva_proto_verify_frame_chk(&ctx->recv_frame_hdr_buf,
                                      ctx->recv.msg_buf + ctx->recv.msg_buf_i - frame_payload_size,
                                      frame_payload_size)) {
        /* Discard the frame */
        ctx->recv.msg_buf_i -= frame_payload_size;

#if SERVER_MESSAGE_SOCK_ENABLE_DBG
        SELVA_LOG(SELVA_LOGL_DBG, "Checksum mismatch");
#endif
        return SELVA_PROTO_EBADMSG;
    }

    return frame_bsize;
}

void message_sock_init(struct message_handlers_vtable *vt)
{
    *vt = (struct message_handlers_vtable){
        .recv_frame = sock_recv_frame,
        .flush = sock_flush_frame_buf,
        .send_buf = sock_send_buf,
        .send_file = sock_send_file,
        .start_stream = sock_start_stream,
        .cancel_stream = sock_cancel_stream,
    };
}
