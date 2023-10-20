/*
 * Copyright (c) 2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdint.h>
#include <sys/types.h>
#include "util/selva_proto_builder.h"
#include "util/selva_string.h"
#include "piper.h"

void piper_error(struct selva_string *out_buf, int err, const char *err_msg_str, size_t err_msg_len)
{
    struct selva_proto_builder_msg msg;

    selva_proto_builder_init(&msg);
    selva_proto_builder_insert_error(&msg, err, err_msg_str, err_msg_len);
    selva_proto_builder_end(&msg);
    selva_string_append(out_buf, (const void *)msg.buf, msg.bsize);
    selva_proto_builder_deinit(&msg);
}
