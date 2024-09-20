/*
 * Copyright (c) 2020-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#define _GNU_SOURCE
#include <inttypes.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <sys/types.h>
#include "util/svector.h"
#include "util/array_field.h"

size_t ary_idx_to_abs(ssize_t len, ssize_t ary_idx)
{
    if (ary_idx >= 0) {
        return ary_idx;
    } else if (len == 0) {
        return 0;
    } else {
        return imaxabs((len + ary_idx) % len);
    }
}

size_t vec_idx_to_abs(SVector *vec, ssize_t ary_idx)
{
    ssize_t len;

    if (ary_idx >= 0) {
        return ary_idx;
    }

    len = SVector_Size(vec);
    return len == 0 ? 0 : imaxabs((len + ary_idx) % len);
}
