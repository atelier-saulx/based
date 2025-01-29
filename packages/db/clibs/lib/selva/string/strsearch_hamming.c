/*
 * Copyright (c) 2024-2025 SAULX
 *
 * Licensed under the MIT License.
 * https://opensource.org/licenses/MIT
 * SPDX-License-Identifier: MIT
 */

#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include "selva/strsearch.h"

uint32_t strsearch_hamming(const char * restrict s, const char * restrict t, size_t n)
{
    uint32_t dist = 0;

    for (size_t i = 0; i < n; i++) {
        uint8_t x = *s++;
        uint8_t y = *t++;

        dist += __builtin_popcount(x ^ y);
    }

    return dist;
}

uint32_t strsearch_hamming_mbs(const char * restrict mbs, size_t mbs_len, const char * restrict t, size_t t_len)
{
	char buf[t_len];
	size_t j = 0;

    if (t_len == 0) {
        return 0;
    }

	for (size_t i = 0; i < mbs_len; i++) {
		uint8_t x = *mbs++;

		if (x & 0x80) {
			unsigned l;
#if __has_builtin(__builtin_clzg)
			l = __builtin_clzg((uint8_t)~x, 0) - 1;
#elif __has_builtin(__builtin_clz)
			l = __builtin_clz((unsigned)(~x << 24)) - 1;
#else
#error "No luck"
#endif
			i += l;
			mbs += l;
			continue;
		}

		buf[j] = x;
		if (++j >= t_len) break;
	}
	memset(buf + j, '\0', t_len - j);

	const char *s = buf;
	uint32_t dist = 0;

	for (size_t i = 0; i < t_len; i++) {
		uint8_t x = *s++;
		uint8_t y = *t++;

		dist += __builtin_popcount(x ^ y);
	}

	return dist;
}
