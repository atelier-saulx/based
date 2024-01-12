/*
 * Selva Server Module.
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

struct conn_ctx;
struct selva_server_response_out;
struct selva_string;

typedef uint16_t pubsub_ch_mask_t;

enum server_message_handler {
    SERVER_MESSAGE_HANDLER_NONE = 0, /*!< Discard server responses and receive nothing. */
    SERVER_MESSAGE_HANDLER_SOCK, /*!< Receive messages from conn sock and send responses back to the same conn sock. */
    SERVER_MESSAGE_HANDLER_BUF, /*!< Send server responses to a selva_string buffer. */
    NR_SERVER_MESSAGE_HANDLERS
};

/**
 * Outgoing response.
 */
struct selva_server_response_out {
    struct conn_ctx *ctx; /*!< Can be NULL. */
    struct {
        /**
         * Cork the full response.
         * Should not be used with streams.
         */
        uint8_t cork : 1;
        /**
         * Response type.
         * Use enum server_message_handler_type.
         */
        uint8_t resp_msg_handler: 2;
    };
    typeof_field(struct selva_proto_header, cmd) cmd;
    typeof_field(struct selva_proto_header, flags) frame_flags;
    typeof_field(struct selva_proto_header, seqno) seqno;
    int last_error; /*!< Last error. Set by send_error functions. 0 if none. */
    int64_t ts; /*!< Timestamp when the command execution started. */
    size_t buf_i; /*!< Index into buf */
    union {
        /**
         * Used with SERVER_MESSAGE_HANDLER_SOCKSERVER_MESSAGE_HANDLER_SOCK.
         */
        struct selva_string *msg_buf;
        /**
         * Used with SERVER_MESSAGE_HANDLER_SOCK.
         */
        _Alignas(struct selva_proto_header) char buf[SELVA_PROTO_FRAME_SIZE_MAX];
    };
};

/**
 * Client connection descriptor.
 */
struct conn_ctx {
    int fd; /*<! The socket associated with this connection. */
    struct {
        /**
         * Set if the connection is active.
         * The value is an index in clients_map of conn.c.
         */
        uint16_t inuse: 16;
        uint8_t corked: 1; /*!< Set if we have corked the socket. (avoids some unnecessary syscalls) */
        /**
         * Batch mode activated.
         * When set the server attempts to pack more responses together before
         * sending (uncorking the socket). This adds some latency to receiving the
         * responses but makes processing on the server-side more efficient.
         */
        uint8_t batch_active: 1;

        enum {
            CONN_CTX_RECV_STATE_NEW, /*!< Waiting for the next seq; No recv in progress. */
            CONN_CTX_RECV_STATE_FRAGMENT, /*!< Waiting for the next frame of a sequence. */
        } recv_state: 1;
    } flags;

    typeof_field(struct selva_proto_header, seqno) cur_seqno; /*!< Currently incoming sequence. */

    alignas(uint64_t) struct selva_proto_header recv_frame_hdr_buf;
    char *recv_msg_buf; /*!< Buffer for the currently incoming message. */
    size_t recv_msg_buf_size;
    size_t recv_msg_buf_i;

    /**
     * Open streams.
     */
    struct {
        _Atomic unsigned int free_map; /*!< A bit is unset if the corresponding stream_resp is in use. */
        struct selva_server_response_out stream_resp[SERVER_MAX_STREAMS];
    } streams;

    pubsub_ch_mask_t pubsub_ch_mask; /*!< Subscribed to the channels in this mask. */

    /**
     * Application specific data.
     */
    struct {
        int tim_hrt; /*!< Server heartbeat timer. */
    } app;
} __attribute__((aligned(DCACHE_LINESIZE)));

enum server_send_flags {
    SERVER_SEND_MORE = 0x01,
};

/**
 * @addtogroup conn
 * Client connection.
 * Alloc, free, and describe client connections.
 * @{
 */

void conn_init(int max_clients);

/**
 * Allocate a new client connection descriptor.
 * Caller must set `ctx->fd`.
 */
[[nodiscard]]
struct conn_ctx *alloc_conn_ctx(void);

/**
 * Free a client connection descriptor.
 * This function will call `close(ctx->fd)` and it should not be closed before.
 */
void free_conn_ctx(struct conn_ctx *ctx);

void realloc_ctx_msg_buf(struct conn_ctx *ctx, size_t new_size);

/**
 * Allocate a stream_resp structure.
 * Note that it's the callers responsibility to initialize the returned struct.
 */
struct selva_server_response_out *alloc_stream_resp(struct conn_ctx *ctx);

/**
 * Free a stream_resp structure.
 */
void free_stream_resp(struct selva_server_response_out *stream_resp);

struct conn_ctx *get_conn_by_idx(size_t idx);

#ifdef INET_ADDRSTRLEN
/**
 * Describe a client connection.
 */
size_t conn_to_str(struct conn_ctx *ctx, char buf[CONN_STR_LEN], size_t bsize);
#endif

void send_client_list(struct selva_server_response_out *resp);

/**
 * @}
 */

/**
 * @addtogroup pubsub
 * Publish–subscribe.
 * @{
 */

void pubsub_init(void);

/**
 * Forcefully remove all streams belonging to ctx from pubsub.
 */
void pubsub_teardown(struct conn_ctx *ctx);

/**
 * Gracefully unsubscribe all pubsub streams.
 */
void pubsub_unsubscribe_all(struct conn_ctx *ctx);

/**
 * Unsubscribe ctx from channel.
 */
int pubsub_unsubscribe(struct conn_ctx *ctx, unsigned ch_id);

/**
 * @}
 */

/**
 * Receive a chuck of a message.
 * @returns <0 if receive failed; =0 if more frames are needed to reassemble the message; =1 if the message is now received completely.
 */
int server_recv_message(struct conn_ctx *ctx);

struct message_handlers_vtable {
    /**
     * Receive a single frame from a connection.
     */
    ssize_t (*recv_frame)(struct conn_ctx *ctx);
    /**
     * Flush outgoing frame buffer.
     * Sends the data currently in the outgoing buffer.
     * @param last_frame if set the current message will be terminated.
     */
    int (*flush)(struct selva_server_response_out *resp, bool last_frame);
    /**
     * Send buffer as a part of the response resp.
     * The data is sent as is framed within selva_proto frames. Typically the buf
     * should point to one of the selva_proto value structs. The buffer might be
     * split into multiple frames and the receiver must reassemble the data. All
     * data within a sequence will be always delivered in the sending order.
     * @returns Return bytes sent; Otherwise an error.
     */
    ssize_t (*send_buf)(struct selva_server_response_out *restrict resp, const void *restrict buf, size_t len, enum server_send_flags flags);
    /**
     * Send contents of a file pointed by fd a part of the response resp.
     * The file is sent with a new selva_proto frame header with no payload but
     * msg_bsize set to size. The file is sent completely at once ignoring any
     * normal frame size limits. The frame header CRC check doesn't apply to the
     * file sent and thus any integrity checking must be implemented separately.
     * @returns Return bytes sent; Otherwise an error.
     */
    ssize_t (*send_file)(struct selva_server_response_out *resp, int fd, size_t size, enum server_send_flags flags);
    int (*start_stream)(struct selva_server_response_out *resp, struct selva_server_response_out **stream_resp_out);
    void (*cancel_stream)(struct selva_server_response_out *resp, struct selva_server_response_out *stream_resp);
};

extern struct message_handlers_vtable message_handlers[NR_SERVER_MESSAGE_HANDLERS];

/*
 * Init message handlers vtables.
 */
void message_none_init(struct message_handlers_vtable *vt);
void message_sock_init(struct message_handlers_vtable *vt);
void message_buf_init(struct message_handlers_vtable *vt);
