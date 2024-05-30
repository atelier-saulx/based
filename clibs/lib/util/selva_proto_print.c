/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <inttypes.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>
#include "cdefs.h"
#include "util/endian.h"
#include "selva_error.h"
#include "selva_proto.h"

/* TODO We should just fix the warns */
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wpointer-arith"

#define TAB_WIDTH 2
#define TABS_MAX (80 / TAB_WIDTH / 2)

void selva_proto_print(FILE *stream, const void *msg, size_t msg_size)
{
    unsigned int tabs_hold_stack[TABS_MAX + 1] = { 0 };
    unsigned int tabs = 0;
    size_t i = 0;

    while (i < msg_size) {
        enum selva_proto_data_type type;
        size_t data_len;
        int off;

        off = selva_proto_parse_vtype(msg, msg_size, i, &type, &data_len);
        if (off <= 0) {
            if (off < 0) {
                fprintf(stream, "<vtype parse failed: %s>\n", selva_strerror(off));
            }
            return;
        }

        i += off;

        if (type == SELVA_PROTO_NULL) {
            printf("%*s<null>,\n", tabs * TAB_WIDTH, "");
        } else if (type == SELVA_PROTO_ERROR) {
            const char *err_msg_str;
            size_t err_msg_len;
            int err, err1;

            err = selva_proto_parse_error(msg, msg_size, i - off, &err1, &err_msg_str, &err_msg_len);
            if (err) {
                fprintf(stream, "<error parse failed: %s>\n", selva_strerror(err));
                return;
            } else {
                fprintf(stream, "%*s<Error %s: %.*s>,\n",
                        tabs * TAB_WIDTH, "",
                        selva_strerror(err1),
                        (int)err_msg_len, err_msg_str);
            }
        } else if (type == SELVA_PROTO_DOUBLE) {
            double d;

            d = ledoubletoh((char *)msg + i - sizeof(d));
            fprintf(stream, "%*s%e,\n", tabs * TAB_WIDTH, "", d);
        } else if (type == SELVA_PROTO_LONGLONG) {
            const uint8_t flags = *((const uint8_t *)msg + i - off + offsetof(struct selva_proto_longlong, flags));
            uint64_t ll;

            memcpy(&ll, (char *)msg + i - sizeof(ll), sizeof(ll));
            ll = le64toh(ll);

            if (flags & SELVA_PROTO_LONGLONG_FMT_HEX) {
                fprintf(stream, "%*s%" PRIx64 ",\n", tabs * TAB_WIDTH, "", ll);
            } else {
                fprintf(stream, "%*s%" PRId64 ",\n", tabs * TAB_WIDTH, "", ll);
            }
        } else if (type == SELVA_PROTO_STRING) {
            struct selva_proto_string str_hdr;

            memcpy(&str_hdr, msg + i - off, sizeof(str_hdr));
            if (str_hdr.flags & SELVA_PROTO_STRING_FBINARY) {
				static const char hex_map[] = "0123456789abcdef";
                const uint8_t *p = (const uint8_t *)msg + i - data_len;

                fprintf(stream, "%*s\"", tabs * TAB_WIDTH, "");
                for (size_t data_i = 0; data_i < data_len; data_i++) {
				    fprintf(stream, "%c%c",
                           hex_map[(p[data_i] >> 4) % sizeof(hex_map)],
                           hex_map[(p[data_i] & 0x0f) % sizeof(hex_map)]);
                }
                fprintf(stream, "\",\n");
            } else {
                fprintf(stream, "%*s\"%.*s\",\n", tabs * TAB_WIDTH, "", (int)data_len, (char *)msg + i - data_len);
            }
        } else if (type == SELVA_PROTO_ARRAY) {
            struct selva_proto_array hdr;

            memcpy(&hdr, msg + i - off, sizeof(hdr));

            if (hdr.flags & SELVA_PROTO_ARRAY_FPOSTPONED_LENGTH) {
                fprintf(stream, "%*s[\n", tabs * TAB_WIDTH, "");
                if (tabs < TABS_MAX) {
                    tabs++;
                }
            } else {
                if (data_len == 0) {
                    fprintf(stream, "%*s[],\n", tabs * TAB_WIDTH, "");
                } else {
                    int did_tab = 0;

                    fprintf(stream, "%*s[\n", tabs * TAB_WIDTH, "");
                    if (tabs < TABS_MAX) {
                        tabs++;
                        did_tab = 1;
                    }

                    if (hdr.flags & (SELVA_PROTO_ARRAY_FDOUBLE | SELVA_PROTO_ARRAY_FLONGLONG)) {
                        fprintf(stream, "%*s", tabs * TAB_WIDTH, "");

                        static_assert(sizeof(double) == sizeof(uint64_t));
                        for (size_t ival = i - off + sizeof(hdr); ival < i; ival += sizeof(uint64_t)) {
                            if (hdr.flags & SELVA_PROTO_ARRAY_FDOUBLE) {
                                double d;

                                d = ledoubletoh(msg + ival);
                                fprintf(stream, "%.2f, ", d);
                            } else {
                                uint64_t ll;

                                memcpy(&ll, msg + ival, sizeof(ll));
                                fprintf(stream, "%" PRId64 ", ", le64toh(ll));
                            }
                        }

                        if (did_tab) {
                            tabs--;
                        }
                        fprintf(stream, "\n%*s],\n", tabs * TAB_WIDTH, "");
                    } else {
                        tabs_hold_stack[tabs] = data_len;
                        continue; /* Avoid decrementing the tab stack value. */
                    }
                }
            }
        } else if (type == SELVA_PROTO_ARRAY_END) {
            if (tabs_hold_stack[tabs]) {
                /*
                 * This isn't necessary if the server is sending correct data.
                 */
                tabs_hold_stack[tabs] = 0;
            }
            if (tabs > 0) {
                tabs--;
            }
            fprintf(stream, "%*s],\n", tabs * TAB_WIDTH, "");
        } else if (type == SELVA_PROTO_REPLICATION_CMD) {
            uint64_t eid;
            int64_t ts;
            int8_t repl_cmd_id;
#if 0
            char buf[5];
#endif
            size_t cmd_size;
            int err, compressed;

            err = selva_proto_parse_replication_cmd(msg, msg_size, i - off, &eid, &ts, &repl_cmd_id, &compressed, &cmd_size);
            if (err) {
                fprintf(stream, "<replication_cmd parse failed: %s>\n", selva_strerror(err));
                return;
            }

            fprintf(stream, "%*s<replication cmd=%d size=%zu>,\n", tabs * TAB_WIDTH, "", repl_cmd_id, cmd_size);
            i = i - off + sizeof(struct selva_proto_replication_cmd);
        } else {
            fprintf(stream, "<Invalid proto value>\n");
            return;
        }

        /*
         * Handle tabs for fixed size arrays.
         */
        if (tabs_hold_stack[tabs] > 0) {
            tabs_hold_stack[tabs]--;
            if (tabs_hold_stack[tabs] == 0) {
                if (tabs > 0) {
                    tabs--;
                }
                fprintf(stream, "%*s],\n", tabs * TAB_WIDTH, "");
            }
        }
    }
}

#pragma GCC diagnostic pop
