/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <dlfcn.h>
#include <inttypes.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include <time.h>
#include "module.h"
#include "jemalloc.h"
#include "queue.h"
#include "tree.h"
#include "util/auto_free.h"
#include "util/ctime.h"
#include "util/finalizer.h"
#include "util/mempool.h"
#include "util/selva_string.h"
#include "selva_error.h"
#include "event_loop.h"
#include "selva_io.h"
#include "selva_log.h"
#include "selva_proto.h"
#include "selva_server.h"

#define MQ_NAME_SIZE 8
#define MQ_SLAB_SIZE 1024
#define MQ_MSG_SLAB_SIZE 32768

#define XSTR(s) STR(s)
#define STR(s) #s
#define MQ_SCA_NAME XSTR(MQ_NAME_SIZE) "s"

struct mq;

struct mq_message {
    uint64_t id;
    struct mq *mq;
    TAILQ_ENTRY(mq_message) _list_entry;
    struct selva_string *buf;
    int ack_tim;
};

TAILQ_HEAD(mq_message_tailq, mq_message);

struct mq_reader {
    long long msg_min;
    long long msg_max;
    long long msg_cnt;
    int tim;
    struct selva_server_response_out *stream_resp;
    LIST_ENTRY(mq_reader) _list_entry;
};

struct mq {
    char name[MQ_NAME_SIZE];
    uint64_t next_msg_id;
    size_t nr_msg; /*!< Number of active messages (undelivered or waiting for ack). */
    struct timespec ack_timeout; /*! pending_ack system used if this is non-zero */
    LIST_HEAD(mq_reader_list, mq_reader) readers;
    struct mq_message_tailq pending_recv;
    struct mq_message_tailq pending_ack;
    RB_ENTRY(mq) _index_entry;
};

RB_HEAD(mq_tree, mq);

RB_PROTOTYPE_STATIC(mq_tree, mq, _index_entry, mq_compare)
static void mq_end_reader(struct mq_reader *mr);
static void delivery_proc(struct mq *mq);
static void mq_post(struct mq_message *msg);

static struct mempool mq_pool;
static struct mempool msg_pool;

static int mq_compare(const struct mq *a, const struct mq *b) {
    return memcmp(a->name, b->name, MQ_NAME_SIZE);
}

RB_GENERATE_STATIC(mq_tree, mq, _index_entry, mq_compare)

static struct mq_tree mq_index_head = RB_INITIALIZER();
static int nr_mq; /*!< Number of message queues. */

[[nodiscard]]
static struct mq *alloc_mq(const char name[static MQ_NAME_SIZE])
{
    struct mq *mq = mempool_get(&mq_pool);

    memcpy(mq->name, name, MQ_NAME_SIZE);

    return mq;
}

static inline void free_mq(struct mq *mq)
{
    mempool_return(&mq_pool, mq);
}

[[nodiscard]]
static int new_mq(const char name[static MQ_NAME_SIZE], const struct timespec *timeout)
{
    struct mq *mq = alloc_mq(name);

    mq->next_msg_id = 0;
    mq->nr_msg = 0;
    LIST_INIT(&mq->readers);
    TAILQ_INIT(&mq->pending_recv);
    TAILQ_INIT(&mq->pending_ack);
    memcpy(&mq->ack_timeout, timeout, sizeof(*timeout));

    if (RB_INSERT(mq_tree, &mq_index_head, mq)) {
        free_mq(mq);
        return SELVA_EEXIST;
    }
    nr_mq++;

    return 0;
}

static struct mq *get_mq(const char name[static MQ_NAME_SIZE])
{
    struct mq find;
    struct mq *mq;

    memcpy(find.name, name, MQ_NAME_SIZE);
    mq = RB_FIND(mq_tree, &mq_index_head, &find);

    return mq;
}

[[nodiscard]]
static struct mq_message *new_message(struct mq *mq, struct selva_string *buf)
{
    struct mq_message *msg = mempool_get(&msg_pool);

    msg->mq = mq;
    msg->buf = buf;
    msg->ack_tim = SELVA_ENOENT;

    /*
     * Note that msg_id must not be set here as it's per post.
     */
    mq->nr_msg++;

    return msg;
}

/**
 * The message must not be on any list when this function is called.
 */
static void free_msg(struct mq_message *msg)
{
    struct mq *mq = msg->mq;

    if (msg->ack_tim >= 0) {
        evl_clear_timeout(msg->ack_tim, NULL);
    }
    selva_string_free(msg->buf);
    memset(msg, 0, sizeof(*msg));
    mempool_return(&msg_pool, msg);

    mq->nr_msg--;
}

static void mq_clear_tailq(struct mq_message_tailq *head)
{
    struct mq_message *msg;
    struct mq_message *msg_tmp;

    msg = TAILQ_FIRST(head);
    while (msg != NULL) {
        msg_tmp = TAILQ_NEXT(msg, _list_entry);
        free_msg(msg);
        msg = msg_tmp;
    }
    TAILQ_INIT(head);
}

static void mq_clear(struct mq *mq)
{
    mq_clear_tailq(&mq->pending_recv);
    mq_clear_tailq(&mq->pending_ack);
}

static void mq_add_reader(struct mq *mq, struct mq_reader *mr)
{
    LIST_INSERT_HEAD(&mq->readers, mr, _list_entry);
}

static void handle_reader_timeout(struct event *, void *arg)
{
    struct mq_reader *mr = (struct mq_reader *)arg;

    mr->tim = SELVA_ENOENT;

    mq_end_reader(mr);
}

static void new_reader(struct mq *mq, struct selva_server_response_out *stream_resp, long long msg_min, long long msg_max, long long timeout)
{
    struct mq_reader *mr;

    mr = selva_malloc(sizeof(*mr));
    mr->msg_cnt = 0;
    mr->msg_min = msg_min;
    mr->msg_max = msg_max;
    mr->stream_resp = stream_resp;

    int tim = SELVA_ENOENT;
    if (timeout >= 0) {
        tim = evl_set_timeout(msec2timespec(&(struct timespec){}, timeout), handle_reader_timeout, mr);

        if (tim < 0) {
            SELVA_LOG(SELVA_LOGL_CRIT, "Failed to setup a timeout");
        }
    }

    mq_add_reader(mq, mr);
}

/**
 * End the reader's stream and free the control block.
 * This function can be called when
 * - all the readers of an mq should be destroyed,
 * - the requested number of items has been sent.
 */
static void mq_end_reader(struct mq_reader *mr)
{
    if (mr->tim >= 0) {
        evl_clear_timeout(mr->tim, NULL);
    }

    LIST_REMOVE(mr, _list_entry);
    selva_send_end(mr->stream_resp);
    selva_free(mr);
}

/**
 * Delete (end) all readers of the given mq.
 */
static void mq_del_readers(struct mq *mq)
{
    struct mq_reader *mr;
    struct mq_reader *mr_temp;

    LIST_FOREACH_SAFE(mr, &mq->readers, _list_entry, mr_temp) {
        mq_end_reader(mr);
    }
}

static void del_mq(struct mq *mq)
{
    RB_REMOVE(mq_tree, &mq_index_head, mq);
    mq_del_readers(mq);
    mq_clear(mq);
    free_mq(mq);
    nr_mq--;
}

static int del_mq_by_name(const char name[static MQ_NAME_SIZE])
{
    struct mq find = {};
    struct mq *mq;

    memcpy(find.name, name, MQ_NAME_SIZE);
    mq = RB_FIND(mq_tree, &mq_index_head, &find);
    if (!mq) {
        return SELVA_ENOENT;
    }

    del_mq(mq);
    return 0;
}

/**
 * Attempt to resend a message if no ack was received within the time limit.
 */
static void handle_message_ack_timeout(struct event *, void *arg)
{
    struct mq_message *msg = (struct mq_message *)arg;
    struct mq *mq = msg->mq;

    msg->ack_tim = SELVA_ENOENT;
    TAILQ_REMOVE(&mq->pending_ack, msg, _list_entry);

    /*
     * We do the same as mq_post() but insert to the head.
     */
    msg->id = mq->next_msg_id++;
    TAILQ_INSERT_HEAD(&mq->pending_recv, msg, _list_entry);
    delivery_proc(mq);
}

/**
 * Insert a message to the meding_ack queue.
 */
static void mq_insert_pending_ack(struct mq_message *msg)
{
    struct mq *mq = msg->mq;
    int tim;


    tim = evl_set_timeout(&mq->ack_timeout, handle_message_ack_timeout, msg);
    if (tim < 0) {
        /* TODO Error handling */
    }

    msg->ack_tim = tim;

    TAILQ_INSERT_TAIL(&mq->pending_ack, msg, _list_entry);
}

/**
 * Deliver messages in the pending_recv queue.
 */
static void delivery_proc(struct mq *mq)
{
    const bool req_ack = mq->ack_timeout.tv_sec || mq->ack_timeout.tv_nsec;
    struct mq_reader_list *readers = &mq->readers;
    struct mq_message_tailq *pending = &mq->pending_recv;
    struct mq_message *msg;
    struct mq_message *msg_tmp;
    struct mq_reader *mr;
    struct mq_reader *mr_tmp;

    /*
     * Deliver pending messages.
     */
    TAILQ_FOREACH_SAFE(msg, pending, _list_entry, msg_tmp) {
        if (LIST_EMPTY(readers)) {
            break;
        }

        /* TODO Max unack per reader => skip reader that has too many */
        LIST_FOREACH_SAFE(mr, readers, _list_entry, mr_tmp) {
            struct selva_server_response_out *stream_resp = mr->stream_resp;

            if (!selva_send_array(stream_resp, 2) &&
                !selva_send_ll(stream_resp, msg->id) &&
                !selva_send_string(stream_resp, msg->buf)) {
                /*
                 * Delivered.
                 */
                TAILQ_REMOVE(pending, msg, _list_entry);
                if (req_ack) {
                    mq_insert_pending_ack(msg);
                } else {
                    free_msg(msg);
                }
                msg = NULL;

                if (mr->msg_min != -1 && ++mr->msg_cnt >= mr->msg_max) {
                    mq_end_reader(mr);
                }

                break;
            }

            /*
             * This reader is unreachable/gone.
             */
            mq_end_reader(mr);
        }
    }

    /*
     * Check the state of each reader:
     * - flush indefinite readers
     * - end streams that have received the min nr of messages
     */
    LIST_FOREACH_SAFE(mr, readers, _list_entry, mr_tmp) {
        long long msg_min = mr->msg_min;

        if (msg_min == -1) {
            if (selva_send_flush(mr->stream_resp)) {
                mq_end_reader(mr);
            }
        } else if (msg_min == 0 || mr->msg_cnt >= msg_min) {
            mq_end_reader(mr);
        }
    }
}

/**
 * Post a message to an mq.
 */
static void mq_post(struct mq_message *msg)
{
    struct mq *mq = msg->mq;

    msg->id = mq->next_msg_id++;
    TAILQ_INSERT_TAIL(&mq->pending_recv, msg, _list_entry);
    delivery_proc(mq);
}

static int mq_ack(struct mq *mq, typeof_field(struct mq_message, id) msg_id)
{
    struct mq_message *msg;

    TAILQ_FOREACH(msg, &mq->pending_ack, _list_entry) {
        if (msg->id == msg_id) {
            TAILQ_REMOVE(&mq->pending_ack, msg, _list_entry);
            free_msg(msg);
            return 0;
        }
    }

    return SELVA_ENOENT;
}

static int mq_nack(struct mq *mq, typeof_field(struct mq_message, id) msg_id)
{
    struct mq_message *msg;

    TAILQ_FOREACH(msg, &mq->pending_ack, _list_entry) {
        if (msg->id == msg_id) {
            if (msg->ack_tim >= 0) {
                evl_clear_timeout(msg->ack_tim, NULL);
                msg->ack_tim = SELVA_ENOENT;
            }
            TAILQ_REMOVE(&mq->pending_ack, msg, _list_entry);
            mq_post(msg);
            return 0;
        }
    }

    return SELVA_ENOENT;
}

static void cmd_create(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    const char name[MQ_NAME_SIZE];
    long long timeout = 0; /*!< in msec */
    int argc, err;

    argc = selva_proto_scanf(NULL, buf, len, "%" MQ_SCA_NAME ", %lld", &name, &timeout);
    if (argc != 1 && argc != 2) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    err = new_mq(name, msec2timespec(&(struct timespec){}, timeout));
    if (err) {
        selva_send_errorf(resp, err, "Create failed");
        return;
    }

    selva_send_ll(resp, 1);
}

static void cmd_delete(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    const char name[MQ_NAME_SIZE];
    int argc, err;

    argc = selva_proto_scanf(NULL, buf, len, "%" MQ_SCA_NAME, &name);
    if (argc != 1) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    err = del_mq_by_name(name);
    if (err) {
        selva_send_errorf(resp, err, "Delete failed");
        return;
    }

    selva_send_ll(resp, 1);
}

static void cmd_list(struct selva_server_response_out *resp, const void *, size_t len)
{
    struct mq *mq;

    if (len) {
        selva_send_error_arity(resp);
        return;
    }

    selva_send_array(resp, nr_mq);
    RB_FOREACH(mq, mq_tree, &mq_index_head) {
        selva_send_strf(resp, "%s", mq->name);
    }
}

static void cmd_post(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    __auto_finalizer struct finalizer fin;
    char name[MQ_NAME_SIZE];
    struct selva_string **messages = NULL;
    int argc;

    finalizer_init(&fin);
    argc = selva_proto_scanf(&fin, buf, len, "%" MQ_SCA_NAME ", ...", &name, &messages);
    if (argc < 2) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    struct mq *mq = get_mq(name);
    if (!mq) {
        selva_send_errorf(resp, SELVA_ENOENT, "mq not found");
        return;
    }

    for (size_t i = 0; messages[i]; i++) {
        struct selva_string *msg = messages[i];

        finalizer_del(&fin, msg);
        mq_post(new_message(mq, msg));
    }

    selva_send_ll(resp, argc - 1);
}

static void cmd_recv(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    const char name[MQ_NAME_SIZE];
    long long msg_min = 0; /*!< Minimum number of messages to be received.
                            *   =-1 stream forever;
                            *   =0 return immediately;
                            *   >0 wait until at least min available. */
    long long msg_max = 1; /*!< Maximum number of messages to be received. */
    long long timeout = -1; /*!< Timeout if no messages in queue. [msec] */
    int argc, err;

    argc = selva_proto_scanf(NULL, buf, len, "%" MQ_SCA_NAME ", %lld, %lld, %lld",
                             &name, &msg_min, &msg_max, &timeout);
    if (argc < 0) {
        selva_send_errorf(resp, argc, "Failed to parse args");
        return;
    } else if (argc < 1) {
        selva_send_error_arity(resp);
        return;
    } else if (msg_min == -1 && argc != 2) {
        selva_send_error_arity(resp);
        return;
    }

    if (msg_min < -1) {
        selva_send_errorf(resp, SELVA_EINVAL, "Invalid msg_min");
        return;
    }
    if (msg_max < 0) {
        selva_send_errorf(resp, SELVA_EINVAL, "Invalid msg_max");
        return;
    }
    if (timeout < -1) {
        selva_send_errorf(resp, SELVA_EINVAL, "Invalid timeout");
        return;
    }

    if (msg_min > msg_max) {
        msg_max = msg_min;
    }

    struct mq *mq = get_mq(name);
    if (!mq) {
        selva_send_errorf(resp, SELVA_ENOENT, "mq not found");
        return;
    }

    struct selva_server_response_out *stream_resp;

    err = selva_start_stream(resp, &stream_resp);
    if (err) {
        selva_send_errorf(resp, err, "Failed to create a stream");
        return;
    }

    new_reader(mq, stream_resp, msg_min, msg_max, timeout);
    delivery_proc(mq);
}

static void cmd_ack_nack(struct selva_server_response_out *resp, const void *buf, size_t len, bool ack)
{
    const char mq_name[MQ_NAME_SIZE];
    typeof_field(struct mq_message, id) msg_id;
    int argc, err;

    argc = selva_proto_scanf(NULL, buf, len, "%" MQ_SCA_NAME ", %" PRIu64,
                             &mq_name, &msg_id);
    if (argc != 2) {
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
        return;
    }

    struct mq *mq = get_mq(mq_name);
    if (!mq) {
        selva_send_errorf(resp, SELVA_ENOENT, "mq not found");
        return;
    }

    err = ack ? mq_ack(mq, msg_id) : mq_nack(mq, msg_id);
    if (err) {
        selva_send_errorf(resp, err, "msg not found");
        return;
    }

    selva_send_ll(resp, 1);
}

static void cmd_ack(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    cmd_ack_nack(resp, buf, len, true);
}

static void cmd_nack(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    cmd_ack_nack(resp, buf, len, false);
}

static bool mq_is_ready(void)
{
    return true;
}

static bool inhibit_sdb(void)
{
    /*
     * A readonly node shouldn't load mq because none of the commands
     * would work. This is likely happening when the node is in
     * a readonly replica replication mode. We check it anyway...
     */
    return (selva_server_is_readonly() ||
            selva_replication_get_mode() == SELVA_REPLICATION_MODE_REPLICA);
}

/**
 * This must be done to reproduce the correct SDB hash and
 * to progress the read index properly.
 */
static void mq_fake_load(struct selva_io *io)
{
    size_t n = selva_io_load_unsigned(io);
    for (size_t i = 0; i < n; i++) {
        __unused __selva_autofree const char *name = selva_io_load_str(io, NULL);
        selva_io_load_signed(io);
        selva_io_load_signed(io);
        selva_io_load_signed(io);

        const size_t nr_msg = selva_io_load_unsigned(io);
        for (size_t i = 0; i < nr_msg; i++) {
            selva_io_load_unsigned(io);
            selva_io_load_string(io);
        }
    }
}

static int mq_load(struct selva_io *io)
{
    if (inhibit_sdb()) {
        mq_fake_load(io);
        return 0;
    }

    size_t n = selva_io_load_unsigned(io);
    for (size_t i = 0; i < n; i++) {
        __selva_autofree const char *name = selva_io_load_str(io, NULL); /* we know the length */
        struct timespec timeout;
        typeof_field(struct mq_message, id) next_msg_id;
        int err;

        timeout.tv_sec = selva_io_load_signed(io);
        timeout.tv_nsec = selva_io_load_signed(io);
        next_msg_id = selva_io_load_signed(io);

        err = new_mq(name, &timeout);
        if (err) {
            return err;
        }

        struct mq *mq = get_mq(name);
        mq->next_msg_id = next_msg_id;

        const size_t nr_msg = selva_io_load_unsigned(io);
        for (size_t i = 0; i < nr_msg; i++) {
            const typeof_field(struct mq_message, id) msg_id = selva_io_load_unsigned(io);
            struct mq_message *msg = new_message(mq, selva_io_load_string(io));

            msg->id = msg_id;
            TAILQ_INSERT_TAIL(&mq->pending_recv, msg, _list_entry);
        }
    }

    return 0;
}

static void mq_save_pending(struct selva_io *io, struct mq_message_tailq *pending)
{
    struct mq_message *msg;

    TAILQ_FOREACH(msg, pending, _list_entry) {
        selva_io_save_unsigned(io, msg->id);
        selva_io_save_string(io, msg->buf);
    }
}

static void mq_save(struct selva_io *io)
{
    struct mq *mq;

    if (inhibit_sdb()) {
        return;
    }

    selva_io_save_unsigned(io, nr_mq);

    RB_FOREACH(mq, mq_tree, &mq_index_head) {
        selva_io_save_str(io, mq->name, MQ_NAME_SIZE);
        selva_io_save_signed(io, mq->ack_timeout.tv_sec);
        selva_io_save_signed(io, mq->ack_timeout.tv_nsec);
        selva_io_save_unsigned(io, mq->next_msg_id);

        selva_io_save_unsigned(io, mq->nr_msg);
        mq_save_pending(io, &mq->pending_ack);
        mq_save_pending(io, &mq->pending_recv);
    }
}

static void mq_flush(void)
{
    struct mq *mq;
    struct mq *mq_tmp;

    RB_FOREACH_SAFE(mq, mq_tree, &mq_index_head, mq_tmp) {
        mq_clear(mq);
        del_mq(mq);
    }
}

IMPORT() {
    evl_import_main(selva_log);
    evl_import_main(evl_set_timeout);
    evl_import_main(evl_clear_timeout);
    import_selva_server();
    import_selva_io();
}

__constructor static void init(void)
{
    evl_module_init("mq");

    mempool_init(&mq_pool, MQ_SLAB_SIZE, sizeof(struct mq), _Alignof(struct mq));
    mempool_init(&msg_pool, MQ_MSG_SLAB_SIZE, sizeof(struct mq_message), _Alignof(struct mq_message));
    selva_io_register_serializer(SELVA_IO_ORD_MQ, &(struct selva_io_serializer){
        .is_ready = mq_is_ready,
        .deserialize = mq_load,
        .serialize = mq_save,
        .flush = mq_flush,
    });

    selva_mk_command(CMD_ID_MQ_CREATE, SELVA_CMD_MODE_MUTATE, "mq.create", cmd_create);
    selva_mk_command(CMD_ID_MQ_DELETE, SELVA_CMD_MODE_MUTATE, "mq.delete", cmd_delete);
    selva_mk_command(CMD_ID_MQ_LIST, SELVA_CMD_MODE_MUTATE, "mq.list", cmd_list);
    selva_mk_command(CMD_ID_MQ_POST, SELVA_CMD_MODE_MUTATE, "mq.post", cmd_post);
    selva_mk_command(CMD_ID_MQ_RECV, SELVA_CMD_MODE_MUTATE, "mq.recv", cmd_recv);
    selva_mk_command(CMD_ID_MQ_ACK, SELVA_CMD_MODE_MUTATE, "mq.ack", cmd_ack);
    selva_mk_command(CMD_ID_MQ_NACK, SELVA_CMD_MODE_MUTATE, "mq.nack", cmd_nack);
}

__destructor static void fini(void)
{
    mq_flush();
    mempool_destroy(&msg_pool);
    mempool_destroy(&mq_pool);
}
