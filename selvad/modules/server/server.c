/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#define _GNU_SOURCE
#include <arpa/inet.h>
#include <dlfcn.h>
#include <errno.h>
#include <fcntl.h>
#include <langinfo.h>
#include <stdarg.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <unistd.h>
#include "jemalloc.h"
#include "endian.h"
#include "util/finalizer.h"
#include "util/net.h"
#include "util/selva_cpu.h"
#include "util/selva_lang.h"
#include "util/selva_proto_builder.h"
#include "util/selva_rusage.h"
#include "util/selva_string.h"
#include "util/tcp.h"
#include "util/timestamp.h"
#include "event_loop.h"
#include "selva_langs.h"
#include "config.h"
#include "module.h"
#include "selva_error.h"
#include "selva_log.h"
#include "selva_proto.h"
#include "selva_server.h"
#include "selva_reaper.h"
#include "xsi_strerror_r.h"
#include "server.h"

#if !defined(__APPLE__)
/* Unfortunately something with query_fork is unstable on macOS. */
#define USE_QUERY_FORK
#endif

static int selva_port = 3000;
static int server_backlog_size = 4096;
static int max_clients = EVENT_LOOP_MAX_FDS - 16; /* minus few because we need some fds for other purposes */
static bool so_reuse;
static int server_sockfd;
static bool readonly_server;
static struct query_fork_ctrl {
    bool disabled; /*!< Feature disabled. */
    bool child; /*!< Set if currently in a query_fork child. */
    int count;
    size_t slot; /*!< Current index in pids and ret_channel. Only valid if child is set. */
    /**
     * Currently running query_forks.
     */
    pid_t pids[MAX_QUERY_FORKS];

    struct {
        /**
         * Index into buf.
         * Only valid if child is set.
         */
        size_t buf_i;
        /**
         * Return channel from the forks.
         * Indexed by slot.
         */
        uint8_t buf[QUERY_FORK_CMD_BUF_SIZE];
    } (*ret_channel)[MAX_QUERY_FORKS];
} query_fork;
static bool hierarchy_auto_compress_period_ms; /* Only used to check that this is not enabled when query_fork is enabled. */
static struct command {
    selva_cmd_function cmd_fn;
    selva_cmd_query_fork_test query_fork_eligible;
    enum selva_cmd_mode cmd_mode;
    const char *cmd_name;
} commands[254];
struct message_handlers_vtable message_handlers[3];

static const struct config server_cfg_map[] = {
    { "SELVA_PORT",                         CONFIG_INT, &selva_port },
    { "SERVER_BACKLOG_SIZE",                CONFIG_INT, &server_backlog_size },
    { "SERVER_MAX_CLIENTS",                 CONFIG_INT, &max_clients },
    { "SERVER_SO_REUSE",                    CONFIG_BOOL, &so_reuse },
    { "SERVER_DISABLE_QUERY_FORK",          CONFIG_INT, &query_fork.disabled },
    { "HIERARCHY_AUTO_COMPRESS_PERIOD_MS",  CONFIG_INT, &hierarchy_auto_compress_period_ms },
};

void selva_server_set_readonly(void)
{
    readonly_server = true;
}

bool selva_server_is_readonly(void)
{
    return readonly_server;
}

bool selva_server_is_query_fork(void)
{
    return query_fork.child;
}

int selva_mk_command(int nr, enum selva_cmd_mode mode, const char *name, selva_cmd_function cmd, ...)
{
    va_list args;
    struct command *c;

    if (nr < 0 || nr >= (int)num_elem(commands)) {
        return SELVA_EINVAL;
    }

    if (commands[nr].cmd_fn) {
        return SELVA_EEXIST;
    }

    if (__builtin_popcount(mode & (SELVA_CMD_MODE_PURE | SELVA_CMD_MODE_MUTATE)) != 1) {
        return SELVA_EINVAL;
    }

    if ((mode & SELVA_CMD_MODE_QUERY_FORK) && !(mode & SELVA_CMD_MODE_PURE)) {
        return SELVA_EINVAL;
    }

    c = &commands[nr];
    c->cmd_fn = cmd;
    c->cmd_mode = mode;
    c->cmd_name = name;

    if (mode & SELVA_CMD_MODE_QUERY_FORK) {
        /*
         * __STDC_VERSION__ > 201710L shouldn't require the second argument but
         * clang on macOS is broken.
         */
        va_start(args, cmd);
        c->query_fork_eligible = va_arg(args, selva_cmd_query_fork_test);
        va_end(args);
    }

    return 0;
}

static struct command *get_command(int nr)
{
    return (nr >= 0 && nr < (int)num_elem(commands)) ? &commands[nr] : NULL;
}

static void ping(struct selva_server_response_out *resp, const void *buf __unused, size_t size __unused)
{
    const char msg[] = "pong";

    selva_send_str(resp, msg, sizeof(msg) - 1);
}

static void echo(struct selva_server_response_out *resp, const void *buf, size_t size)
{
    struct selva_proto_string hdr;
    const char *p = (char *)buf;
    size_t left = size;

    if (size == 0) {
        selva_send_errorf(resp, SELVA_EINVAL, "Empty payload");
        return;
    }

    /*
     * We could also support receiving an array like many other commands that
     * support explicit and implicit arrays at the top-level. However, it's
     * quite pointless to implement the support here because this command is not
     * very useful in production. It might be also better to go for simplicity
     * over formalism.
     */
    while (left > sizeof(hdr)) {
        size_t bsize;

        memcpy(&hdr, p, sizeof(hdr));
        left -= sizeof(hdr);
        p += sizeof(hdr);

        if (hdr.type != SELVA_PROTO_STRING) {
            const char err_str[] = "Invalid payload type";

            selva_send_error(resp, SELVA_EINVAL, err_str, sizeof(err_str) - 1);
            break;
        }

        bsize = le32toh(hdr.bsize);
        if (bsize > left) {
            const char err_str[] = "Invalid payload size";

            selva_send_error(resp, SELVA_EINVAL, err_str, sizeof(err_str) - 1);
            break;
        }

        selva_send_str(resp, p, bsize);
        left -= bsize;
        p += bsize;
    }
}

static void lscmd(struct selva_server_response_out *resp, const void *buf __unused, size_t size __unused)
{
    selva_send_array(resp, -1);
    for (size_t i = 0; i < num_elem(commands); i++) {
        if (commands[i].cmd_fn) {
            selva_send_array(resp, 2);
            selva_send_ll(resp, i);
            selva_send_str(resp, commands[i].cmd_name, strlen(commands[i].cmd_name));
        }
    }
    selva_send_array_end(resp);
}

static void lslang(struct selva_server_response_out *resp, const void *buf __unused, size_t size __unused)
{
    selva_send_array(resp, selva_langs->len);
    for (size_t i = 0; i < selva_langs->len; i++) {
        const struct selva_lang *lang = &selva_langs->langs[i];
        const char *lang_ident;

        if (lang->locale) {
#ifdef __linux__
            lang_ident = nl_langinfo_l(_NL_IDENTIFICATION_LANGUAGE, lang->locale);
#else
            lang_ident = "loaded";
#endif
        } else {
            lang_ident = "not_loaded";
        }

        selva_send_array(resp, 3);
        selva_send_strf(resp, "%s", lang->name);
        selva_send_strf(resp, "%s", lang->loc_name);
        selva_send_strf(resp, "%s", lang_ident);
    }
}

static void lsmod(struct selva_server_response_out *resp, const void *buf __unused, size_t size __unused)
{
    const struct evl_module_info *mod = NULL;

    selva_send_array(resp, -1);
    while ((mod = evl_get_next_module(mod))) {
        selva_send_str(resp, mod->name, strlen(mod->name));
    }
    selva_send_array_end(resp);
}

static const struct timespec hrt_period = {
    .tv_sec = 5,
    .tv_nsec = 0,
};

static void hrt_cb(struct event *, void *arg)
{
    struct selva_server_response_out *resp = (struct selva_server_response_out *)arg;
    int tim;

    SELVA_LOG(SELVA_LOGL_DBG, "Sending a heartbeat (%p, %d)", resp, resp->ctx ? resp->ctx->fd : -1);

    selva_send_str(resp, "boum", 4);

    if (selva_send_flush(resp)) {
        /* Connection reset. */
        (void)selva_send_end(resp);
        return;
    }

    tim = evl_set_timeout(&hrt_period, hrt_cb, resp);
    if (tim < 0) {
        (void)selva_send_errorf(resp, SELVA_ENOBUFS, "Failed to allocate a timer");
        (void)selva_send_end(resp);
        return;
    }

    resp->ctx->app.tim_hrt = tim;
}

static void hrt(struct selva_server_response_out *resp, const void *buf __unused, size_t size __unused)
{
    struct selva_server_response_out *stream_resp;
    int tim, err;

    if (resp->ctx->app.tim_hrt >= 0) {
        selva_send_errorf(resp, SELVA_EEXIST, "Already created");
        return;
    }

    err = selva_start_stream(resp, &stream_resp);
    if (err) {
        selva_send_errorf(resp, err, "Failed to create a stream");
        return;
    }

    tim = evl_set_timeout(&hrt_period, hrt_cb, stream_resp);
    if (tim < 0) {
        selva_cancel_stream(resp, stream_resp);
        selva_send_errorf(resp, tim, "Failed to create a timer");
        return;
    }

    resp->ctx->app.tim_hrt = tim;

    selva_send_ll(resp, 1);
}

/**
 * List config.
 * Resp:
 * [
 *   [
 *     mod_name,
 *     cfg_name,
 *     cfg_val,
 *     cfg_name,
 *     cfg_val,
 *     ...
 *   ],
 *   [
 *     mod_name,
 *     ...
 *   ]
 * ]
 */
static void config(struct selva_server_response_out *resp, const void *buf __unused, size_t size)
{
    const struct config_list *list;
    const size_t list_len = config_list_get(&list);

    if (size) {
        selva_send_error_arity(resp);
        return;
    }

    selva_send_array(resp, list_len);
    for (size_t i = 0; i < list_len; i++) {
        const struct config *cfg_map = list[i].cfg_map;
        const size_t len = list[i].len;

        selva_send_array(resp, 1 + 2 * len);
        selva_send_strf(resp, "%s", list[i].mod_name);

        for (size_t j = 0; j < len; j++) {
            const struct config *cfg = &cfg_map[j];

            selva_send_strf(resp, "%s", cfg->name);
            switch (cfg->type) {
            case CONFIG_CSTRING:
                selva_send_strf(resp, "%s", *(char **)cfg->dp);
                break;
            case CONFIG_INT:
                selva_send_ll(resp, *(int *)cfg->dp);
                break;
            case CONFIG_BOOL:
                selva_send_strf(resp, "%s", (*(bool *)cfg->dp) ? "true" : "false");
                break;
            case CONFIG_SIZE_T:
                selva_send_ll(resp, *(size_t *)cfg->dp);
                break;
            default:
                selva_send_errorf(resp, SELVA_PROTO_ENOTSUP, "Unsupported type");
            }
        }
    }
}

static void loglevel(struct selva_server_response_out *resp, const void *buf, size_t size)
{
    int new_level;
    int argc;

    argc = selva_proto_scanf(NULL, buf, size, "%d", &new_level);
    if (argc < 0) {
        selva_send_errorf(resp, argc, "Failed to parse args");
    } else if (argc == 0) {
        selva_send_ll(resp, selva_log_get_level());
    } else if (argc == 1) {
        new_level += '0';

        if (new_level < SELVA_LOGL_CRIT || new_level > SELVA_LOGL_DBG) {
            selva_send_errorf(resp, SELVA_EINVAL, "Invalid loglevel");
            return;
        }

        selva_send_ll(resp, selva_log_set_level(new_level) - '0');
    } else {
        selva_send_error_arity(resp);
    }
}

static void debug(struct selva_server_response_out *resp, const void *buf, size_t size)
{
    const char *pattern_str;
    size_t pattern_len;
    int argc;

    argc = selva_proto_scanf(NULL, buf, size, "%.*s", &pattern_len, &pattern_str);
    switch (argc) {
    case 0:
        selva_send_error(resp, SELVA_ENOTSUP, NULL, 0);
        break;
    case 1:
        selva_log_set_dbgpattern(pattern_str, pattern_len);
        selva_send_ll(resp, 1);
        break;
    default:
        if (argc < 0) {
            selva_send_errorf(resp, argc, "Failed to parse args");
        } else {
            selva_send_error_arity(resp);
        }
    }
}

static void mallocstats_send(void *arg, const char *buf)
{
    struct selva_server_response_out *resp = (struct selva_server_response_out *)arg;

    selva_send_strf(resp, "%s", buf);
}

static void mallocstats(struct selva_server_response_out *resp, const void *buf, size_t size)
{
    __auto_finalizer struct finalizer fin;
    struct selva_string *opts = NULL;
    int argc;

    finalizer_init(&fin);
    argc = selva_proto_scanf(&fin, buf, size, "%p", &opts);
    if (argc < 0) {
        selva_send_errorf(resp, argc, "Failed to parse args");
        return;
    } else if (argc > 1) {
        selva_send_error_arity(resp);
        return;
    }

    selva_malloc_stats_print(mallocstats_send, resp, selva_string_to_str(opts, NULL));
}

static void mallocprofdump(struct selva_server_response_out *resp, const void *buf, size_t size)
{
    __auto_finalizer struct finalizer fin;
    struct selva_string *filename = NULL;
    int argc;

    finalizer_init(&fin);
    argc = selva_proto_scanf(&fin, buf, size, "%p", &filename);
    if (argc < 0) {
        selva_send_errorf(resp, argc, "Failed to parse args");
        return;
    } else if (argc > 1) {
        selva_send_error_arity(resp);
        return;
    }

    if (filename) {
        TO_STR(filename);

        selva_mallctl("prof.dump", NULL, NULL, (void *)&filename_str, sizeof(const char *));
    } else {
        selva_mallctl("prof.dump", NULL, NULL, NULL, 0);
    }

    selva_send_ll(resp, 1);
}

static void rusage(struct selva_server_response_out *resp, const void *buf __unused, size_t size)
{
    struct selva_rusage net_rusage;

    if (size != 0) {
        selva_send_error_arity(resp);
        return;
    }

    selva_getrusage_net(SELVA_RUSAGE_SELF, &net_rusage);
    selva_send_bin(resp, &net_rusage, sizeof(net_rusage));

    selva_getrusage_net(SELVA_RUSAGE_CHILDREN, &net_rusage);
    selva_send_bin(resp, &net_rusage, sizeof(net_rusage));
}

static void client_command(struct selva_server_response_out *resp, const void *buf, size_t size)
{
    const char *op_str = NULL;
    size_t op_len = 0;
    const char *arg_str = "";
    size_t arg_len = 0;
    int argc;

    argc = selva_proto_scanf(NULL, buf, size, "%.*s, %.*s",
                             &op_len, &op_str,
                             &arg_len, &arg_str);
    if (argc < 0) {
        selva_send_errorf(resp, argc, "Failed to parse args");
        return;
    } else if (argc < 1) {
        selva_send_error_arity(resp);
        return;
    }

    if (op_len == 4 && !memcmp(op_str, "list", 4)) {
        if (argc != 1) {
            selva_send_error_arity(resp);
            return;
        }

        send_client_list(resp);
    } else if (op_len == 4 && !memcmp(op_str, "kill", 4)) {
        char idx[arg_len + 1];
        struct conn_ctx *client;

        if (argc != 2) {
            selva_send_error_arity(resp);
            return;
        }

        memcpy(idx, arg_str, arg_len);
        idx[arg_len] = '\0';
        client = get_conn_by_idx(strtoll(idx, NULL, 10));
        if (client) {
            (void)shutdown(client->fd, SHUT_RDWR);
            selva_send_ll(resp, 1);
        } else {
            selva_send_ll(resp, 0);
        }
    } else if (op_len == 4 && !memcmp(op_str, "help", 4)) {
        selva_send_array(resp, 3);
        selva_send_str(resp, "list", 4);
        selva_send_str(resp, "kill", 4);
        selva_send_str(resp, "help", 4);
    } else {
        selva_send_error(resp, SELVA_EINVAL, NULL, 0);
        return;
    }
}

static int new_server(int port)
{
    int sockfd;
    struct sockaddr_in server;

    sockfd = socket(AF_INET, SOCK_STREAM, 0);
    if (sockfd == -1) {
        SELVA_LOG(SELVA_LOGL_CRIT, "Could not create a socket");
        exit(EXIT_FAILURE);
    }

    if (so_reuse) {
        (void)setsockopt(sockfd, SOL_SOCKET, SO_REUSEADDR, &(int){1}, sizeof(int));
        (void)setsockopt(sockfd, SOL_SOCKET, SO_REUSEPORT, &(int){1}, sizeof(int));
    }

    server.sin_family = AF_INET;
    server.sin_addr.s_addr = INADDR_ANY;
    server.sin_port = htons(port);

    if (bind(sockfd, (struct sockaddr *)&server, sizeof(server)) < 0) {
        char buf[80];

        xsi_strerror_r(errno, buf, sizeof(buf));
        SELVA_LOG(SELVA_LOGL_CRIT, "bind failed: %s", buf);
        exit(EXIT_FAILURE);
    }

    if (listen(sockfd, server_backlog_size)) {
        SELVA_LOG(SELVA_LOGL_CRIT, "Failed to listen on port: %d",
                  port);
        exit(EXIT_FAILURE);
    }
    SELVA_LOG(SELVA_LOGL_INFO, "Listening on port: %d pid: %jd", port, (intmax_t)getpid());

    return sockfd;
}

static size_t query_fork_alloc_pid(void)
{
    pid_t *pids = query_fork.pids;

    for (size_t i = 0; i < MAX_QUERY_FORKS; i++) {
        if (pids[i] == 0) {
            pids[i] = 1; /* placeholder */
            return i;
        }
    }

    return SIZE_MAX;
}

static size_t query_fork_del_pid(pid_t pid)
{
    pid_t *pids = query_fork.pids;

    for (size_t i = 0; i < MAX_QUERY_FORKS; i++) {
        if (pids[i] == pid) {
            pids[i] = 0;
            return i;
        }
    }

    return SIZE_MAX;
}

static void query_fork_ret_ch_msg_writeout(size_t slot, const uint8_t *buf, size_t bsize)
{
    uint8_t (*ret_ch_buf)[QUERY_FORK_CMD_BUF_SIZE] = &(*query_fork.ret_channel)[slot].buf;

    if ((*query_fork.ret_channel)[slot].buf_i + bsize <= sizeof(*ret_ch_buf)) {
        memcpy(*ret_ch_buf + (*query_fork.ret_channel)[slot].buf_i, buf, bsize);
        (*query_fork.ret_channel)[slot].buf_i += bsize;
    } else {
        SELVA_LOG(SELVA_LOGL_ERR, "Out of buffer space for query_fork ret channel msg. bsize: %zu", bsize);
    }
}

void selva_server_query_fork_init_ret_msg(struct selva_proto_builder_msg *msg, typeof_field(struct selva_proto_header, cmd) cmd)
{
    /* TODO This could be optimized slightly if the tmp_msg builder could utilize the already existing buffer. */
    selva_proto_builder_init(msg, false);
    selva_proto_builder_insert_replication_cmd(msg, &(struct selva_proto_replication_cmd){
        .cmd = cmd,
        .ts = ts_now(),
        .bsize = 0, /* We need to calculate the real value later. */
    });
}

void selva_server_query_fork_send_ret_msg(struct selva_proto_builder_msg *msg)
{
    struct selva_proto_replication_cmd *hdr;

    if (unlikely(!query_fork.child)) {
        return;
    }

    hdr = (struct selva_proto_replication_cmd *)msg->buf; /* Do not try this at home. */
    hdr->bsize = msg->bsize - sizeof(*hdr);

    query_fork_ret_ch_msg_writeout(query_fork.slot, msg->buf, msg->bsize);
}

static void query_fork_ret_ch_exec(size_t slot)
{
    uint8_t (*buf)[QUERY_FORK_CMD_BUF_SIZE] = &(*query_fork.ret_channel)[slot].buf;
    const size_t bsize = (*query_fork.ret_channel)[slot].buf_i;

    if (bsize == 0) {
        return;
    }

    for (size_t i = 0; i < bsize;) {
        uint64_t eid;
        int64_t ts;
        int8_t cmd;
        int compressed;
        size_t data_size;
        int err;

        err = selva_proto_parse_replication_cmd(buf, bsize, i, &eid, &ts, &cmd, &compressed, &data_size);
        if (err) {
            SELVA_LOG(SELVA_LOGL_ERR, "Failed to parse query_fork ret_ch[%zu] msg at index: %zu", slot, i);
            return;
        }

#if 0
        SELVA_LOG(SELVA_LOGL_DBG, "Run ret_ch cmd: %d", cmd);
#endif

        i += sizeof(struct selva_proto_replication_cmd);
        if (i + data_size > sizeof(*buf)) {
            SELVA_LOG(SELVA_LOGL_ERR, "Invalid query_fork ret_ch[%zu] cmd args size: %zu", slot, data_size);
            return;
        }

        if (compressed) {
            SELVA_LOG(SELVA_LOGL_ERR, "Compression not supported: ret_ch[%zu]", slot);
            return;
        }

        err = selva_server_run_cmd(cmd, ts, &(*buf)[i], data_size);
        if (err) {
            SELVA_LOG(SELVA_LOGL_ERR, "Failed run the command %d: %s", (int)cmd, selva_strerror(err));
            return;
        }

        i += data_size;
    }
}

__used static void mk_query_fork(struct selva_server_response_out *resp, struct command *cmd)
{
    struct conn_ctx *ctx = resp->ctx;
    size_t slot = query_fork_alloc_pid();
    pid_t pid;

    if (unlikely(slot == SIZE_MAX)) {
        SELVA_LOG(SELVA_LOGL_ERR, "Unable to reserve a query_fork slot");
        selva_send_errorf(resp, SELVA_ENOBUFS, "Failed to execute");
        selva_send_end(resp);
        return;
    }

    if (ctx) {
        /*
         * Force flush to avoid partial messages being processed in the fork.
         */
        if (resp->resp_msg_handler == SERVER_MESSAGE_HANDLER_SOCK) {
            message_handlers[resp->resp_msg_handler].flush(resp, SERVER_FLUSH_FLAG_FORCE);
        }
    }

    pid = fork();
    if (pid == -1) {
        selva_send_errorf(resp, SELVA_EGENERAL, "Failed to execute");
        selva_send_end(resp);
    } else if (pid == 0) {
        /* child */
        cpu_set_t cs;

        /*
         * Don't run on the main CPU but on any other.
         */
        CPU_FILL(&cs);
        CPU_CLR(0, &cs);
        selva_cpu_set_main_affinity(&cs);

        readonly_server = true;
        query_fork.child = true;
        query_fork.slot = slot;
        /* The follwing cleanups are only done for the correctness. */
        query_fork.count = 0;
        memset(query_fork.pids, 0, sizeof(query_fork.pids));
        memset(&(*query_fork.ret_channel)[slot], 0, sizeof((*query_fork.ret_channel)[slot]));

        cmd->cmd_fn(resp, ctx->recv.msg_buf, ctx->recv.msg_buf_i);
        selva_send_end(resp);

        exit(EXIT_SUCCESS);
    } else {
        /* main */
        query_fork.pids[slot] = pid;
        query_fork.count++;
        SELVA_LOG(SELVA_LOGL_DBG, "fork pid: %d nr: %d", pid, query_fork.count);
    }
}

static int handle_query_fork_exit(pid_t pid, int status __unused, int selva_err)
{
    size_t slot = query_fork_del_pid(pid);

    if (slot == SIZE_MAX) {
        return 0;
    }

    query_fork_ret_ch_exec(slot);

    query_fork.count--;
    SELVA_LOG(SELVA_LOGL_DBG, "fork %d exit: %d", pid, selva_err);

    return 1;
}

static void on_data(struct event *event, void *arg)
{
    const int fd = event->fd;
    struct conn_ctx *ctx = (struct conn_ctx *)arg;
    int res;

    while ((res = server_recv_message(ctx)) >= 0) {
        if (res == 0) {
            /* A frame was received. */
            continue;
        }

        /* A message was received. */
        const uint32_t seqno = le32toh(ctx->recv_frame_hdr_buf.seqno);
        struct selva_server_response_out resp = {
            .ctx = ctx,
            .cork = 1, /* Cork the full response (lazy). This will be turned off if a stream is started. */
            .resp_msg_handler = SERVER_MESSAGE_HANDLER_SOCK,
            .cmd = ctx->recv_frame_hdr_buf.cmd,
            .frame_flags = SELVA_PROTO_HDR_FFIRST,
            .seqno = seqno,
            .last_error = 0,
            .ts = ts_now(),
            .buf_i = 0,
        };
        struct command *cmd;

        cmd = get_command(resp.cmd);
        if (cmd) {
            if (cmd->cmd_mode & SELVA_CMD_MODE_MUTATE && readonly_server) {
                static const char msg[] = "read-only server";

                (void)selva_send_error(&resp, SELVA_PROTO_ENOTSUP, msg, sizeof(msg) - 1);
#ifdef USE_QUERY_FORK
            } else if ((cmd->cmd_mode & SELVA_CMD_MODE_QUERY_FORK) &&
                       !query_fork.disabled && query_fork.count < MAX_QUERY_FORKS &&
                       cmd->query_fork_eligible(ctx->recv.msg_buf, ctx->recv.msg_buf_i)) {
                mk_query_fork(&resp, cmd);
                return;
#endif
            } else {
                cmd->cmd_fn(&resp, ctx->recv.msg_buf, ctx->recv.msg_buf_i);
            }
        } else {
            static const char msg[] = "Invalid command";

            (void)selva_send_error(&resp, SELVA_PROTO_EINVAL, msg, sizeof(msg) - 1);
        }

        if (!(resp.frame_flags & SELVA_PROTO_HDR_STREAM)) {
            selva_send_end(&resp);
        } /* The sequence doesn't end for streams. */
    }
    if (res < 0 && res != SELVA_PROTO_EAGAIN) {
        /*
         * Drop the connection on error.
         * We can't send an error message because we don't know if the header
         * data is reliable.
         */
        evl_end_fd(fd);
    }
}

static void on_close(struct event *event, void *arg)
{
    const int fd = event->fd;
    struct conn_ctx *ctx = (struct conn_ctx *)arg;

    /*
     * This will also make async streams fail while we still keep the
     * the fd reserved, i.e. don't allow reusing the fd before we know
     * that no async function or a thread will try to write to it.
     */
    (void)shutdown(fd, SHUT_RDWR);

    free_conn_ctx(ctx);
}

static void on_connection(struct event *event, void *arg __unused)
{
    int c = sizeof(struct sockaddr_in);
    struct sockaddr_in client;
    int new_sockfd;
    char buf[INET_ADDRSTRLEN];
    struct conn_ctx *conn_ctx = alloc_conn_ctx();

    if (!conn_ctx) {
        SELVA_LOG(SELVA_LOGL_WARN, "Maximum number of client connections reached");
        return;
    }

    /*
     * TODO On Linux we could use accept4 and set the socket non-blocking already here.
     */
    new_sockfd = accept(event->fd, (struct sockaddr *)&client, (socklen_t*)&c);
    if (new_sockfd < 0) {
        SELVA_LOG(SELVA_LOGL_ERR, "Accept failed");
        return;
    }

    tcp_set_nodelay(new_sockfd);
    tcp_set_keepalive(new_sockfd, TCP_KEEPALIVE_TIME, TCP_KEEPALIVE_INTVL, TCP_KEEPALIVE_PROBES);

    /* selva_proto will never see a chunk smaller than this. */
    (void)setsockopt(new_sockfd, SOL_SOCKET, SO_RCVLOWAT, &(int){SELVA_PROTO_FRAME_SIZE_MAX}, sizeof(int));

    int status = fcntl(new_sockfd, F_SETFL, fcntl(new_sockfd, F_GETFL, 0) | O_NONBLOCK);
    if (unlikely(status == -1)) {
        SELVA_LOG(SELVA_LOGL_WARN, "Failed to set sock (%d) non-blocking", new_sockfd);
    }

    inet_ntop(AF_INET, &client.sin_addr, buf, sizeof(buf));
    SELVA_LOG(SELVA_LOGL_DBG, "Received a connection from %s:%d", buf, ntohs(client.sin_port));

    conn_ctx->fd = new_sockfd;
    conn_ctx->flags.recv_state = CONN_CTX_RECV_STATE_NEW;
    conn_ctx->app.tim_hrt = SELVA_EINVAL;

    evl_wait_fd(new_sockfd, on_data, NULL, on_close, conn_ctx);
}

size_t selva_resp_to_str(const struct selva_server_response_out *resp, char *buf, size_t bsize)
{
    if (bsize < CONN_STR_LEN) {
        return 0;
    }

    if (!resp || !resp->ctx) {
        strcpy(buf, "<not connected>");
        return 15;
    }

    return conn_to_str(resp->ctx, buf, bsize);
}

int selva_resp_cmp_conn(
        const struct selva_server_response_out *resp_a,
        const struct selva_server_response_out *resp_b)
{
    return resp_a->ctx && resp_b->ctx && resp_a->ctx == resp_b->ctx;
}

int selva_resp_to_cmd_id(struct selva_server_response_out *resp)
{
    return resp->cmd;
}

int64_t selva_resp_to_ts(struct selva_server_response_out *resp)
{
    return resp->ts;
}

static int run_cmd(struct selva_server_response_out * restrict resp, const void * restrict msg, size_t msg_size, bool force)
{
    struct command *cmd;
    int err;

    cmd = get_command(resp->cmd);
    if (cmd) {
        if (force || !(cmd->cmd_mode & SELVA_CMD_MODE_MUTATE && readonly_server)) {
            /*
             * Run the command.
             */
            cmd->cmd_fn(resp, msg, msg_size);
            err = resp->last_error;
        } else {
            err = SELVA_PROTO_ENOTSUP;
            selva_send_errorf(resp, err, "Server is read-only");
        }
    } else {
        err = SELVA_EINVAL;
        selva_send_errorf(resp, err, "Invalid cmd_id: %d", resp->cmd);
    }

    return err;
}

int selva_server_run_cmd(int8_t cmd_id, int64_t ts, const void *msg, size_t msg_size)
{
    struct selva_server_response_out resp = {
        .ctx = NULL,
        .resp_msg_handler = SERVER_MESSAGE_HANDLER_NONE,
        .cmd = cmd_id,
        .last_error = 0,
        .ts = ts ? ts : ts_now(),
    };

    /*
     * Note that we don't care here whether the server is in read-only mode.
     * This is because we are currently using this function only for replication
     * purposes but if this changes then we might not want to do it like this.
     */
    return run_cmd(&resp, msg, msg_size, true);
}

int selva_server_run_cmd2buf(int8_t cmd_id, int64_t ts, const void *msg, size_t msg_size, struct selva_string *out)
{
    struct selva_server_response_out resp = {
        .ctx = NULL,
        .resp_msg_handler = SERVER_MESSAGE_HANDLER_BUF,
        .cmd = cmd_id,
        .last_error = 0,
        .ts = ts ? ts : ts_now(),
        .msg_buf = out,
    };

    return run_cmd(&resp, msg, msg_size, false);
}

IMPORT() {
    evl_import_main(selva_log);
    evl_import_main(selva_log_get_level);
    evl_import_main(selva_log_set_level);
    evl_import_main(selva_log_set_dbgpattern);
    evl_import_main(evl_get_next_module);
    evl_import_main(config_resolve);
    evl_import_main(config_list_get);
    evl_import_main(selva_langs);
    evl_import_event_loop();
    import_selva_reaper();
}

__used static void query_fork_init(void)
{
    if (!query_fork.disabled) {
#if __linux__
        const int mmap_flags = MAP_SHARED | MAP_ANONYMOUS | MAP_LOCKED;
#else
        const int mmap_flags = MAP_SHARED | MAP_ANONYMOUS;
#endif
        if (hierarchy_auto_compress_period_ms > 0) {
            SELVA_LOG(SELVA_LOGL_CRIT, "query_fork and auto compression are mutually exclusive");
        }

        query_fork.ret_channel = mmap(NULL, sizeof(*query_fork.ret_channel),
                                      PROT_READ | PROT_WRITE, mmap_flags,
                                      -1, 0);
        selva_reaper_register_hook(handle_query_fork_exit, 1);
    }
}

__constructor static void init(void)
{
    evl_module_init("server");

    message_none_init(&message_handlers[SERVER_MESSAGE_HANDLER_NONE]);
    message_sock_init(&message_handlers[SERVER_MESSAGE_HANDLER_SOCK]);
    message_buf_init(&message_handlers[SERVER_MESSAGE_HANDLER_BUF]);

	if (config_resolve("server", server_cfg_map, num_elem(server_cfg_map))) {
        exit(EXIT_FAILURE);
    }

    if (max_clients >= EVENT_LOOP_MAX_FDS - 3) {
        SELVA_LOG(SELVA_LOGL_CRIT, "max_clients can't be greater than EVENT_LOOP_MAX_FDS minus few fds");
        exit(EXIT_FAILURE);
    }

    SELVA_MK_COMMAND(CMD_ID_PING, SELVA_CMD_MODE_PURE, ping);
    SELVA_MK_COMMAND(CMD_ID_ECHO, SELVA_CMD_MODE_PURE, echo);
    SELVA_MK_COMMAND(CMD_ID_LSCMD, SELVA_CMD_MODE_PURE, lscmd);
    SELVA_MK_COMMAND(CMD_ID_LSLANG, SELVA_CMD_MODE_PURE, lslang);
    SELVA_MK_COMMAND(CMD_ID_LSMOD, SELVA_CMD_MODE_PURE, lsmod);
    SELVA_MK_COMMAND(CMD_ID_HRT, SELVA_CMD_MODE_PURE, hrt);
    SELVA_MK_COMMAND(CMD_ID_CONFIG, SELVA_CMD_MODE_PURE, config);
    SELVA_MK_COMMAND(CMD_ID_LOGLEVEL, SELVA_CMD_MODE_PURE, loglevel);
    SELVA_MK_COMMAND(CMD_ID_DEBUG, SELVA_CMD_MODE_PURE, debug);
    SELVA_MK_COMMAND(CMD_ID_MALLOCSTATS, SELVA_CMD_MODE_PURE, mallocstats);
    SELVA_MK_COMMAND(CMD_ID_MALLOCPROFDUMP, SELVA_CMD_MODE_PURE, mallocprofdump);
    SELVA_MK_COMMAND(CMD_ID_RUSAGE, SELVA_CMD_MODE_PURE, rusage);
    selva_mk_command(CMD_ID_CLIENT, SELVA_CMD_MODE_PURE, "client", client_command);

#ifdef USE_QUERY_FORK
    query_fork_init();
#endif

    pubsub_init();
    conn_init(max_clients);
    server_sockfd = new_server(selva_port);
    evl_wait_fd(server_sockfd, on_connection, NULL, NULL, NULL);
}
