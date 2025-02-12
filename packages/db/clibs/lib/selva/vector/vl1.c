/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <string.h>
#include <tgmath.h>
#include "selva/vector.h"
#ifdef __ARM_NEON
#include <arm_neon.h>
#endif

float vector_l1(const float *a, const float *b, size_t len)
{
    v4f x4, y4;
    v4f p4 = { 0, 0, 0, 0 };
    while (len >= 4) {
        memcpy(&x4, a, sizeof(x4));
        memcpy(&y4, b, sizeof(y4));

#ifdef __ARM_NEON
        p4 += vabdq_f32(x4, y4);
#else
        v4f tmp = x4 - y4;
        for (size_t i = 0; i < 4; i++) {
            p4[i] += fabs(tmp[i]);
        }
#endif

        a += 4;
        b += 4;
        len -= 4;
    }

    v2f x2, y2;
    v2f p2 = { p4[0] + p4[1], p4[2] + p4[3] };
    while (len >= 2) {
        memcpy(&x2, a, sizeof(x2));
        memcpy(&y2, b, sizeof(y2));

#ifdef __ARM_NEON
        p2 += vabd_f32(x2, y2);
#else
        v2f tmp = x2 - y2;
        p2[0] += fabs(tmp[0]);
        p2[1] += fabs(tmp[1]);
#endif

        a += 2;
        b += 2;
        len -= 2;
    }

    if (len == 1) {
        p2[0] += fabs(a[0] - b[0]);
    }

    return p2[0] + p2[1];
}
