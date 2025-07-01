/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include "idz.h"

static uint16_t pack16(int16_t acc, uint16_t limit, uint16_t v)
{
    return (limit * acc) + v;
}

static uint16_t unpack16(uint16_t *acc, uint16_t limit)
{
    uint16_t q = *acc / limit;
    uint16_t r = *acc % limit;
    *acc = q;

    return r;
}

#define IDZ_PREC 12
#define LIMIT_X 32
#define LIMIT_Y 2048

uint16_t idz_pack(node_id_t id)
{
    static_assert(sizeof(id) == sizeof(uint32_t));
    const uint32_t x = 32 - __builtin_clz(id | 1);
    const uint32_t shift = x > IDZ_PREC ? x - IDZ_PREC : 0;
    const uint32_t y = (id >> shift) & (LIMIT_Y - 1);

    return pack16(pack16(0, LIMIT_Y, y), LIMIT_X, x - 1);
}

node_id_t idz_unpack(uint16_t packed_id)
{
    uint16_t acc = packed_id;
    const uint32_t x = unpack16(&acc, LIMIT_X) + 1;
    const uint32_t y = unpack16(&acc, LIMIT_Y);
    const uint32_t shift = x > IDZ_PREC ? x - IDZ_PREC : 0;

    return (1 << (x - 1)) | (y << shift);
}
