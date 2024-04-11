/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <arpa/inet.h>
#include <assert.h>
#include <ctype.h>
#include <errno.h>
#include <netinet/tcp.h>
#include <pthread.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/uio.h>
#include <unistd.h>
#include "cdefs.h"
#include "endian.h"
#include "util/crc32c.h"
#include "util/ctime.h"
#include "util/tcp.h"
#include "util/timestamp.h"
#include "selva_db_types.h"
#include "selva_error.h"
#include "selva_proto.h"
#include "../../modules/db/include/find_cmd.h"
#include "../../commands.h"

#define MSG_BUF_SIZE 100 * 1048576

typedef typeof_field(struct selva_proto_header, flags) flags_t;

struct thread_args {
    int fd;
    int n;
};

static int flag_stop;

static void sigint_handler(int sig __unused)
{
    flag_stop = 1;
}

[[nodiscard]]
static int connect_to_server(const char *addr, int port)
{
    int sock;
    struct sockaddr_in serv_addr;

    if ((sock = socket(AF_INET, SOCK_STREAM, 0)) == -1) {
        fprintf(stderr, "Could not create a socket\n");
        return -1;
    }

    (void)setsockopt(sock, IPPROTO_TCP, TCP_NODELAY, &(int){1}, sizeof(int));
    (void)setsockopt(sock, SOL_SOCKET, SO_RCVLOWAT, &(int){SELVA_PROTO_FRAME_SIZE_MAX}, sizeof(int));

    serv_addr.sin_family = AF_INET;
    serv_addr.sin_port = htons(port);

    if (inet_pton(AF_INET, addr, &serv_addr.sin_addr) == -1) {
        fprintf(stderr, "Invalid address\n");
        return -1;
    }

    if (connect(sock, (struct sockaddr*)&serv_addr, sizeof(serv_addr)) == -1) {
        fprintf(stderr, "Connection to %s:%d failed\n", addr, port);
        return -1;
    }

    return sock;
}

static int send_message(int fd, const void *buf, size_t size, bool flush)
{
#define IO_BUFS 1000
    static char io_buf[IO_BUFS][SELVA_PROTO_FRAME_SIZE_MAX];
    static struct iovec vec[IO_BUFS];
    static size_t vec_i;

    assert(size < SELVA_PROTO_FRAME_SIZE_MAX);
    memcpy(io_buf[vec_i], buf, size);
    vec[vec_i] = (struct iovec){
        .iov_base = io_buf[vec_i],
        .iov_len = SELVA_PROTO_FRAME_SIZE_MAX,
    };

    if (++vec_i >= num_elem(vec) || flush) {
        ssize_t res = tcp_writev(fd, vec, vec_i);
        vec_i = 0;

        if (res < 0) {
            fprintf(stderr, "Send failed: \"%s\"\n", strerror(errno));
            return -1;
        }
    }

    return 0;
}

static int send_schema(int fd, int seqno)
{
    struct SelvaFieldSchema { /* from db/include/schema.h */
        char field_name[SELVA_SHORT_FIELD_NAME_LEN];
        enum SelvaFieldSchemaType {
            SELVA_FIELD_SCHEMA_TYPE_DATA = 0,
            SELVA_FIELD_SCHEMA_TYPE_EDGE = 1,
        } __packed type1;
        uint8_t type2; /* enum SelvaObjectType */
        uint16_t meta; /* SelvaObjectMeta_t */
    };
    struct client_schema { /* from db/hierarchy/schema.c */
        uint32_t nr_emb_fields;
        char type[SELVA_NODE_TYPE_SIZE];
        uint8_t created_en;
        uint8_t updated_en;
        const char *field_schema_str;
        size_t field_schema_len;
        const char *edge_constraints_str; /* n * EdgeFieldDynConstraintParams */
        size_t edge_constraints_len;
    };
    struct {
        struct selva_proto_header hdr;
        struct selva_proto_array arr;
        struct selva_proto_string type0_hdr;
        struct client_schema type0;
        /* Flexible/heap data for type0 */
        char type0_fs[2 * sizeof(struct SelvaFieldSchema)];
    } __packed buf = {
        .hdr = {
            .cmd = CMD_ID_HIERARCHY_SCHEMA_SET,
            .flags = SELVA_PROTO_HDR_FFIRST | SELVA_PROTO_HDR_FLAST,
            .seqno = htole32(seqno),
            .frame_bsize = htole16(sizeof(buf)),
        },
        .arr = {
            .type = SELVA_PROTO_ARRAY,
            .flags = 0,
            .length = htole32(1),
        },
        .type0_hdr = {
            .type = SELVA_PROTO_STRING,
            .bsize = htole32(sizeof(buf.type0) + sizeof(buf.type0_fs)),
        },
        .type0 = {
            .type = "ma",
            .nr_emb_fields = 2,
            .created_en = false,
            .updated_en = false,
            .edge_constraints_len = 0,
            .field_schema_str = (void *)sizeof(struct client_schema), /* offset */
            .field_schema_len = sizeof(buf.type0_fs),
        },
    };

    memcpy(buf.type0_fs,
           &(struct SelvaFieldSchema){
               .field_name = "field",
               .type1 = SELVA_FIELD_SCHEMA_TYPE_DATA,
               .type2 = 3, /* SELVA_OBJECT_STRING */
               .meta = 0,
           }, sizeof(struct SelvaFieldSchema));
    memcpy(buf.type0_fs + sizeof(struct SelvaFieldSchema),
           &(struct SelvaFieldSchema){
               .field_name = "num",
               .type1 = SELVA_FIELD_SCHEMA_TYPE_DATA,
               .type2 = 2, /* SELVA_OBJECT_LONGLONG */
               .meta = 0,
           }, sizeof(struct SelvaFieldSchema));


    buf.hdr.chk = htole32(crc32c(0, &buf, sizeof(buf)));
    return send_message(fd, &buf, sizeof(buf), true);
}

static int send_modify(int fd, int seqno, flags_t frame_extra_flags, char node_id[SELVA_NODE_ID_SIZE])
{
    /* TODO The structs should come from headers */
    struct SelvaModifyFieldOp {
        enum SelvaModifyOpCode {
            SELVA_MODIFY_OP_DEL = 0, /*!< Delete field. */
            SELVA_MODIFY_OP_STRING = 1,
            SELVA_MODIFY_OP_STRING_DEFAULT = 2,
            SELVA_MODIFY_OP_LONGLONG = 3,
            SELVA_MODIFY_OP_LONGLONG_DEFAULT = 4,
            SELVA_MODIFY_OP_LONGLONG_INCREMENT = 5,
            SELVA_MODIFY_OP_DOUBLE = 6,
            SELVA_MODIFY_OP_DOUBLE_DEFAULT = 7,
            SELVA_MODIFY_OP_DOUBLE_INCREMENT = 8,
            SELVA_MODIFY_OP_SET_VALUE = 9,
            SELVA_MODIFY_OP_SET_INSERT = 10,
            SELVA_MODIFY_OP_SET_REMOVE = 11,
            SELVA_MODIFY_OP_SET_ASSIGN = 12,
            SELVA_MODIFY_OP_SET_MOVE = 13,
            SELVA_MODIFY_OP_EDGE_META = 14, /*!< Value is `struct SelvaModifyEdgeMeta`. */
        } __packed op;
        enum {
            SELVA_MODIFY_OP_FLAGS_VALUE_IS_DEFLATED = 0x01,
        } __packed flags;
        char lang[2];
        uint32_t index;
        char field_name[SELVA_SHORT_FIELD_NAME_LEN];
        const char *value_str;
        size_t value_len;
    };
    struct {
        struct selva_proto_header hdr;
        struct selva_proto_string modify_hdr;
        /* modify_header */
        struct {
            char node_id[SELVA_NODE_ID_SIZE];
            enum {
                FLAG_NO_MERGE = 0x01,
                FLAG_CREATE =   0x02,
                FLAG_UPDATE =   0x04,
            } flags;
            uint32_t nr_changes;
        } modify;
        /* field 1 */
        struct selva_proto_string field1_hdr;
        struct SelvaModifyFieldOp field1_op;
        char value1_str[3];
        /* field 2 */
        struct selva_proto_string field2_hdr;
        struct SelvaModifyFieldOp field2_op;
        char value2_str[sizeof(uint64_t)];
    } __packed buf = {
        .hdr = {
            .cmd = CMD_ID_MODIFY,
            .flags = SELVA_PROTO_HDR_FFIRST | SELVA_PROTO_HDR_FLAST | frame_extra_flags,
            .seqno = htole32(seqno),
            .frame_bsize = htole16(sizeof(buf)),
        },
        .modify_hdr = {
            .type = SELVA_PROTO_STRING,
            .bsize = htole32(sizeof(buf.modify)),
        },
        .modify = {
            .nr_changes = 2,
        },
        /* Field 1 */
        .field1_hdr = {
            .type = SELVA_PROTO_STRING,
            .bsize = htole32(sizeof(buf.field1_op) + sizeof(buf.value1_str)),
        },
        .field1_op = {
            .op = SELVA_MODIFY_OP_STRING,
            .field_name = "field",
            .value_str = (char *)sizeof(buf.field1_op),
            .value_len = sizeof(buf.value1_str),
        },
        .value1_str = "lol",
        /* Field 2 */
        .field2_hdr = {
            .type = SELVA_PROTO_STRING,
            .bsize = htole32(sizeof(buf.field2_op) + sizeof(buf.value2_str)),
        },
        .field2_op = {
            .op = SELVA_MODIFY_OP_LONGLONG,
            .field_name = "num",
            .value_str = (char *)sizeof(buf.field2_op),
            .value_len = sizeof(buf.value2_str),
        },
    };

    strncpy(buf.modify.node_id, node_id, SELVA_NODE_ID_SIZE);
    memcpy(buf.value2_str, &(uint64_t){seqno}, sizeof(uint64_t));

    buf.hdr.chk = htole32(crc32c(0, &buf, sizeof(buf)));

    return send_message(fd, &buf, sizeof(buf), !(frame_extra_flags & SELVA_PROTO_HDR_BATCH));
}

static int send_incrby(int fd, int seqno, flags_t frame_extra_flags, char node_id[SELVA_NODE_ID_SIZE])
{
#define FIELD "thumbs"
    struct {
        struct selva_proto_header hdr;
        struct selva_proto_string id_hdr;
        char id_str[SELVA_NODE_ID_SIZE];
        struct selva_proto_string field_hdr;
        char field_str[sizeof(FIELD) - 1];
        struct selva_proto_longlong incrby;
    } buf = {
        .hdr = {
            .cmd = CMD_ID_OBJECT_INCRBY,
            .flags = SELVA_PROTO_HDR_FFIRST | SELVA_PROTO_HDR_FLAST | frame_extra_flags,
            .seqno = htole32(seqno),
            .frame_bsize = htole16(sizeof(buf)),
            .msg_bsize = 0,
            .chk = 0,
        },
        .id_hdr = {
            .type = SELVA_PROTO_STRING,
            .flags = 0,
            .bsize = htole32(SELVA_NODE_ID_SIZE),
        },
        .field_hdr = {
            .type = SELVA_PROTO_STRING,
            .flags = 0,
            .bsize = htole32(sizeof(buf.field_str)),
        },
        .field_str = FIELD,
        .incrby = {
            .type = SELVA_PROTO_LONGLONG,
            .flags = 0,
            .v = htole64(1),
        },
    };
#undef FIELD

    strncpy(buf.id_str, node_id, SELVA_NODE_ID_SIZE);

    buf.hdr.chk = htole32(crc32c(0, &buf, sizeof(buf)));

    return send_message(fd, &buf, sizeof(buf), !(frame_extra_flags & SELVA_PROTO_HDR_BATCH));
}

static int send_hll(int fd, int seqno, flags_t frame_extra_flags, char node_id[SELVA_NODE_ID_SIZE])
{
#define FIELD "clients"
    struct {
        struct selva_proto_header hdr;
        struct selva_proto_string id_hdr;
        char id_str[SELVA_NODE_ID_SIZE];
        struct selva_proto_string field_hdr;
        char field_str[sizeof(FIELD) - 1];
        struct selva_proto_string op_hdr;
        char op_str[1];
        struct selva_proto_string value_hdr;
        char value_str[10];
    } buf = {
        .hdr = {
            .cmd = CMD_ID_OBJECT_SET,
            .flags = SELVA_PROTO_HDR_FFIRST | SELVA_PROTO_HDR_FLAST | frame_extra_flags,
            .seqno = htole32(seqno),
            .frame_bsize = htole16(sizeof(buf)),
            .msg_bsize = 0,
            .chk = 0,
        },
        .id_hdr = {
            .type = SELVA_PROTO_STRING,
            .flags = 0,
            .bsize = htole32(SELVA_NODE_ID_SIZE),
        },
        .field_hdr = {
            .type = SELVA_PROTO_STRING,
            .flags = 0,
            .bsize = htole32(sizeof(buf.field_str)),
        },
        .field_str = FIELD,
        .op_hdr = {
            .type = SELVA_PROTO_STRING,
            .flags = 0,
            .bsize = htole32(sizeof(buf.op_str)),
        },
        .op_str = "H",
        .value_hdr = {
            .type = SELVA_PROTO_STRING,
            .flags = 0,
            .bsize = htole32(sizeof(buf.value_str)),
        },
    };
#undef FIELD

    strncpy(buf.id_str, node_id, SELVA_NODE_ID_SIZE);
    snprintf(buf.value_str, sizeof(buf.value_str), "%d", seqno);

    buf.hdr.chk = htole32(crc32c(0, &buf, sizeof(buf)));

    return send_message(fd, &buf, sizeof(buf), !(frame_extra_flags & SELVA_PROTO_HDR_BATCH));
}

static int send_find(int fd, int seqno, flags_t frame_extra_flags, char node_id[SELVA_NODE_ID_SIZE])
{
    struct SelvaFind_QueryOpts qo = {
        .dir = SELVA_HIERARCHY_TRAVERSAL_ALL,
        .order = SELVA_RESULT_ORDER_NONE,
        .offset = 0,
        .limit = -1,
        .res_type = SELVA_FIND_QUERY_RES_IDS,
    };

    struct {
        struct selva_proto_header hdr;
        struct selva_proto_string lang_hdr;
        /* none */
        struct selva_proto_string qo_hdr;
        char qo_str[sizeof(qo)];
        struct selva_proto_string ids_hdr;
        char ids_str[SELVA_NODE_ID_SIZE];
    } buf = {
        .hdr = {
            .cmd = CMD_ID_HIERARCHY_FIND,
            .flags = SELVA_PROTO_HDR_FFIRST | SELVA_PROTO_HDR_FLAST | frame_extra_flags,
            .seqno = htole32(seqno),
            .frame_bsize = htole16(sizeof(buf)),
            .msg_bsize = 0,
            .chk = 0,
        },
        .lang_hdr = {
            .type = SELVA_PROTO_STRING,
            .flags = 0,
            .bsize = htole32(0),
        },
        .qo_hdr = {
            .type = SELVA_PROTO_STRING,
            .flags = SELVA_PROTO_STRING_FBINARY,
            .bsize = htole32(sizeof(buf.qo_str)),
        },
        .ids_hdr = {
            .type = SELVA_PROTO_STRING,
            .flags = 0,
            .bsize = htole32(sizeof(buf.ids_str)),
        },
    };
    memcpy(buf.qo_str, &qo, sizeof(qo));
    strncpy(buf.ids_str, node_id, SELVA_NODE_ID_SIZE);

    buf.hdr.chk = htole32(crc32c(0, &buf, sizeof(buf)));

    return send_message(fd, &buf, sizeof(buf), !(frame_extra_flags & SELVA_PROTO_HDR_BATCH));
}

static void handle_response(struct selva_proto_header *resp_hdr, void *msg, size_t msg_size)
{
    if (resp_hdr->cmd < 0) {
        fprintf(stderr, "Invalid cmd_id: %d\n", resp_hdr->cmd);
    } else {
        size_t i = 0;
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

        if (type == SELVA_PROTO_ERROR) {
            const char *err_msg_str;
            size_t err_msg_len;
            int err, err1;

            err = selva_proto_parse_error(msg, msg_size, i - off, &err1, &err_msg_str, &err_msg_len);
            if (err) {
                fprintf(stderr, "Failed to parse an error received: %s\n", selva_strerror(err));
                return;
            } else {
                printf("<Error %s: %.*s>,\n",
                       selva_strerror(err1),
                       (int)err_msg_len, err_msg_str);
            }
        }

        /* TODO Option to print */
#if 0
        selva_proto_print(stdout, msg, msg_size);
#endif
        /* else NOP */
    }
}

int recv_message(int fd)
{
    static _Alignas(uintptr_t) uint8_t msg_buf[MSG_BUF_SIZE] __lazy_alloc_glob;
    struct selva_proto_header resp_hdr;
    size_t i = 0;

    do {
        struct iovec rd_vec[2] = {
            {
                .iov_base = &resp_hdr,
                .iov_len = sizeof(resp_hdr),
            },
            {
                .iov_base = msg_buf + i,
                .iov_len = SELVA_PROTO_FRAME_PAYLOAD_SIZE_MAX,
            },
        };
        ssize_t r;

        r = tcp_readv(fd, rd_vec, num_elem(rd_vec));
        if (r != SELVA_PROTO_FRAME_SIZE_MAX) {
            if (r < 0) {
                fprintf(stderr, "Reading selva_proto frame failed: %s\n", selva_strerror(r));
            } else {
                fprintf(stderr, "Reading selva_proto frame failed. result: %d\n", (int)r);
            }
            return 1;
        }

        const size_t frame_bsize = le16toh(resp_hdr.frame_bsize);
        const size_t payload_size = frame_bsize - sizeof(resp_hdr);

        if (frame_bsize < sizeof(resp_hdr)) {
            fprintf(stderr, "Invalid frame size. flags: %x frame_bsize: %zu\n", resp_hdr.flags, frame_bsize);
            return 1;
        }

        if (!(resp_hdr.flags & SELVA_PROTO_HDR_FREQ_RES)) {
            fprintf(stderr, "Invalid response: response bit not set. flags: %x\n", resp_hdr.flags);
            return 1;
        } else if (i + payload_size > sizeof(msg_buf)) {
            fprintf(stderr, "Buffer overflow\n");
            return 1;
        }

        i += payload_size;

        if (!selva_proto_verify_frame_chk(&resp_hdr, msg_buf + i - payload_size, payload_size)) {
            fprintf(stderr, "Checksum mismatch\n");
            return 1;
        }

        /*
         * Note that we don't handle multiplexing or any kind of interleaved
         * responses here. We are just expecting that the server is only sending
         * us responses to a single command.
         */
        if (resp_hdr.flags & SELVA_PROTO_HDR_STREAM) {
            if (resp_hdr.flags & SELVA_PROTO_HDR_FLAST) {
                return 0;
            }

            handle_response(&resp_hdr, msg_buf, i);
            i = 0;
        }
        //printf("seq: %d\n", (int)resp_hdr.seqno);
    } while (!(resp_hdr.flags & SELVA_PROTO_HDR_FLAST));

    handle_response(&resp_hdr, msg_buf, i);
    return 0;
}

void *recv_thread(void *arg)
{
    struct thread_args *args = (struct thread_args *)arg;
    int fd = args->fd;
    int n = args->n;

    while (!flag_stop && n-- && !recv_message(fd)); // printf("n: %d\n", n);

    return NULL;
}

pthread_t start_recv(int fd, int n)
{
    pthread_t thread;
    static struct thread_args args;

    args.fd = fd;
    args.n = n;

    if (pthread_create(&thread, NULL, &recv_thread, &args)) {
        fprintf(stderr, "Failed to create a thread\n");
        exit(EXIT_FAILURE);
    }

    return thread;
}

static void test_modify(int fd, int seqno, flags_t frame_extra_flags)
{
    char node_id[SELVA_NODE_ID_SIZE + 1];

    snprintf(node_id, sizeof(node_id), "ma%.*x", (int)(SELVA_NODE_ID_SIZE - 2), seqno);
    send_modify(fd, seqno, frame_extra_flags, node_id);
}

static void test_modify_single(int fd, int seqno, flags_t frame_extra_flags)
{
    char node_id[SELVA_NODE_ID_SIZE + 1];

    snprintf(node_id, sizeof(node_id), "ma%.*x", (int)(SELVA_NODE_ID_SIZE - 2), 1);
    send_modify(fd, seqno, frame_extra_flags, node_id);
}

static void test_incrby(int fd, int seqno, flags_t frame_extra_flags)
{
    static int first = 1;
    char node_id[SELVA_NODE_ID_SIZE + 1];

    snprintf(node_id, sizeof(node_id), "ma%.*x", (int)(SELVA_NODE_ID_SIZE - 2), 1);
    if (first) {
        first = 0;

        send_modify(fd, seqno, frame_extra_flags, node_id);
    }
    send_incrby(fd, seqno, frame_extra_flags, node_id);
}

static void test_hll(int fd, int seqno, flags_t frame_extra_flags)
{
    static int first = 1;
    char node_id[SELVA_NODE_ID_SIZE + 1];

    snprintf(node_id, sizeof(node_id), "ma%.*x", (int)(SELVA_NODE_ID_SIZE - 2), 1);
    if (first) {
        first = 0;

        send_modify(fd, seqno, frame_extra_flags, node_id);
    }
    send_hll(fd, seqno, frame_extra_flags, node_id);
}

static void test_find(int fd, int seqno, flags_t frame_extra_flags)
{
    char node_id[SELVA_NODE_ID_SIZE] = "root";
    send_find(fd, seqno, frame_extra_flags, node_id);
}

static void test_ping(int fd, int seqno, flags_t frame_extra_flags)
{
    _Alignas(struct selva_proto_header) char buf[SELVA_PROTO_FRAME_SIZE_MAX];
    struct selva_proto_header *hdr = (struct selva_proto_header *)buf;
    struct iovec iov[] = {
        {
            .iov_base = &buf,
            .iov_len = sizeof(buf),
        },
    };

    memset(hdr, 0, sizeof(*hdr));
    hdr->cmd = CMD_ID_PING;
    hdr->flags = SELVA_PROTO_HDR_FFIRST | SELVA_PROTO_HDR_FLAST | frame_extra_flags;
    hdr->seqno = htole32(seqno);
    hdr->frame_bsize = htole16(sizeof(*hdr));
    hdr->msg_bsize = 0;
    hdr->chk = htole32(crc32c(0, buf, sizeof(*hdr)));

    tcp_writev(fd, iov, num_elem(iov));
}

static void (*suites[])(int fd, int seqno, flags_t frame_extra_flags) = {
    test_modify,
    test_modify_single,
    test_incrby,
    test_hll,
    test_find,
    test_ping,
};

int main(int argc, char *argv[])
{
    int c;
    char *addr = "127.0.0.1";
    int port = 3000;
    int sock;
    int seqno = 0;
    int batch = 0;
    int threaded = 0;
    int n = 1000000;
    unsigned suite = 0;

    opterr = 0;
    while ((c = getopt(argc, argv, "N:T:p:bts")) != -1) {
        switch (c) {
        case '?':
            if (optopt == 'p' || optopt == 'N') {
                fprintf(stderr, "Option -%c requires an argument.\n", optopt);
            } else if (isprint(optopt)) {
                fprintf(stderr, "Unknown option `-%c'.\n", optopt);
            } else {
                fprintf(stderr, "Unknown option character `\\x%x'.\n", optopt);
            }
            return 1;
        case 'N': /* number of nodes */
            n = (int)strtol(optarg, NULL, 10);
            break;
        case 'T':
            suite = (unsigned)strtol(optarg, NULL, 10);
            if (suite >= num_elem(suites)) {
                fprintf(stderr, "Invalid test suite\n");
                return 1;
            }
            break;
        case 'b': /* batching */
            batch = 1;
            break;
        case 'p': /* port */
            port = (int)strtol(optarg, NULL, 10);
            break;
        case 't': /* threaded */
            threaded = 1;
            break;
        default:
            abort();
        }
    }

    if (optind < argc) {
        addr = argv[optind];
    }

    sock = connect_to_server(addr, port);
    if (sock == -1) {
        exit(EXIT_FAILURE);
    }

    int err1 = 0;
    int err2 = 0;
    if ((err1 = send_schema(sock, seqno++)) ||
        (err2 = recv_message(sock))) {
        fprintf(stderr, "Setting schema failed: [%d, %d]\n", err1, err2);
        exit(EXIT_FAILURE);
    }

    (void)sigaction(SIGINT, &(const struct sigaction){
            .sa_handler = sigint_handler,
            .sa_flags = SA_NODEFER | SA_RESETHAND
            }, NULL);

    pthread_t thread;
    struct timespec ts_start, ts_end, ts_diff;
    double t, v;
    const char *unit = "ms";

    if (threaded) {
        thread = start_recv(sock, n - 1);
    }

    ts_monotime(&ts_start);
    while (!flag_stop && seqno < n) {
        flags_t frame_extra_flags = (batch && (seqno < n - 1)) ? SELVA_PROTO_HDR_BATCH : 0;
        //printf("flags: %u\n", frame_extra_flags);

        suites[suite](sock, seqno++, frame_extra_flags);

        if (!threaded) {
            flag_stop |= recv_message(sock);
        }
    }

    if (threaded) {
        pthread_join(thread, NULL);
    }

    ts_monotime(&ts_end);
    timespec_sub(&ts_diff, &ts_end, &ts_start);
    t = timespec2ms(&ts_diff);

    if (threaded) {
        pthread_join(thread, NULL);
    }

    v = ((double)seqno / t) * 1000.0;
    if (t > 1000.0) {
        t /= 1000.0;
        unit = "s";
    }

    shutdown(sock, SHUT_RDWR);
    close(sock);

    printf("N: %d commands\nt: %.2f %s\nv: %.0f cmd/s\n",
           seqno,
           t, unit,
           v);

    return EXIT_SUCCESS;
}
