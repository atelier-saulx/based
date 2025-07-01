/*
 * Copyright (C) 2024-2025 Saulx
 * Copyright 2017 The CRC32C Authors. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *    * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *    * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *
 *    * Neither the name of Google Inc. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 * SPDX-License-Identifier: BSD-style
 */

#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include <arm_acle.h>
#include <arm_neon.h>
#include "selva/crc32c.h"

#define KBYTES 1032
#define SEGMENTBYTES 256
#define KCRC32XOR 0xffffffffU

/**
 * compute 8bytes for each segment parallelly
 */
#define CRC32C32BYTES(P, IND) \
    do { \
        crc1 = __crc32cd(crc1, ReadUint64LE((P) + SEGMENTBYTES * 1 + (IND)*8)); \
        crc2 = __crc32cd(crc2, ReadUint64LE((P) + SEGMENTBYTES * 2 + (IND)*8)); \
        crc3 = __crc32cd(crc3, ReadUint64LE((P) + SEGMENTBYTES * 3 + (IND)*8)); \
        crc0 = __crc32cd(crc0, ReadUint64LE((P) + SEGMENTBYTES * 0 + (IND)*8)); \
    } while (0)

/**
 * compute 8*8 bytes for each segment parallelly
 */
#define CRC32C256BYTES(P, IND) \
    do { \
        CRC32C32BYTES((P), (IND)*8 + 0); \
        CRC32C32BYTES((P), (IND)*8 + 1); \
        CRC32C32BYTES((P), (IND)*8 + 2); \
        CRC32C32BYTES((P), (IND)*8 + 3); \
        CRC32C32BYTES((P), (IND)*8 + 4); \
        CRC32C32BYTES((P), (IND)*8 + 5); \
        CRC32C32BYTES((P), (IND)*8 + 6); \
        CRC32C32BYTES((P), (IND)*8 + 7); \
    } while (0)

/**
 * compute 4*8*8 bytes for each segment parallelly
 */
#define CRC32C1024BYTES(P) \
    do { \
        CRC32C256BYTES((P), 0); \
        CRC32C256BYTES((P), 1); \
        CRC32C256BYTES((P), 2); \
        CRC32C256BYTES((P), 3); \
        (P) += 4 * SEGMENTBYTES; \
    } while (0)

/**
 * Reads a little-endian 16-bit integer from bytes, not necessarily aligned.
 */
static inline uint16_t ReadUint16LE(const uint8_t *buffer)
{
    uint16_t result;

    memcpy(&result, buffer, sizeof(result));
    return result;
}

/**
 * Reads a little-endian 32-bit integer from bytes, not necessarily aligned.
 */
static inline uint32_t ReadUint32LE(const uint8_t *buffer)
{
    uint32_t result;

    memcpy(&result, buffer, sizeof(result));
    return result;
}

/**
 * Reads a little-endian 64-bit integer from bytes, not necessarily aligned.
 */
static inline uint64_t ReadUint64LE(const uint8_t *buffer)
{
    uint64_t result;

    memcpy(&result, buffer, sizeof(result));
    return result;
}

uint32_t crc32c(uint32_t crc, const void *buf, size_t len)
{
    const uint8_t *data = buf;
    int64_t length = len;

    if (len == 0) {
        return crc;
    }

    /*
     * k0=CRC(x^(3*SEGMENTBYTES*8)), k1=CRC(x^(2*SEGMENTBYTES*8)),
     * k2=CRC(x^(SEGMENTBYTES*8))
     */
    const poly64_t k0 = 0x8d96551c, k1 = 0xbd6f81f8, k2 = 0xdcb17aa4;

    crc = crc ^ KCRC32XOR;

    while (length >= KBYTES) {
        uint32_t crc0 = crc;
        uint32_t crc1 = 0;
        uint32_t crc2 = 0;
        uint32_t crc3 = 0;
        uint64_t t0, t1, t2;

        // Process 1024 bytes in parallel.
        CRC32C1024BYTES(data);

        // Merge the 4 partial CRC32C values.
        t2 = (uint64_t)vmull_p64(crc2, k2);
        t1 = (uint64_t)vmull_p64(crc1, k1);
        t0 = (uint64_t)vmull_p64(crc0, k0);
        crc = __crc32cd(crc3, ReadUint64LE(data));
        data += sizeof(uint64_t);
        crc ^= __crc32cd(0, t2);
        crc ^= __crc32cd(0, t1);
        crc ^= __crc32cd(0, t0);

        length -= KBYTES;
    }

    while (length >= 8) {
        crc = __crc32cd(crc, ReadUint64LE(data));
        data += 8;
        length -= 8;
    }

    if (length & 4) {
        crc = __crc32cw(crc, ReadUint32LE(data));
        data += 4;
    }

    if (length & 2) {
        crc = __crc32ch(crc, ReadUint16LE(data));
        data += 2;
    }

    if (length & 1) {
        crc = __crc32cb(crc, *data);
    }

    return crc ^ KCRC32XOR;
}
