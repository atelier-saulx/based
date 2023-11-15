/*
 * Copyright (c) 2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include "selva_error.h"

int query_count_filter_regs(const char *regs_buf, size_t regs_len)
{
    int n = 0;

    for (size_t i = 0; i < regs_len; ) {
        uint32_t len;

        memcpy(&len, regs_buf + i, sizeof(len));
        i += sizeof(len);
        if (i + len > regs_len) {
            return SELVA_EINVAL;
        }

        const char *val = regs_buf + i;
        if (val[len - 1] != '\0') {
            return SELVA_EINVAL;
        }

        i += len;
        n++;
    }

    return n;
}
