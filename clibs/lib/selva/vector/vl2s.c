/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <string.h>
#include "selva/vector.h"

float vector_l2s(const float *a, const float *b, size_t len)
{
    /*
     * This function compiles best with ARM Neon or Intel AVX2 (-mavx2).
     */
    v8f x8, y8;
    v8f p8 = {0, 0, 0, 0, 0, 0, 0, 0};
    while (len >= 8) {
        memcpy(&x8, a, sizeof(x8));
        memcpy(&y8, b, sizeof(y8));

        v8f tmp = x8 - y8;
        p8 += tmp * tmp;

        a += 8;
        b += 8;
        len -= 8;
    }

    v4f x4, y4;
    v4f p4 = { p8[0] + p8[1], p8[2] + p8[3], p8[4] + p8[5], p8[6] + p8[7] };
    while (len >= 4) {
        memcpy(&x4, a, sizeof(x4));
        memcpy(&y4, b, sizeof(y4));

        v4f tmp = x4 - y4;
        p4 += tmp * tmp;

        a += 4;
        b += 4;
        len -= 4;
    }

    v2f x2, y2;
    v2f p2 = { p4[0] + p4[1], p4[2] + p4[3] };
    while (len >= 2) {
        memcpy(&x2, a, sizeof(x2));
        memcpy(&y2, b, sizeof(y2));

        v2f tmp = x2 - y2;
        p2 += tmp * tmp;

        a += 2;
        b += 2;
        len -= 2;
    }

    if (len == 1) {
        float tmp = a[0] - b[0];
        p2[0] += tmp * tmp;
    }

    return p2[0] + p2[1];
}
