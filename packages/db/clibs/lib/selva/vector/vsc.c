/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <string.h>
#include "selva/vector.h"

#ifdef __ARM_NEON
#include <arm_neon.h>
static inline float32x2_t v2f_rsqrt(v2f val)
{
    float32x2_t e = vrsqrte_f32(val);
    e = vmul_f32(vrsqrts_f32(vmul_f32(e, e), val), e);
    /* One iteration is enough. */
#if 0
    e = vmul_f32(vrsqrts_f32(vmul_f32(e, e), val), e);
#endif
    return e;
}
#elifdef __SSE__
#include <immintrin.h>
static inline v2f v2f_rsqrt(v2f val)
{
    __m128 three = { 3.0f, 3.0f, 3.0f, 3.0f };
    __m128 half = { 0.5f, 0.5f, 0.5f, 0.5f };
    __m128 x = { val[0], val[1], 0.0f, 0.0f };
    __m128 y0 = _mm_rsqrt_ps(x);
    /*
     * e = (y0 * (3 * -x * y0^2)) * 0.5
     */
    __m128 e = _mm_mul_ps(_mm_mul_ps(half, y0), _mm_sub_ps(three, _mm_mul_ps(_mm_mul_ps(x, y0), y0)));

    return (v2f){ e[0], e[1] };
}
#else
#include <tgmath.h>
static inline v2f v2f_rsqrt(v2f val)
{
    return (v2f){ 1.0f / sqrt(val[0]), 1.0f / sqrt(val[1]) };
}
#endif

float vector_sc(const float *a, const float *b, size_t len)
{
    /*
     * This function compiles best with ARM Neon or Intel AVX2 (-mavx2).
     */
    v8f x8, y8;
    v8f p8 = {0, 0, 0, 0, 0, 0, 0, 0};
    v8f ma8 = {0, 0, 0, 0, 0, 0, 0, 0};
    v8f mb8 = {0, 0, 0, 0, 0, 0, 0, 0};
    while (len >= 8) {
        memcpy(&x8, a, sizeof(x8));
        memcpy(&y8, b, sizeof(y8));

        p8 += x8 * y8;
        ma8 += x8 * x8;
        mb8 += y8 * y8;

        a += 8;
        b += 8;
        len -= 8;
    }

    v4f x4, y4;
    v4f p4 = { p8[0] + p8[1], p8[2] + p8[3], p8[4] + p8[5], p8[6] + p8[7] };
    v4f ma4 = {ma8[0] + ma8[1], ma8[2] + ma8[3], ma8[4] + ma8[5], ma8[6] + ma8[7]};
    v4f mb4 = {mb8[0] + mb8[1], mb8[2] + mb8[3], mb8[4] + mb8[5], mb8[6] + mb8[7]};
    while (len >= 4) {
        memcpy(&x4, a, sizeof(x4));
        memcpy(&y4, b, sizeof(y4));

        p4 += x4 * y4;
        ma4 += x4 * x4;
        mb4 += y4 * y4;

        a += 4;
        b += 4;
        len -= 4;
    }

    v2f x2, y2;
    v2f p2 = { p4[0] + p4[1], p4[2] + p4[3] };
    v2f ma2 = { ma4[0] + ma4[1], ma4[2] + ma4[3] };
    v2f mb2 = { mb4[0] + mb4[1], mb4[2] + mb4[3] };
    while (len >= 2) {
        memcpy(&x2, a, sizeof(x2));
        memcpy(&y2, b, sizeof(y2));

        p2 += x2 * y2;
        ma2 += x2 * x2;
        mb2 += y2 * y2;

        a += 2;
        b += 2;
        len -= 2;
    }

    if (len == 1) {
        p2[0] += a[0] * b[0];
        ma2[0] += a[0] * a[0];
        mb2[0] += b[0] * b[0];
    }

    float dot_prod = p2[0] + p2[1];
    v2f mag = { ma2[0] + ma2[1], mb2[0] + mb2[1] };
    mag = v2f_rsqrt(mag);

    return dot_prod * (mag[0] * mag[1]);
}
