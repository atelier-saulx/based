/*
 * This software is provided 'as-is', without any express or implied
 * warranty.  In no event will the author be held liable for any damages
 * arising from the use of this software.
 *
 * Permission is granted to anyone to use this software for any purpose,
 * including commercial applications, and to alter it and redistribute it
 * freely, subject to the following restrictions:
 *
 * 1. The origin of this software must not be misrepresented; you must not
 *    claim that you wrote the original software. If you use this software
 *    in a product, an acknowledgment in the product documentation would be
 *    appreciated but is not required.
 * 2. Altered source versions must be plainly marked as such, and must not be
 *    misrepresented as being the original software.
 * 3. This notice may not be removed or altered from any source distribution.
 *
 * crc32c.c -- compute CRC-32C using the Intel crc32 instruction
 * Copyright (C) 2013, 2021 Mark Adler <madler@alumni.caltech.edu>
 * Copyright (C) 2023-2025 Saulx
 * SPDX-License-Identifier: Zlib
 */

#include <stddef.h>
#include <stdint.h>
#include "crc32c_table.h"
#include "selva/crc32c.h"

/*
 * Software implementation.
 * little-endian only.
 */
uint32_t crc32c(uint32_t crc, const void *buf, size_t len)
{
    if (len == 0) {
        return crc;
    }

    unsigned char const *data = buf;
    while (len && ((uintptr_t)data & 7) != 0) {
        crc = (crc >> 8) ^ crc32c_table[0][(crc ^ *data++) & 0xff];
        len--;
    }
    size_t n = len >> 3;
    for (size_t i = 0; i < n; i++) {
        uint64_t word = crc ^ ((uint64_t const *)data)[i];
        crc = crc32c_table[7][word & 0xff] ^
              crc32c_table[6][(word >> 8) & 0xff] ^
              crc32c_table[5][(word >> 16) & 0xff] ^
              crc32c_table[4][(word >> 24) & 0xff] ^
              crc32c_table[3][(word >> 32) & 0xff] ^
              crc32c_table[2][(word >> 40) & 0xff] ^
              crc32c_table[1][(word >> 48) & 0xff] ^
              crc32c_table[0][word >> 56];
    }
    data += n << 3;
    len &= 7;
    while (len) {
        len--;
        crc = (crc >> 8) ^ crc32c_table[0][(crc ^ *data++) & 0xff];
    }

    return crc;
}
