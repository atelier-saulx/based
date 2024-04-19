/*
 * Copyright (c) 2023-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#include "selva_proto.h"
#include "selva_server.h"

struct selva_string;

#define cmd_t typeof_field(struct selva_proto_header, cmd)

void piper_error(struct selva_string *out_buf, int err, const char *err_msg_str, size_t err_msg_len);
void find2find_glue(
        cmd_t cmd_id,
        int64_t ts,
        const char *template_str,
        size_t template_len,
        struct selva_string * restrict in_buf,
        struct selva_string * restrict out_buf);
void find2modify_glue(
        cmd_t cmd_id,
        int64_t ts,
        const char *template_str,
        size_t template_len,
        struct selva_string * restrict in_buf,
        struct selva_string * restrict out_buf);
