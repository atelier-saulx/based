/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <arpa/inet.h>
#include <assert.h>
#include <stdatomic.h>
#include <string.h>
#include <unistd.h>
#include "jemalloc.h"
#include "util/align.h"
#include "util/bitmap.h"
#include "util/net.h"
#include "event_loop.h"
#include "selva_proto.h"
#include "selva_log.h"
#include "selva_server.h"
#include "../../tunables.h"
#include "server.h"

#define STREAM_WRITER_RETRY_SEC 15

#define ALL_STREAMS_FREE ((1 << SERVER_MAX_STREAMS) - 1)
#define CLIENTS_SIZE(nr) (ALIGNED_SIZE((nr) * sizeof(struct conn_ctx), DCACHE_LINESIZE))

/**
 * Client conn_ctx allocation map.
 * 0 = in use;
 * 1 = free.
 */
static struct bitmap *clients_map;
static struct conn_ctx *clients;

void conn_init(int max_clients)
{
    if (max_clients == 0) {
        SELVA_LOG(SELVA_LOGL_CRIT, "max_clients can't be 0");
        abort();
    }

    clients_map = selva_malloc(BITMAP_ALLOC_SIZE(max_clients));
    clients_map->nbits = max_clients;
    for (int i = 0; i < max_clients; i++) {
        bitmap_set(clients_map, i);
    }

    clients = selva_aligned_alloc(DCACHE_LINESIZE, CLIENTS_SIZE(max_clients));
    /*
     * Clean a a part of the memory to enforce actual allocation (avoid page fault).
     * This will make first connections to the server faster but avoid
     * overcommit in case the limit was exaggerated.
     */
    memset(clients, 0, CLIENTS_SIZE(max_clients >> 1));
}

struct conn_ctx *alloc_conn_ctx(void)
{
    int i;
    struct conn_ctx *ctx = NULL;

    i = bitmap_ffs(clients_map);
    if (i >= 0) {
        bitmap_clear(clients_map, i);
        ctx = &clients[i];
        memset(ctx, 0, sizeof(*ctx));
        atomic_init(&ctx->streams.free_map, ALL_STREAMS_FREE);
        ctx->flags.inuse = i;
        ctx->flags.corked = 0;
        ctx->send.buf_res_map = SERVER_SEND_BUFS_MASK;
    }

    return ctx;
}

static void retry_free_con_ctx(struct event *, void *arg)
{
    SELVA_LOG(SELVA_LOGL_DBG, "Retrying free_conn_ctx(%p)", arg);
    free_conn_ctx((struct conn_ctx *)arg);
}

void free_conn_ctx(struct conn_ctx *ctx)
{
    unsigned free_map = atomic_load(&ctx->streams.free_map);

    if (free_map != ALL_STREAMS_FREE && ctx->pubsub_ch_mask != 0) {
        pubsub_teardown(ctx);
        free_map = atomic_load(&ctx->streams.free_map);
    }

    if (free_map == ALL_STREAMS_FREE) {
        int i = ctx->flags.inuse;

        close(ctx->fd);
        ctx->flags.inuse = 0;
        selva_free(ctx->recv.msg_buf);
        bitmap_set(clients_map, i);
    } else {
        /* Wait for stream writers to terminate. */
        const struct timespec t = {
            .tv_sec = STREAM_WRITER_RETRY_SEC,
            .tv_nsec = 0,
        };

        SELVA_LOG(SELVA_LOGL_DBG, "conn_ctx (%p) %d stream(s) busy, waiting...",
                  ctx,
                  SERVER_MAX_STREAMS - __builtin_popcount(free_map));

        (void)evl_set_timeout(&t, retry_free_con_ctx, ctx);
    }
}

void realloc_ctx_msg_buf(struct conn_ctx *ctx, size_t new_size)
{
    ctx->recv.msg_buf = selva_realloc(ctx->recv.msg_buf, new_size);
    ctx->recv.msg_buf_size = new_size;
}

struct selva_server_response_out *alloc_stream_resp(struct conn_ctx *ctx)
{
    unsigned old_free_map, new_free_map, i;

    do {
        old_free_map = atomic_load(&ctx->streams.free_map);
        i = __builtin_ffs(old_free_map);
        if (i-- == 0) {
            return NULL;
        }

        new_free_map = old_free_map & ~(1 << i);
    } while (!atomic_compare_exchange_weak(&ctx->streams.free_map, &old_free_map, new_free_map));

    return &ctx->streams.stream_resp[i];
}

void free_stream_resp(struct selva_server_response_out *stream_resp)
{
    struct conn_ctx *ctx;
    unsigned old_free_map, new_free_map;

    assert(stream_resp->ctx);
    ctx = stream_resp->ctx;

    do {
        old_free_map = atomic_load(&ctx->streams.free_map);
        new_free_map = old_free_map | 1 << (unsigned)((ptrdiff_t)stream_resp - (ptrdiff_t)ctx->streams.stream_resp);
    } while (!atomic_compare_exchange_weak(&ctx->streams.free_map, &old_free_map, new_free_map));

    stream_resp->ctx = NULL;
}

struct conn_ctx *get_conn_by_idx(size_t idx)
{
    if (!bitmap_get(clients_map, idx)) {
        return &clients[idx];
    }

    return NULL;
}

size_t conn_to_str(struct conn_ctx *ctx, char buf[CONN_STR_LEN], size_t bsize)
{
    return fd_to_str(ctx->fd, buf, bsize);
}

void send_client_list(struct selva_server_response_out *resp)
{
    size_t max_clients = clients_map->nbits;

    selva_send_array(resp, -1);
    for (size_t i = 0; i < max_clients; i++) {
        if (!bitmap_get(clients_map, i)) {
            struct conn_ctx *client = &clients[i];
            char buf[CONN_STR_LEN];
            size_t len;

            selva_send_array(resp, 6 << 1);

            selva_send_str(resp, "idx", 3);
            selva_send_ll(resp, i);

            selva_send_str(resp, "addr", 4);
            len = conn_to_str(client, buf, sizeof(buf));
            selva_send_str(resp, buf, len);

            selva_send_str(resp, "fd", 2);
            selva_send_ll(resp, client->fd);

            selva_send_str(resp, "recv_msg_buf_size", 17);
            selva_send_ll(resp, client->recv.msg_buf_size);

            selva_send_str(resp, "nr_streams", 10);
            selva_send_ll(resp, SERVER_MAX_STREAMS - __builtin_popcount(atomic_load(&client->streams.free_map)));

            selva_send_str(resp, "last_cmd", 8);
            selva_send_ll(resp, client->recv_frame_hdr_buf.cmd);
        }
    }
    selva_send_array_end(resp);
}
