/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#define __STDC_FORMAT_MACROS 1
#include <errno.h>
#include <inttypes.h>
#include <signal.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include "cdefs.h"
#include "endian.h"
#include "jemalloc.h"
#include "selva_db_types.h"
#include "selva_error.h"
#include "selva_proto.h"
#include "util/crc32c.h"
#include "../../commands.h"
#include "commands.h"

#define CHK_T typeof_field(struct selva_proto_header, chk)

#ifndef MSG_MORE
# define MSG_MORE 0
#endif

/**
 * Modify a single node.
 */
extern int cmd_modify_string_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[]);

/*
 * Ping is special because it has no body/payload.
 */
static int cmd_ping_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[]);
static void cmd_ping_res(const struct cmd *cmd, const void *msg, size_t msg_size);

/**
 * lscmd request is similar to ping.
 */
static int cmd_lscmd_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[]);

static int cmd_loglevel_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[]);
static int cmd_resolve_nodeid_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[]);
static int cmd_object_incrby_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[]);
static int cmd_object_cas_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[]);
static int cmd_hierarchy_compress(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[]);

static int cmd_publish_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[]);
static int cmd_subscribe_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[]);
static int cmd_replicaof_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[]);

/*
 * Currently most commands encode the request arguments using strings and send
 * back more properly formatted responses (using integers, arrays, etc.). This
 * will change in the future once we optimize more things and move away from the
 * Redis ways.
 */
static int generic_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[]);
static void generic_res(const struct cmd *cmd, const void *msg, size_t msg_size);
static int skip_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[]);

/**
 * A map of Selva commands.
 * Only a few commands are hardcoded here as the others can be "discovered"
 * using `lscmd`.
 */
static struct cmd commands[255] = {
    [CMD_ID_PING] = {
        .cmd_id = CMD_ID_PING,
        .cmd_name = "ping",
        .cmd_req = cmd_ping_req,
        .cmd_res = cmd_ping_res,
    },
    [CMD_ID_ECHO] = {
        .cmd_id = CMD_ID_ECHO,
        .cmd_name = "echo",
        .cmd_req = generic_req,
        .cmd_res = generic_res,
    },
    [CMD_ID_LSCMD] = {
        .cmd_id = CMD_ID_LSCMD,
        .cmd_name = "lscmd",
        .cmd_req = cmd_lscmd_req,
        .cmd_res = generic_res,
    },
    [CMD_ID_LOGLEVEL] = {
        .cmd_id = CMD_ID_LOGLEVEL,
        .cmd_name = "loglevel",
        .cmd_req = cmd_loglevel_req,
        .cmd_res = generic_res,
    },
    [CMD_ID_RESOLVE_NODEID] = {
        .cmd_id = CMD_ID_RESOLVE_NODEID,
        .cmd_name = "resolve.nodeid",
        .cmd_req = cmd_resolve_nodeid_req,
        .cmd_res = generic_res,
    },
    [CMD_ID_OBJECT_INCRBY] = {
        .cmd_id = CMD_ID_OBJECT_INCRBY,
        .cmd_name = "object.incrby",
        .cmd_req = cmd_object_incrby_req,
        .cmd_res = generic_res,
    },
    [CMD_ID_OBJECT_CAS] = {
        .cmd_id = CMD_ID_OBJECT_CAS,
        .cmd_name = "object.cas",
        .cmd_req = cmd_object_cas_req,
        .cmd_res = generic_res,
    },
    [CMD_ID_HIERARCHY_COMPRESS] = {
        .cmd_id = CMD_ID_HIERARCHY_COMPRESS,
        .cmd_name = "hierarchy.compress",
        .cmd_req = cmd_hierarchy_compress,
        .cmd_res = generic_res,
    },
    [CMD_ID_PUBLISH] = {
        .cmd_id = CMD_ID_PUBLISH,
        .cmd_name = "publish",
        .cmd_req = cmd_publish_req,
        .cmd_res = generic_res,
    },
    [CMD_ID_SUBSCRIBE] = {
        .cmd_id = CMD_ID_SUBSCRIBE,
        .cmd_name = "subscribe",
        .cmd_req = cmd_subscribe_req,
        .cmd_res = generic_res,
    },
    [CMD_ID_UNSUBSCRIBE] = {
        .cmd_id = CMD_ID_UNSUBSCRIBE,
        .cmd_name = "unsubscribe",
        .cmd_req = cmd_subscribe_req,
        .cmd_res = generic_res,
    },
    [CMD_ID_REPLICAOF] = {
        .cmd_id = CMD_ID_REPLICAOF,
        .cmd_name = "replicaof",
        .cmd_req = cmd_replicaof_req,
        .cmd_res = generic_res,
    },
    [253] = {
        .cmd_id = CMD_ID_MODIFY,
        .cmd_name = "!modify.string",
        .cmd_req = cmd_modify_string_req,
        .cmd_res = generic_res,
    },
    [254] = { /* Pseudo-command: read the socket */
        .cmd_id = 254,
        .cmd_name = "!listen",
        .cmd_req = skip_req,
        .cmd_res = generic_res,
    }
};

int send_message(int fd, const void *buf, size_t size, int flags)
{
    if (send(fd, buf, size, flags) != (ssize_t)size) {
        fprintf(stderr, "Send failed\n");
        return -1; /* TODO Maybe an error code? */
    }

    return 0;
}

static void handle_response(struct selva_proto_header *resp_hdr, void *msg, size_t msg_size)
{
    static_assert((1 << (sizeof(resp_hdr->cmd) * 8)) - 1 <= num_elem(commands));
    if (resp_hdr->cmd < 0) {
        fprintf(stderr, "Invalid cmd_id: %d\n", resp_hdr->cmd);
    } else {
        struct cmd *cmd;

        cmd = &commands[resp_hdr->cmd];
        if (cmd->cmd_res) {
            cmd->cmd_res(cmd, msg, msg_size);
        } else {
            fprintf(stderr, "Unsupported command response\n");
        }
    }
}

static int flag_stop_recv;

static void recv_int_handler(int sig __unused)
{
    flag_stop_recv = 1;
}

static ssize_t recvn(int fd, void *buf, size_t n)
{
    ssize_t i = 0;

    while (i < (ssize_t)n) {
        ssize_t res;

        errno = 0;
        res = recv(fd, (char *)buf + i, n - i, 0);
        if (res <= 0) {
            if (errno == EINTR) {
                if (flag_stop_recv) {
                    fprintf(stderr, "Interrupted\n");
                    return res;
                }
                continue;
            }

            return res;
        }

        i += res;
    }

    return (ssize_t)i;
}

void recv_message(int fd)
{
    static _Alignas(uintptr_t) uint8_t msg_buf[100 * 1048576] __lazy_alloc_glob;
    struct selva_proto_header resp_hdr;
    size_t i = 0;

    flag_stop_recv = 0;
    (void)sigaction(SIGINT, &(const struct sigaction){
            .sa_handler = recv_int_handler,
            .sa_flags = SA_NODEFER | SA_RESETHAND
            }, NULL);

    do {
        ssize_t r;

        r = recvn(fd, &resp_hdr, sizeof(resp_hdr));
        if (r != (ssize_t)sizeof(resp_hdr)) {
            fprintf(stderr, "Reading selva_proto header failed. result: %d\n", (int)r);
            exit(1);
        } else {
            size_t frame_bsize = le16toh(resp_hdr.frame_bsize);
            const size_t payload_size = frame_bsize - sizeof(resp_hdr);

            if (!(resp_hdr.flags & SELVA_PROTO_HDR_FREQ_RES)) {
                fprintf(stderr, "Invalid response: response bit not set\n");
                return;
            } else if (i + payload_size > sizeof(msg_buf)) {
                fprintf(stderr, "Buffer overflow\n");
                return;
            }

            if (payload_size > 0) {
                r = recvn(fd, msg_buf + i, payload_size);
                if (r != (ssize_t)payload_size) {
                    fprintf(stderr, "Reading payload failed: result: %d expected: %d\n", (int)r, (int)payload_size);
                    return;
                }

                i += payload_size;
            }

            if (!selva_proto_verify_frame_chk(&resp_hdr, msg_buf + i - payload_size, payload_size)) {
                fprintf(stderr, "Checksum mismatch\n");
                return;
            }
        }

        /*
         * Note that we don't handle multiplexing or any kind of interleaved
         * responses here. We are just expecting that the server is only sending
         * us responses to a single command.
         */
        if (resp_hdr.flags & SELVA_PROTO_HDR_STREAM) {
            if (resp_hdr.flags & SELVA_PROTO_HDR_FLAST) {
                return;
            }

            handle_response(&resp_hdr, msg_buf, i);
            i = 0;
        }
    } while (!(resp_hdr.flags & SELVA_PROTO_HDR_FLAST));

    handle_response(&resp_hdr, msg_buf, i);
}

static int cmd_ping_req(const struct cmd *cmd, int sock, int seqno, int argc __unused, char *argv[] __unused)
{
    _Alignas(struct selva_proto_header) char buf[sizeof(struct selva_proto_header)];
    struct selva_proto_header *hdr = (struct selva_proto_header *)buf;

    memset(hdr, 0, sizeof(*hdr));
    hdr->cmd = cmd->cmd_id;
    hdr->flags = SELVA_PROTO_HDR_FFIRST | SELVA_PROTO_HDR_FLAST;
    hdr->seqno = htole32(seqno);
    hdr->frame_bsize = htole16(sizeof(buf));
    hdr->msg_bsize = 0;
    hdr->chk = htole32(crc32c(0, buf, sizeof(buf)));

    if (send_message(sock, buf, sizeof(buf), 0)) {
        return -1;
    }

    return 0;
}

static void cmd_ping_res(const struct cmd *, const void *msg, size_t msg_size)
{
    if (msg_size >= sizeof(struct selva_proto_control)) {
        struct selva_proto_control *ctrl = (struct selva_proto_control *)msg;

        if (ctrl->type == SELVA_PROTO_STRING && msg_size >= sizeof(struct selva_proto_string)) {
            struct selva_proto_string *s = (struct selva_proto_string *)msg;

            if (le32toh(s->bsize) <= msg_size - sizeof(struct selva_proto_string)) {
                printf("%.*s\n", (int)s->bsize, s->data);
            } else {
                fprintf(stderr, "Invalid string\n");
            }
        } else {
            fprintf(stderr, "ping: Unexpected response value type: %s\n", selva_proto_type_to_str(ctrl->type, NULL));
        }
    } else {
        fprintf(stderr, "Response is shorter than expected\n");
    }
}

static int cmd_resolve_nodeid_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[])
{
    if (argc != 3) {
        fprintf(stderr, "Invalid arguments\n");
        return -1;
    }

    const char *accessor_str = argv[2];
    size_t accessor_len = strlen(accessor_str);
    struct {
        struct selva_proto_header hdr;
        struct selva_proto_longlong sub_id;
        struct selva_proto_string accessor;
    } buf = {
        .hdr = {
            .cmd = cmd->cmd_id,
            .flags = SELVA_PROTO_HDR_FFIRST | SELVA_PROTO_HDR_FLAST,
            .seqno = htole32(seqno),
            .frame_bsize = htole16(sizeof(buf) + accessor_len),
            .msg_bsize = 0,
            .chk = 0,
        },
        .sub_id = {
            .type = SELVA_PROTO_LONGLONG,
            .v = htole64(strtol(argv[1], NULL, 10)),
        },
        .accessor = {
            .type = SELVA_PROTO_STRING,
            .flags = 0,
            .bsize = htole32(accessor_len),
        },
    };

    buf.hdr.chk = htole32(crc32c(crc32c(0, &buf, sizeof(buf)), accessor_str, accessor_len));

    if (send_message(sock, &buf, sizeof(buf), MSG_MORE) ||
        send_message(sock, accessor_str, accessor_len, 0)) {
        return -1;
    }

    return 0;
}

static int cmd_lscmd_req(const struct cmd *cmd, int sock, int seqno, int argc __unused, char *argv[] __unused)
{
    struct selva_proto_header buf = {
        .cmd = cmd->cmd_id,
        .flags = SELVA_PROTO_HDR_FFIRST | SELVA_PROTO_HDR_FLAST,
        .seqno = htole32(seqno),
        .frame_bsize = htole16(sizeof(buf)),
        .msg_bsize = 0,
    };

    buf.chk = htole32(crc32c(0, &buf, sizeof(buf)));

    if (send_message(sock, &buf, sizeof(buf), 0)) {
        return -1;
    }

    return 0;
}

static int cmd_loglevel_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[])
{
    if (argc != 2) {
        fprintf(stderr, "Invalid arguments\n");
        return -1;
    }

    struct {
        struct selva_proto_header hdr;
        struct selva_proto_longlong level;
    } __packed buf = {
        .hdr = {
            .cmd = cmd->cmd_id,
            .flags = SELVA_PROTO_HDR_FFIRST | SELVA_PROTO_HDR_FLAST,
            .seqno = htole32(seqno),
            .frame_bsize = htole16(sizeof(buf)),
            .msg_bsize = htole32(sizeof(buf) - sizeof(struct selva_proto_header)),
        },
        .level = {
            .type = SELVA_PROTO_LONGLONG,
            .v = htole64(strtol(argv[1], NULL, 10)),
        },
    };

    buf.hdr.chk = htole32(crc32c(0, &buf, sizeof(buf)));

    if (send_message(sock, &buf, sizeof(buf), 0)) {
        return -1;
    }

    return 0;
}

static int cmd_object_incrby_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[])
{
    if (argc != 3 && argc != 4) {
        fprintf(stderr, "Invalid arguments\n");
        return -1;
    }

    const size_t okey_len = strlen(argv[2]);
    const size_t node_id_len = SELVA_NODE_ID_SIZE;
    size_t buf_size = sizeof(struct selva_proto_header) +
             sizeof(struct selva_proto_string) + node_id_len +
             sizeof(struct selva_proto_string) + okey_len +
             sizeof(struct selva_proto_longlong);
    uint8_t buf[buf_size];
    uint8_t *p = buf;

    memset(buf, 0, buf_size);

    memcpy(p, &(struct selva_proto_header){
            .cmd = cmd->cmd_id,
            .flags = SELVA_PROTO_HDR_FFIRST | SELVA_PROTO_HDR_FLAST,
            .seqno = htole32(seqno),
            .frame_bsize = htole16(buf_size),
            .msg_bsize = 0,
        },
        sizeof(struct selva_proto_header));
    p += sizeof(struct selva_proto_header);

    memcpy(p, &(struct selva_proto_string){
            .type = SELVA_PROTO_STRING,
            .flags = 0,
            .bsize = htole32(node_id_len),
        },
        sizeof(struct selva_proto_string));
    p += sizeof(struct selva_proto_string);
    strncpy((char *)p, argv[1], node_id_len);
    p += node_id_len;

    memcpy(p, &(struct selva_proto_string){
            .type = SELVA_PROTO_STRING,
            .flags = 0,
            .bsize = htole32(okey_len),
        },
        sizeof(struct selva_proto_string));
    p += sizeof(struct selva_proto_string);
    memcpy(p, argv[2], okey_len);
    p += okey_len;

    memcpy(p, &(struct selva_proto_longlong){
            .type = SELVA_PROTO_LONGLONG,
            .flags = 0,
            .v = htole64(argc == 4 ? strtol(argv[3], NULL, 10) : 1),
        },
        sizeof(struct selva_proto_longlong));

    memcpy(buf + offsetof(struct selva_proto_header, chk), &(CHK_T){htole32(crc32c(0, buf, buf_size))}, sizeof(CHK_T));
    if (send_message(sock, buf, buf_size, 0)) {
        return -1;
    }

    return 0;
}

static int cmd_object_cas_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[])
{
    if (argc != 5) {
        fprintf(stderr, "Invalid arguments\n");
        return -1;
    }

    const size_t okey_len = strlen(argv[2]);
    const char *value_str = argv[4];
    const size_t value_len = strlen(value_str);
    const size_t node_id_len = SELVA_NODE_ID_SIZE;
    size_t buf_size = sizeof(struct selva_proto_header) +
             sizeof(struct selva_proto_string) + node_id_len +
             sizeof(struct selva_proto_string) + okey_len +
             sizeof(struct selva_proto_longlong) +
             sizeof(struct selva_proto_string);
    uint8_t buf[buf_size];
    uint8_t *p = buf;

    memset(buf, 0, buf_size);

    memcpy(p, &(struct selva_proto_header){
            .cmd = cmd->cmd_id,
            .flags = SELVA_PROTO_HDR_FFIRST | SELVA_PROTO_HDR_FLAST,
            .seqno = htole32(seqno),
            .frame_bsize = htole16(buf_size + value_len),
            .msg_bsize = 0,
        },
        sizeof(struct selva_proto_header));
    p += sizeof(struct selva_proto_header);

    memcpy(p, &(struct selva_proto_string){
            .type = SELVA_PROTO_STRING,
            .flags = 0,
            .bsize = htole32(node_id_len),
        },
        sizeof(struct selva_proto_string));
    p += sizeof(struct selva_proto_string);
    strncpy((char *)p, argv[1], node_id_len);
    p += node_id_len;

    memcpy(p, &(struct selva_proto_string){
            .type = SELVA_PROTO_STRING,
            .flags = 0,
            .bsize = htole32(okey_len),
        },
        sizeof(struct selva_proto_string));
    p += sizeof(struct selva_proto_string);
    memcpy(p, argv[2], okey_len);
    p += okey_len;

    memcpy(p, &(struct selva_proto_longlong){
            .type = SELVA_PROTO_LONGLONG,
            .flags = 0,
            .v = htole64(strtol(argv[3], NULL, 10)),
        },
        sizeof(struct selva_proto_longlong));
    p += sizeof(struct selva_proto_longlong);

    memcpy(p, &(struct selva_proto_string){
            .type = SELVA_PROTO_STRING,
            .flags = 0,
            .bsize = htole32(value_len),
        },
        sizeof(struct selva_proto_string));

    memcpy(buf + offsetof(struct selva_proto_header, chk), &(CHK_T){htole32(crc32c(crc32c(0, buf, buf_size), value_str, value_len))}, sizeof(CHK_T));
    if (send_message(sock, buf, buf_size, MSG_MORE) ||
        send_message(sock, value_str, value_len, 0)) {
        return -1;
    }

    return 0;
}

static int cmd_hierarchy_compress(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[])
{
    if (argc != 2 && argc != 3) {
        fprintf(stderr, "Invalid arguments\n");
        return -1;
    }

    struct {
        struct selva_proto_header hdr;
        struct selva_proto_string node_id_hdr;
        char node_id[SELVA_NODE_ID_SIZE];
        struct selva_proto_longlong type;
    } buf = {
        .hdr = {
            .cmd = cmd->cmd_id,
            .flags = SELVA_PROTO_HDR_FFIRST | SELVA_PROTO_HDR_FLAST,
            .seqno = htole32(seqno),
            .frame_bsize = htole16(sizeof(buf)),
        },
        .node_id_hdr = {
            .type = SELVA_PROTO_STRING,
            .bsize = htole32(SELVA_NODE_ID_SIZE),
        },
        .type = {
            .type = SELVA_PROTO_LONGLONG,
            .v = htole64(argc == 4 ? strtol(argv[2], NULL, 10) : 1),
        },
    };
    strncpy(buf.node_id, argv[1], SELVA_NODE_ID_SIZE);

    buf.hdr.chk = htole32(crc32c(0, &buf, sizeof(buf)));
    if (send_message(sock, &buf, sizeof(buf), 0)) {
        return -1;
    }

    return 0;
}

static int cmd_publish_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[])
{
    if (argc != 3) {
        fprintf(stderr, "Invalid arguments\n");
        return -1;
    }

    const char *message_str = argv[2];
    const size_t message_len = strlen(message_str);
    struct {
        struct selva_proto_header hdr;
        struct selva_proto_longlong channel;
        struct selva_proto_string message;
    } __packed buf = {
        .hdr = {
            .cmd = cmd->cmd_id,
            .flags = SELVA_PROTO_HDR_FFIRST | SELVA_PROTO_HDR_FLAST,
            .seqno = htole32(seqno),
            .frame_bsize = htole16(sizeof(buf) + message_len),
            .msg_bsize = 0,
            .chk = 0,
        },
        .channel = {
            .type = SELVA_PROTO_LONGLONG,
            .v = htole64(strtol(argv[1], NULL, 10))
        },
        .message = {
            .type = SELVA_PROTO_STRING,
            .flags = 0,
            .bsize = htole32(message_len),
        },
    };
    uint32_t chk;

    chk = crc32c(0, &buf, sizeof(buf));
    chk = crc32c(chk, message_str, message_len);
    buf.hdr.chk = htole32(chk);

    if (send_message(sock, &buf, sizeof(buf), MSG_MORE) ||
        send_message(sock, message_str, message_len, 0)
       ) {
        return -1;
    }
    return 0;
}

static int cmd_subscribe_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[])
{
    if (argc != 2) {
        fprintf(stderr, "Invalid arguments\n");
        return -1;
    }

    struct {
        struct selva_proto_header hdr;
        struct selva_proto_longlong channel;
    } __packed buf = {
        .hdr = {
            .cmd = cmd->cmd_id,
            .flags = SELVA_PROTO_HDR_FFIRST | SELVA_PROTO_HDR_FLAST,
            .seqno = htole32(seqno),
            .frame_bsize = htole16(sizeof(buf)),
            .msg_bsize = 0,
            .chk = 0,
        },
        .channel = {
            .type = SELVA_PROTO_LONGLONG,
            .v = htole64(strtol(argv[1], NULL, 10))
        },
    };

    buf.hdr.chk = htole32(crc32c(0, &buf, sizeof(buf)));

    if (send_message(sock, &buf, sizeof(buf), 0)) {
        return -1;
    }
    return 0;
}

static int cmd_replicaof_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[])
{
    if (argc != 3) {
        fprintf(stderr, "Invalid arguments\n");
        return -1;
    }

    long long port = strtol(argv[1], NULL, 10);
    const char *addr_str = argv[2];
    size_t addr_len = strlen(addr_str);
    struct {
        struct selva_proto_header hdr;
        struct selva_proto_longlong port;
        struct selva_proto_string addr;
    } __packed buf = {
        .hdr = {
            .cmd = cmd->cmd_id,
            .flags = SELVA_PROTO_HDR_FFIRST | SELVA_PROTO_HDR_FLAST,
            .seqno = htole32(seqno),
            .frame_bsize = htole16(sizeof(buf) + addr_len),
            .msg_bsize = 0,
            .chk = 0,
        },
        .port = {
            .type = SELVA_PROTO_LONGLONG,
            .v = htole64(port)
        },
        .addr = {
            .type = SELVA_PROTO_STRING,
            .flags = 0,
            .bsize = htole32(addr_len),
        },
    };

    buf.hdr.chk = htole32(crc32c(crc32c(0, &buf, sizeof(buf)), addr_str, addr_len));

    if (send_message(sock, &buf, sizeof(buf), MSG_MORE) ||
         send_message(sock, addr_str, addr_len, 0)) {
        return -1;
    }
    return 0;
}

static int generic_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[])
{
    const int seq = htole32(seqno);
#define FRAME_PAYLOAD_SIZE_MAX (sizeof(struct selva_proto_string) + 20)
    int arg_i = 1;
    int value_i = 0;
    int frame_nr = 0;

    while (arg_i < argc || frame_nr == 0) {
        _Alignas(struct selva_proto_header) char buf[sizeof(struct selva_proto_header) + FRAME_PAYLOAD_SIZE_MAX];
        struct selva_proto_header *hdr = (struct selva_proto_header *)buf;
        size_t frame_bsize = sizeof(*hdr);

        memset(hdr, 0, sizeof(*hdr));
        hdr->cmd = cmd->cmd_id;
        hdr->flags = (frame_nr++ == 0) ? SELVA_PROTO_HDR_FFIRST : 0;
        hdr->seqno = seq;
        hdr->msg_bsize = 0;

        while (frame_bsize < sizeof(buf) && arg_i < argc) {
            if (value_i == 0) {
                const struct selva_proto_string str_hdr = {
                    .type = SELVA_PROTO_STRING,
                    .bsize = htole32(strlen(argv[arg_i])),
                };

                if (frame_bsize + sizeof(str_hdr) >= sizeof(buf)) {
                    break;
                }

                memcpy(buf + frame_bsize, &str_hdr, sizeof(str_hdr));
                frame_bsize += sizeof(str_hdr);
            }

            while (frame_bsize < sizeof(buf)) {
                const char c = argv[arg_i][value_i++];

                if (c == '\0') {
                    arg_i++;
                    value_i = 0;
                    break;
                }
                buf[frame_bsize++] = c;
            }
        }
        hdr->frame_bsize = htole16(frame_bsize);

        int send_flags = 0;

        if (arg_i == argc) {
            hdr->flags |= SELVA_PROTO_HDR_FLAST;
        } else {
#if     __linux__
            send_flags = MSG_MORE;
#endif
        }

        hdr->chk = 0;
        hdr->chk = htole32(crc32c(0, buf, frame_bsize));

        send_message(sock, buf, frame_bsize, send_flags);
    }

#undef FRAME_PAYLOAD_SIZE_MAX
    return 0;
}

static void generic_res(const struct cmd *, const void *msg, size_t msg_size)
{
    selva_proto_print(stdout, msg, msg_size);
}

static int skip_req(const struct cmd *, int sock __unused, int seqno __unused, int argc __unused, char *argv[] __unused)
{
    return 0;
}

static void cmd_discover_res(const struct cmd *, const void *msg, size_t msg_size)
{
    size_t i = 0;
    int level = 0;
    int cmd_id;

    while (msg && i < msg_size) {
        enum selva_proto_data_type type;
        size_t data_len;
        int off;

        off = selva_proto_parse_vtype(msg, msg_size, i, &type, &data_len);
        if (off <= 0) {
            if (off < 0) {
                fprintf(stderr, "Failed to parse a value header: %s\n", selva_strerror(off));
            }
            return;
        }

        i += off;

        if (level < 2) {
            if (type == SELVA_PROTO_ARRAY) {
                level++;
            } else if (type == SELVA_PROTO_ARRAY_END) {
                printf("Commands discovery complete\n");
                break;
            } else {
                fprintf(stderr, "Invalid response from lscmd\n");
                break;
            }
        } else if (level == 2) {
            if (type == SELVA_PROTO_LONGLONG) {
                uint64_t ll;

                memcpy(&ll, (char *)msg + i - sizeof(ll), sizeof(ll));
                cmd_id = le64toh(ll);
            } else if (type == SELVA_PROTO_STRING) {
                struct cmd *cmd = &commands[cmd_id];

                if (!cmd->cmd_name) {
                    char *cmd_name = selva_malloc(data_len + 1);

                    memcpy(cmd_name, (char *)msg + i - data_len, data_len);
                    cmd_name[data_len] = '\0';

                    cmd->cmd_id = cmd_id;
                    cmd->cmd_name = cmd_name;
                    cmd->cmd_req = generic_req;
                    cmd->cmd_res = generic_res;
                }

                level--;
            } else {
                fprintf(stderr, "Invalid response from lscmd\n");
                break;
            }
        }
    }
}

void cmd_discover(int fd, int seqno)
{
    const size_t id = 2;
    const cmd_res_fn prev_cmd_res = commands[id].cmd_res;

    commands[id].cmd_res = cmd_discover_res;

    if (cmd_lscmd_req(&commands[id], fd, seqno, 0, NULL)) {
        fprintf(stderr, "Commands discovery failed\n");
    } else {
        recv_message(fd);
    }

    commands[id].cmd_res = prev_cmd_res;
}

void cmd_foreach(void (*cb)(struct cmd *cmd))
{
    for (struct cmd *cmd = &commands[0]; cmd != commands + num_elem(commands); cmd++) {
        if (cmd->cmd_name) {
            cb(cmd);
        }
    }
}
