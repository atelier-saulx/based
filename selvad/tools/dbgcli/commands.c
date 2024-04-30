/*
 * Copyright (c) 2022-2024 SAULX
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
#include "util/selva_rusage.h"
#include "util/tcp.h"
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
static int cmd_index_acc_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[]);
static int cmd_publish_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[]);
static int cmd_subscribe_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[]);
static int cmd_replicaof_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[]);
static int cmd_purge_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[]);
static int cmd_mq_create_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[]);
static int cmd_mq_recv_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[]);

/*
 * Currently most commands encode the request arguments using strings and send
 * back more properly formatted responses (using integers, arrays, etc.). This
 * will change in the future once we optimize more things and move away from the
 * Redis ways.
 */
static int generic_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[]);
static void generic_res(const struct cmd *cmd, const void *msg, size_t msg_size);
static void rusage_res(const struct cmd *, const void *msg, size_t msg_size);
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
    [CMD_ID_RUSAGE] = {
        .cmd_id = CMD_ID_RUSAGE,
        .cmd_name = "rusage",
        .cmd_req = generic_req,
        .cmd_res = rusage_res,
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
    [CMD_ID_INDEX_ACC] = {
        .cmd_id = CMD_ID_INDEX_ACC,
        .cmd_name = "index.acc",
        .cmd_req = cmd_index_acc_req,
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
    [CMD_ID_PURGE] = {
        .cmd_id = CMD_ID_PURGE,
        .cmd_name = "purge",
        .cmd_req = cmd_purge_req,
        .cmd_res = generic_res,
    },
    [CMD_ID_MQ_CREATE] = {
        .cmd_id = CMD_ID_MQ_CREATE,
        .cmd_name = "mq.create",
        .cmd_req = cmd_mq_create_req,
        .cmd_res = generic_res,
    },
    [CMD_ID_MQ_RECV] = {
        .cmd_id = CMD_ID_MQ_RECV,
        .cmd_name = "mq.recv",
        .cmd_req = cmd_mq_recv_req,
        .cmd_res = generic_res,
    },
    [CMD_ID_MQ_ACK] = {
        .cmd_id = CMD_ID_MQ_ACK,
        .cmd_name = "mq.ack",
        .cmd_req = cmd_mq_create_req, /* reuse the same handler */
        .cmd_res = generic_res,
    },
    [CMD_ID_MQ_NACK] = {
        .cmd_id = CMD_ID_MQ_NACK,
        .cmd_name = "mq.nack",
        .cmd_req = cmd_mq_create_req, /* reuse the same handler */
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
        struct iovec rd_vec[2] = {
            {
                .iov_base = &resp_hdr,
                .iov_len = sizeof(resp_hdr),
            },
            {
                .iov_base = msg_buf + i,
                .iov_len = SELVA_PROTO_FRAME_SIZE_MAX - sizeof(resp_hdr),
            },
        };
        ssize_t r;

        r = tcp_readv(fd, rd_vec, num_elem(rd_vec));
        if (r != SELVA_PROTO_FRAME_SIZE_MAX) {
            fprintf(stderr, "Reading selva_proto frame failed. result: %d\n", (int)r);
            exit(EXIT_FAILURE);
        } else {
            size_t frame_bsize = le16toh(resp_hdr.frame_bsize);
            const size_t payload_size = frame_bsize - sizeof(resp_hdr);

            if (frame_bsize < sizeof(resp_hdr)) {
                fprintf(stderr, "Invalid frame_bsize: %zu\n", frame_bsize);
                return;
            }

            if (!(resp_hdr.flags & SELVA_PROTO_HDR_FREQ_RES)) {
                fprintf(stderr, "Invalid response: response bit not set. flags: %x\n", resp_hdr.flags);
                return;
            } else if (i + payload_size > sizeof(msg_buf)) {
                fprintf(stderr, "Buffer overflow\n");
                return;
            }

            i += payload_size;

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
#if 0
            if (resp_hdr.flags & SELVA_PROTO_HDR_FLAST) {
                return;
            }
#endif

            handle_response(&resp_hdr, msg_buf, i);
            i = 0;
        }
    } while (!(resp_hdr.flags & SELVA_PROTO_HDR_FLAST));

    handle_response(&resp_hdr, msg_buf, i);
}

static int cmd_ping_req(const struct cmd *cmd, int sock, int seqno, int argc __unused, char *argv[] __unused)
{
    _Alignas(struct selva_proto_header) char buf[SELVA_PROTO_FRAME_SIZE_MAX];
    struct selva_proto_header *hdr = (struct selva_proto_header *)buf;

    memset(hdr, 0, sizeof(*hdr));
    hdr->cmd = cmd->cmd_id;
    hdr->flags = SELVA_PROTO_HDR_FFIRST | SELVA_PROTO_HDR_FLAST;
    hdr->seqno = htole32(seqno);
    hdr->frame_bsize = htole16(sizeof(*hdr));
    hdr->msg_bsize = 0;
    hdr->chk = htole32(crc32c(0, buf, sizeof(*hdr)));

    struct iovec iov[] = {
        {
            .iov_base = &buf,
            .iov_len = sizeof(buf),
        },
    };
    if (tcp_writev(sock, iov, num_elem(iov)) < 0) { /* TODO should actually check the size */
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

    size_t pad_len = SELVA_PROTO_FRAME_SIZE_MAX - sizeof(buf) - accessor_len;
    char pad_buf[pad_len];
    struct iovec iov[] = {
        {
            .iov_base = &buf,
            .iov_len = sizeof(buf),
        },
        {
            .iov_base = (void *)accessor_str,
            .iov_len = accessor_len,
        },
        {
            .iov_base = pad_buf,
            .iov_len = pad_len,
        }
    };
    if (tcp_writev(sock, iov, num_elem(iov)) < 0) { /* TODO should actually check the size */
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

    size_t pad_len = SELVA_PROTO_FRAME_SIZE_MAX - sizeof(buf);
    char pad_buf[pad_len];
    struct iovec iov[] = {
        {
            .iov_base = &buf,
            .iov_len = sizeof(buf),
        },
        {
            .iov_base = pad_buf,
            .iov_len = pad_len,
        }
    };
    if (tcp_writev(sock, iov, num_elem(iov)) < 0) { /* TODO should actually check the size */
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

    size_t pad_len = SELVA_PROTO_FRAME_SIZE_MAX - sizeof(buf);
    char pad_buf[pad_len];
    struct iovec iov[] = {
        {
            .iov_base = &buf,
            .iov_len = sizeof(buf),
        },
        {
            .iov_base = pad_buf,
            .iov_len = pad_len,
        }
    };
    if (tcp_writev(sock, iov, num_elem(iov)) < 0) { /* TODO should actually check the size */
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

    size_t pad_len = SELVA_PROTO_FRAME_SIZE_MAX - sizeof(buf);
    char pad_buf[pad_len];
    struct iovec iov[] = {
        {
            .iov_base = &buf,
            .iov_len = sizeof(buf),
        },
        {
            .iov_base = pad_buf,
            .iov_len = pad_len,
        }
    };
    if (tcp_writev(sock, iov, num_elem(iov)) < 0) { /* TODO should actually check the size */
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

    size_t pad_len = SELVA_PROTO_FRAME_SIZE_MAX - sizeof(buf) - value_len;
    char pad_buf[pad_len];
    struct iovec iov[] = {
        {
            .iov_base = &buf,
            .iov_len = sizeof(buf),
        },
        {
            .iov_base = (void *)value_str,
            .iov_len = value_len,
        },
        {
            .iov_base = pad_buf,
            .iov_len = pad_len,
        }
    };
    if (tcp_writev(sock, iov, num_elem(iov)) < 0) { /* TODO should actually check the size */
        return -1;
    }

    return 0;
}

static int cmd_index_acc_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[])
{
    if (argc != 4) {
        fprintf(stderr, "Invalid arguments\n");
        return -1;
    }

    const size_t icb_len = strlen(argv[1]);
    size_t buf_size = sizeof(struct selva_proto_header) +
             sizeof(struct selva_proto_string) + icb_len +
             sizeof(struct selva_proto_longlong) +
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
            .bsize = htole32(icb_len),
        },
        sizeof(struct selva_proto_string));
    p += sizeof(struct selva_proto_string);
    memcpy((char *)p, argv[1], icb_len);
    p += icb_len;

    memcpy(p, &(struct selva_proto_longlong){
            .type = SELVA_PROTO_LONGLONG,
            .flags = 0,
            .v = htole64(argc == 4 ? strtol(argv[2], NULL, 10) : 1),
        },
        sizeof(struct selva_proto_longlong));
    p += sizeof(struct selva_proto_longlong);

    memcpy(p, &(struct selva_proto_longlong){
            .type = SELVA_PROTO_LONGLONG,
            .flags = 0,
            .v = htole64(argc == 4 ? strtol(argv[3], NULL, 10) : 1),
        },
        sizeof(struct selva_proto_longlong));
    p += sizeof(struct selva_proto_longlong);

    memcpy(buf + offsetof(struct selva_proto_header, chk), &(CHK_T){htole32(crc32c(0, buf, buf_size))}, sizeof(CHK_T));

    size_t pad_len = SELVA_PROTO_FRAME_SIZE_MAX - sizeof(buf);
    char pad_buf[pad_len];
    struct iovec iov[] = {
        {
            .iov_base = &buf,
            .iov_len = sizeof(buf),
        },
        {
            .iov_base = pad_buf,
            .iov_len = pad_len,
        }
    };
    if (tcp_writev(sock, iov, num_elem(iov)) < 0) { /* TODO should actually check the size */
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

    size_t pad_len = SELVA_PROTO_FRAME_SIZE_MAX - sizeof(buf) - message_len;
    char pad_buf[pad_len];
    struct iovec iov[] = {
        {
            .iov_base = &buf,
            .iov_len = sizeof(buf),
        },
        {
            .iov_base = (void *)message_str,
            .iov_len = message_len,
        },
        {
            .iov_base = pad_buf,
            .iov_len = pad_len,
        }
    };
    if (tcp_writev(sock, iov, num_elem(iov)) < 0) { /* TODO should actually check the size */
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

    size_t pad_len = SELVA_PROTO_FRAME_SIZE_MAX - sizeof(buf);
    char pad_buf[pad_len];
    struct iovec iov[] = {
        {
            .iov_base = &buf,
            .iov_len = sizeof(buf),
        },
        {
            .iov_base = pad_buf,
            .iov_len = pad_len,
        }
    };
    if (tcp_writev(sock, iov, num_elem(iov)) < 0) { /* TODO should actually check the size */
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

    size_t pad_len = SELVA_PROTO_FRAME_SIZE_MAX - sizeof(buf) - addr_len;
    char pad_buf[pad_len];
    struct iovec iov[] = {
        {
            .iov_base = &buf,
            .iov_len = sizeof(buf),
        },
        {
            .iov_base = (void *)addr_str,
            .iov_len = addr_len,
        },
        {
            .iov_base = pad_buf,
            .iov_len = pad_len,
        }
    };
    if (tcp_writev(sock, iov, num_elem(iov)) < 0) { /* TODO should actually check the size */
        return -1;
    }

    return 0;
}

static int cmd_purge_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[])
{
    if (argc != 2) {
        fprintf(stderr, "Invalid arguments\n");
        return -1;
    }

    struct {
        struct selva_proto_header hdr;
        struct selva_proto_longlong n;
    } __packed buf = {
        .hdr = {
            .cmd = cmd->cmd_id,
            .flags = SELVA_PROTO_HDR_FFIRST | SELVA_PROTO_HDR_FLAST,
            .seqno = htole32(seqno),
            .frame_bsize = htole16(sizeof(buf)),
        },
        .n = {
            .type = SELVA_PROTO_LONGLONG,
            .v = htole64(strtol(argv[1], NULL, 10)),
        },
    };

    buf.hdr.chk = htole32(crc32c(0, &buf, sizeof(buf)));

    size_t pad_len = SELVA_PROTO_FRAME_SIZE_MAX - sizeof(buf);
    char pad_buf[pad_len];
    struct iovec iov[] = {
        {
            .iov_base = &buf,
            .iov_len = sizeof(buf),
        },
        {
            .iov_base = pad_buf,
            .iov_len = pad_len,
        }
    };
    if (tcp_writev(sock, iov, num_elem(iov)) < 0) { /* TODO should actually check the size */
        return -1;
    }

    return 0;
}

static int cmd_mq_create_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[])
{
    if (argc < 2) {
        fprintf(stderr, "Invalid arguments\n");
        return -1;
    }

    const char *name_str = argv[1];
    size_t name_len = strlen(name_str);
    struct {
        struct selva_proto_header hdr;
        struct selva_proto_string name;
    } __packed buf1 = {
        .hdr = {
            .cmd = cmd->cmd_id,
            .flags = SELVA_PROTO_HDR_FFIRST | SELVA_PROTO_HDR_FLAST,
            .seqno = htole32(seqno),
        },
        .name = {
            .type = SELVA_PROTO_STRING,
            .bsize = htole32(name_len),
        },
    };
    struct {
        struct selva_proto_longlong timeout;
    } __packed buf2 = {
        .timeout = {
            .type = SELVA_PROTO_LONGLONG,
            .v = argc >= 3 ? htole64(strtol(argv[2], NULL, 10)) : 0,
        },
    };


    buf1.hdr.frame_bsize = htole16(
            sizeof(buf1) + name_len +
            (argc >= 3) * sizeof(buf2));

    buf1.hdr.chk = crc32c(crc32c(0, &buf1, sizeof(buf1)), name_str, name_len);
    if (argc >= 3) buf1.hdr.chk = crc32c(buf1.hdr.chk, &buf2, sizeof(buf2));
    buf1.hdr.chk = htole32(buf1.hdr.chk);

    size_t pad_len = SELVA_PROTO_FRAME_SIZE_MAX - sizeof(buf1) - name_len;
    struct iovec iov[4] = {
        {
            .iov_base = &buf1,
            .iov_len = sizeof(buf1),
        },
        {
            .iov_base = (void *)name_str,
            .iov_len = name_len,
        },
    };
    if (argc >= 3) {
        iov[2] = (struct iovec){
            .iov_base = &buf2,
            .iov_len = sizeof(buf2),
        };
        pad_len -= sizeof(buf2);
    }
    char pad_buf[pad_len];
    iov[argc >= 3 ? 3 : 2] = (struct iovec){
        .iov_base = pad_buf,
        .iov_len = pad_len,
    };
    if (tcp_writev(sock, iov, argc >= 3 ? 4 : 3) < 0) { /* TODO should actually check the size */
        return -1;
    }

    return 0;
}

static int cmd_mq_recv_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[])
{
    if (argc < 2) {
        fprintf(stderr, "Invalid arguments\n");
        return -1;
    }

    const char *name_str = argv[1];
    size_t name_len = strlen(name_str);
    struct {
        struct selva_proto_header hdr;
        struct selva_proto_string name;
    } __packed buf1 = {
        .hdr = {
            .cmd = cmd->cmd_id,
            .flags = SELVA_PROTO_HDR_FFIRST | SELVA_PROTO_HDR_FLAST,
            .seqno = htole32(seqno),
        },
        .name = {
            .type = SELVA_PROTO_STRING,
            .bsize = htole32(name_len),
        },
    };
    struct {
        struct selva_proto_longlong msg_min;
    } __packed buf2 = {
        .msg_min = {
            .type = SELVA_PROTO_LONGLONG,
            .v = argc >= 3 ? htole64(strtol(argv[2], NULL, 10)) : 0,
        },
    };
    struct {
        struct selva_proto_longlong msg_max;
    } __packed buf3 = {
        .msg_max = {
            .type = SELVA_PROTO_LONGLONG,
            .v = argc >= 4 ? htole64(strtol(argv[3], NULL, 10)) : 0,
        },
    };
    struct {
        struct selva_proto_longlong timeout;
    } __packed buf4 = {
        .timeout = {
            .type = SELVA_PROTO_LONGLONG,
            .v = argc >= 5 ? htole64(strtol(argv[4], NULL, 10)) : 0,
        },
    };

    buf1.hdr.frame_bsize = htole16(
            sizeof(buf1) + name_len +
            (argc >= 3) * sizeof(buf2) +
            (argc >= 4) * sizeof(buf3) +
            (argc >= 5) * sizeof(buf4));

    buf1.hdr.chk = crc32c(crc32c(0, &buf1, sizeof(buf1)), name_str, name_len);
    if (argc >= 3) buf1.hdr.chk = crc32c(buf1.hdr.chk, &buf2, sizeof(buf2));
    if (argc >= 4) buf1.hdr.chk = crc32c(buf1.hdr.chk, &buf3, sizeof(buf3));
    if (argc >= 5) buf1.hdr.chk = crc32c(buf1.hdr.chk, &buf4, sizeof(buf4));
    buf1.hdr.chk = htole32(buf1.hdr.chk);

    size_t pad_len = SELVA_PROTO_FRAME_SIZE_MAX - sizeof(buf2) - name_len;
    size_t iov_len = 2;
    struct iovec iov[5] = {
        {
            .iov_base = &buf1,
            .iov_len = sizeof(buf1),
        },
        {
            .iov_base = (void *)name_str,
            .iov_len = name_len,
        },
    };
    if (argc >= 3) {
        iov[iov_len++] = (struct iovec){
            .iov_base = &buf2,
            .iov_len = sizeof(buf2),
        };
        pad_len -= sizeof(buf2);
        iov_len++;
    }
    if (argc >= 4) {
        iov[iov_len++] = (struct iovec){
            .iov_base = &buf3,
            .iov_len = sizeof(buf3),
        };
        pad_len -= sizeof(buf3);
        iov_len++;
    }
    if (argc >= 5) {
        iov[iov_len++] = (struct iovec){
            .iov_base = &buf4,
            .iov_len = sizeof(buf4),
        };
        pad_len -= sizeof(buf4);
        iov_len++;
    }
    char pad_buf[pad_len];
    iov[iov_len++] = (struct iovec){
        .iov_base = pad_buf,
        .iov_len = pad_len,
    };
    if (tcp_writev(sock, iov, pad_len) < 0) { /* TODO should actually check the size */
        return -1;
    }

    return 0;
}

static int generic_req(const struct cmd *cmd, int sock, int seqno, int argc, char *argv[])
{
    const int seq = htole32(seqno);
    int arg_i = 1;
    int value_i = 0;
    int frame_nr = 0;

    while (arg_i < argc || frame_nr == 0) {
        _Alignas(struct selva_proto_header) char buf[SELVA_PROTO_FRAME_SIZE_MAX];
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

        if (arg_i == argc) {
            hdr->flags |= SELVA_PROTO_HDR_FLAST;
        }

        hdr->chk = 0;
        hdr->chk = htole32(crc32c(0, buf, frame_bsize));

        struct iovec iov[] = {
            {
                .iov_base = &buf,
                .iov_len = sizeof(buf),
            },
        };
        if (tcp_writev(sock, iov, num_elem(iov)) < 0) { /* TODO should actually check the size */
            return -1;
        }
    }

    return 0;
}

static void generic_res(const struct cmd *, const void *msg, size_t msg_size)
{
    selva_proto_print(stdout, msg, msg_size);
}

static void rusage_res(const struct cmd *, const void *msg, size_t msg_size)
{
    size_t i = 0;

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

        if (type == SELVA_PROTO_STRING && data_len == sizeof(struct selva_rusage)) {
            struct selva_rusage rusage;

            memcpy(&rusage, (char *)msg + i - data_len, data_len);
            /* TODO endianness */

            const char *unit = "kB";
            unsigned long long maxrss = rusage.ru_maxrss / 1024;

            if (maxrss > 1024) {
                maxrss /= 1024;
                unit = "MB";
            }
            if (maxrss > 1024) {
                maxrss /= 1024;
                unit = "GB";
            }
            if (maxrss > 1024) {
                maxrss /= 1024;
                unit = "TB";
            }

            printf("utime: %lld s stime: %lld s max_rss: %llu %s\n",
                   (long long)rusage.ru_utime.tv_sec,
                   (long long)rusage.ru_stime.tv_sec,
                   maxrss, unit);
        } else {
            fprintf(stderr, "Invalid response");
            return;
        }
    }
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
