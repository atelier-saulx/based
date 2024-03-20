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

#define MAX_RETRIES 3

/*
 * NOTICE: All logs are commented out for perf. Please keep it this way in prod.
 */

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
        /* FIXME flush */
    }

    i = __builtin_ffs(sendbufs->buf_res_map) - 1;
    sendbufs->buf_res_map &= ~(1 << i); /* Reserve it. */

    return sendbufs->buf[i];
}

static void sendbufs_put_buf(struct server_sendbufs *sendbufs, char *buf, size_t len)
{
    sendbufs->vec[sendbufs->i] = (struct iovec){
        .iov_base = buf,
        .iov_len = len,
    };
    sendbufs->i++;
}

static ssize_t sendbufs_flush(int fd, struct server_sendbufs *sendbufs) {
    int retry_count = 0;
    ssize_t res;
    size_t n = sendbufs->i;

retry:
    res = writev(fd, sendbufs->vec, sendbufs->i);
    if (res < 0) {
        switch (errno) {
        case EAGAIN:
#if EWOULDBLOCK != EAGAIN
        case EWOULDBLOCK:
#endif
        case ENOBUFS:
            if (retry_count++ > MAX_RETRIES) {
                return SELVA_PROTO_ENOBUFS; /* Not quite exact for EAGAIN but good enough. */
            } else {
                /*
                 * The safest thing to do is a blocking sleep so this
                 * thread/process will give the kernel some time to
                 * flush its buffers.
                 */
                const struct timespec tim = {
                    .tv_sec = 0,
                    .tv_nsec = 500, /* *sleeve-shaking* */
                };

                nanosleep(&tim, NULL);
            }

            goto retry;
        case EINTR:
            goto retry;
        case EBADF:
            return SELVA_PROTO_EBADF;
        case ENOMEM:
            return SELVA_PROTO_ENOMEM;
        case ECONNRESET:
            return SELVA_PROTO_ECONNRESET;
        case ENOTCONN:
            return SELVA_PROTO_ENOTCONN;
        case ENOTSUP:
#if ENOTSUP != EOPNOTSUPP
        case EOPNOTSUPP:
#endif
            return SELVA_PROTO_ENOTSUP;
        default:
            return SELVA_PROTO_EINVAL;
        }
    }
    sendbufs->i = 0;

    for (size_t i = 0; i < n; i++) {
        size_t buf_i = (size_t)(((ptrdiff_t)sendbufs->vec[i].iov_base - (ptrdiff_t)sendbufs->buf) / SELVA_PROTO_FRAME_SIZE_MAX);
        sendbufs->buf_res_map |= 1 << buf_i; /* Mark it free. */
    }

    return 0;
}

/**
 * Start a new frame in resp.
 * Must not be called if resp->ctx is not set.
 */
static void resp_frame_start(struct selva_server_response_out *resp)
{
    char *buf = sendbufs_get_next_buf(&resp->ctx->send);
    struct selva_proto_header *hdr = (struct selva_proto_header *)buf;

    /* Make sure it's really zeroed as initializers might leave some bits. */
    memset(hdr, 0, sizeof(*hdr));
    hdr->cmd = resp->cmd;
    hdr->flags = SELVA_PROTO_HDR_FREQ_RES | resp->frame_flags;
    hdr->seqno = htole32(resp->seqno);

    resp->buf_i = sizeof(*hdr);
    resp->frame_flags &= ~SELVA_PROTO_HDR_FFMASK;

    resp->buf = buf;
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
    bool last_frame = flags & SERVER_FLUSH_FLAG_LAST_FRAME;
    int err = 0; /* TODO should be not necessary to set */

    if (!resp->ctx) {
        return SELVA_PROTO_ENOTCONN;
    }

    struct server_sendbufs *sendbufs = &resp->ctx->send;

    if (resp->buf_i == 0) {
        if (last_frame) {
            resp_frame_start(resp);
        } else {
            /*
             * Nothing to flush.
             * Usually this means that the caller is starting a stream.
             */
            return 0;
        }
    }

    resp_frame_finalize(resp->buf, resp->buf_i, last_frame);

    sendbufs_put_buf(sendbufs, resp->buf, resp->buf_i);
    if ((flags & SERVER_FLUSH_FLAG_FORCE) ||
        sendbufs->i >= num_elem(sendbufs->vec) || sendbufs->buf_res_map == 0 ||
        (last_frame && !resp->ctx->flags.batch_active)) {
        sendbufs_flush(resp->ctx->fd, sendbufs);
    }
    resp->buf_i = 0;

    if (last_frame) {
        resp->cork = 0;
        maybe_uncork(resp, 0);
    }

    return err;
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
            resp_frame_start(resp);
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
    if (!resp->ctx) {
        return SELVA_PROTO_ENOTCONN;
    }

    maybe_cork(resp);

    /*
     * Create and send a new frame header with no payload and msg_bsize set.
     */
    sock_flush_frame_buf(resp, 0);
    resp_frame_start(resp);
    resp_frame_set_msg_len(resp, size);
    sock_flush_frame_buf(resp, SERVER_FLUSH_FLAG_FORCE);

    off_t bytes_sent = tcp_sendfile(resp->ctx->fd, fd, &(off_t){0}, size);
    if (bytes_sent != (off_t)size) {
        /*
         * Some of the errors are not SELVA_PROTO but ¯\_(ツ)_/¯
         */
        switch (errno) {
        case EBADF:
            bytes_sent = SELVA_PROTO_EBADF;
            break;
        case EFAULT:
        case EINVAL:
            bytes_sent = SELVA_EINVAL;
            break;
        case EIO:
            bytes_sent = SELVA_EIO;
            break;
        case ENOMEM:
        case EOVERFLOW:
            bytes_sent = SELVA_PROTO_ENOBUFS;
            break;
        case ESPIPE:
            bytes_sent = SELVA_PROTO_EPIPE;
            break;
        default:
            bytes_sent = SELVA_EGENERAL;
            break;
        }
    }

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

    r = tcp_read(fd, &ctx->recv_frame_hdr_buf, sizeof(ctx->recv_frame_hdr_buf));
    if (r <= 0) {
        /* Drop the connection immediately on error. */
        return SELVA_PROTO_ECONNRESET;
    } else if (r != (ssize_t)sizeof(struct selva_proto_header)) {
#if 0
        SELVA_LOG(SELVA_LOGL_DBG, "Header size mismatch: %zu", (size_t)r);
#endif
        return SELVA_PROTO_EBADMSG;
    }

    const ssize_t frame_bsize = le16toh(ctx->recv_frame_hdr_buf.frame_bsize); /* We know it's aligned. */
    const size_t frame_payload_size = frame_bsize - sizeof(struct selva_proto_header);

    if (frame_bsize > SELVA_PROTO_FRAME_SIZE_MAX ||
        frame_payload_size > SELVA_PROTO_FRAME_SIZE_MAX) {
#if 0
        SELVA_LOG(SELVA_LOGL_DBG, "Frame too large: %zu", frame_payload_size);
#endif
        return SELVA_PROTO_EBADMSG;
    } else if (frame_payload_size > 0) {
        /*
         * Resize the message buffer if necessary.
         */
        if (frame_payload_size > ctx->recv.msg_buf_size - ctx->recv.msg_buf_i) {
            realloc_ctx_msg_buf(ctx, ctx->recv.msg_buf_size + frame_payload_size);
        }

        r = tcp_read(fd, ctx->recv.msg_buf + ctx->recv.msg_buf_i, frame_payload_size);
        if (r <= 0) {
            /*
             * Just drop the connection immediately to keep the server side
             * connection handling simple. The client can handle connection
             * issues better.
             */
            return SELVA_PROTO_ECONNRESET;
        } else if (r != (ssize_t)frame_payload_size) {
#if 0
            SELVA_LOG(SELVA_LOGL_DBG, "Received frame has incorrect size");
#endif
            return SELVA_PROTO_EBADMSG;
        }

        ctx->recv.msg_buf_i += frame_payload_size;
    }

    /*
     * Verify the frame checksum.
     */
    if (!selva_proto_verify_frame_chk(&ctx->recv_frame_hdr_buf,
                                      ctx->recv.msg_buf + ctx->recv.msg_buf_i - frame_payload_size,
                                      frame_payload_size)) {
        /* Discard the frame */
        ctx->recv.msg_buf_i -= frame_payload_size;

#if 0
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
