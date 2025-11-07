/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include <math.h>
#include <inttypes.h>
#include "cdefs.h"
#include "selva/selva_string.h"
#include "selva/hll.h"
#include "xxhash.h"
#include "db_panic.h"
#ifdef __ARM_NEON
#include "arm64/neon_mathfun.h"
#endif

#define HLL_MIN_PRECISION 4
#define HLL_MAX_PRECISION 16
#define HASH_SIZE 64

enum hll_type {
    SPARSE = true,
    DENSE = false,
};

#define ASC true
#define DSC false

typedef struct {
    struct {
        uint16_t precision : 14;
        uint8_t is_sparse : 1;
        uint8_t dirty : 1;
    };
    uint16_t num_registers;
    uint32_t count;
    uint8_t registers[];
} HyperLogLogPlusPlus;

static_assert(HLL_INIT_SIZE == sizeof(HyperLogLogPlusPlus));

void hll_init(struct selva_string *hllss, uint8_t precision, bool is_sparse)
{
    if (precision < HLL_MIN_PRECISION ||
        precision > HLL_MAX_PRECISION) {
        db_panic("Precision must be between %d and %d", HLL_MIN_PRECISION, HLL_MAX_PRECISION);
    }
    if (hllss == nullptr) {
        db_panic("selva_string can't be null during HLL initialization");
    }

    size_t len;
    HyperLogLogPlusPlus *hll;

    if (is_sparse) {
        hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(hllss, &len);
        hll->is_sparse = true;
        hll->precision = precision;
        hll->num_registers = 0;
    } else {
        uint16_t num_registers = 1ULL << precision;

        (void)selva_string_append(hllss, nullptr, num_registers * sizeof(hll->registers[0]));

        hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(hllss, &len);
        hll->is_sparse = false;
        hll->precision = precision;
        hll->num_registers = num_registers;
    }
}

void hll_init_like(struct selva_string *hlla, struct selva_string *hllb)
{
    if (hlla == nullptr || hllb == nullptr) {
        db_panic("selva_string can't be null during HLL initialization");
    }
    size_t len;
    HyperLogLogPlusPlus *hllFrom = (HyperLogLogPlusPlus *)selva_string_to_mstr(hllb, &len);
    uint8_t precision = hllFrom->precision;
    bool is_sparse = hllFrom->is_sparse;
    hll_init(hlla, precision, is_sparse);
}

static int count_leading_zeros(uint64_t x)
{
    return (x == 0 ? 0 : __builtin_clzll(x));
}

void hll_add(struct selva_string *hllss, const uint64_t hash)
{
    if (!hllss || !hash) {
        db_panic("Unable to read stored value.");
    }

    size_t len;
    HyperLogLogPlusPlus *hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(hllss, &len);
    if (!hll) {
        db_panic("Failed to convert selva_string to HyperLogLogPlusPlus");
    }
    hll->dirty = true;

    uint32_t precision = hll->precision;

    uint64_t index = hash >> (HASH_SIZE - precision);
    uint64_t w = (hash << precision) | (1ULL << (precision - 1));
    uint8_t rho = count_leading_zeros(w) + 1;

    if (hll->is_sparse) {
        if (index > hll->num_registers && hll->num_registers <= (1ULL << precision) ) {
            size_t new_num_registers = index + 1;

            new_num_registers--;
            new_num_registers |= new_num_registers >> 1;
            new_num_registers |= new_num_registers >> 2;
            new_num_registers |= new_num_registers >> 4;
            new_num_registers |= new_num_registers >> 8;
            new_num_registers |= new_num_registers >> 16;
            new_num_registers++;

            selva_string_append(hllss, nullptr, (new_num_registers - hll->num_registers) * sizeof(hll->registers[0]));
            hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(hllss, &len);
            hll->registers[index] = rho;
            hll->num_registers = new_num_registers;
        }
    }

    hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(hllss, &len);

    if (hll->num_registers > len) {
        db_panic("Dense mode failure: There is no allocated space on selva string for the required registers: (%zu > %d)\n", len, hll->num_registers);
    }

    if (rho > hll->registers[index]) {
        hll->registers[index] = rho;
    }
}

void hll_union(struct selva_string *result, struct selva_string *hll_new)
{
    size_t result_len, new_len;
    HyperLogLogPlusPlus *new_hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(hll_new, &new_len);
    HyperLogLogPlusPlus *result_hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(result, &result_len);

    if (result_hll->precision > 0 && result_hll->precision != new_hll->precision) {
        db_panic("HLL union precision mismatch: %u != %u", result_hll->precision, new_hll->precision);
        return;
    }

    const size_t num_result_regs = result_hll->num_registers;
    const size_t num_new_regs = new_hll->num_registers;

    if (num_new_regs > num_result_regs) {
        size_t diff = num_new_regs - num_result_regs;
        size_t new_mem_bytes = diff * sizeof(result_hll->registers[0]);

        selva_string_append(result, 0, new_mem_bytes);  // might already be zeroed for unseen values but not
        selva_string_append(result, nullptr, new_mem_bytes);
        result_hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(result, &result_len);

        result_hll->num_registers = num_new_regs;
    }

    for (size_t i = 0; i < num_new_regs; i += 1) {
        result_hll->registers[i] = max(result_hll->registers[i], new_hll->registers[i]);
    }

    result_hll->dirty = true;
}

#if 0
static unsigned long locate(const float  *xx, size_t n, float x, bool ascnd) {
    size_t jl = 0;
    size_t ju = n;

    while (ju - jl > 1) {
        size_t jm = (ju + jl) >> 1;
        if (x >= xx[jm] == ascnd) {
            jl = jm;
        } else {
            ju = jm;
        }
    }
    return jl;
}

static double apply_bias_correction(double estimate, uint8_t precision) {
    size_t j = locate(raw_estimate_data[precision - 4], actual_cols[precision], estimate, ASC);

    const float avg_estimate = (raw_estimate_data[precision - 4][j] + raw_estimate_data[precision - 4][j + 1]) * 0.5f;
    const float avg_bias = (bias_data[precision - 4][j] + bias_data[precision - 4][j + 1]) * 0.5f;

    return (avg_estimate + avg_bias) * 0.5f);
}
#endif

static double compute_alpha_m(size_t m)
{
    switch(m) {
    case 16:
        return 0.673;
    case 32:
        return 0.697;
    case 64:
        return 0.709;
    default:
        return 0.7213 / (1.0 + 1.079 / m);
    }
    unreachable();
}

uint8_t *hll_count(struct selva_string *hllss)
{
    if (!hllss) {
        return nullptr;
    }

    size_t len;
    HyperLogLogPlusPlus *hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(hllss, &len);

    if (!hll->dirty) {
        return (uint8_t *)&hll->count;
    }

    const size_t num_registers = hll->num_registers;
    const uint8_t *registers = hll->registers;

    double raw_estimate = 0.0;
    double zero_count = 0.0;

    assert(num_registers % 4 == 0);
    assume(num_registers % 4 == 0);
#if __ARM_NEON
    for (size_t i = 0; i < num_registers; i += 4) {
        float32x4_t b = {
            (float)registers[i],
            (float)registers[i + 1],
            (float)registers[i + 2],
            (float)registers[i + 3],
        };
        float32x4_t r;
        uint32x4_t z;

        z = vceqzq_f32(b); /* zero mask */
        z = z & (uint32x4_t){1, 1, 1, 1};
        zero_count += (double)(vaddvq_u32(z));
        r = exp2_ps(vnegq_f32(b));
        raw_estimate += vaddvq_f32(r);
    }
#else
    for (size_t i = 0; i < num_registers; i++) {
        if (registers[i] == 0) {
            zero_count++;
        }
        /* raw_estimate += ldexp(1.0, -(double)registers[i]); */
        raw_estimate += 1.0 / exp2((double)registers[i]);
    }
#endif

    double m = (double)num_registers;
    double alpha_m = compute_alpha_m(num_registers);
    double estimate = alpha_m * m * m / raw_estimate;

    if (estimate <= (5.0 / 2.0) * m) {
        estimate = m * log(m / zero_count);
    }

    /* bias correction is suspended until a validation of threshold table being done */
#if 0
    if (estimate <= 5 * m){
        estimate = apply_bias_correction(estimate, precision);
    }
#endif

    hll->count = (uint32_t)estimate;
    hll->dirty = false;
    return (uint8_t *)(&hll->count);
}
