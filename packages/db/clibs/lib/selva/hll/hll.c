#include <stdio.h>
#include <string.h>
#include <math.h>
#include <inttypes.h>
#include "cdefs.h"
#include "selva/selva_string.h"
#include "selva/hll.h"
// #include "xxhash.h"
#include "selva/xxhash64.h"

#define HLL_MIN_PRECISION 4
#define HLL_MAX_PRECISION 16
#define HASH_SIZE 64

#define SPARSE true
#define DENSE false

void hll_init(struct selva_string *hllss, uint8_t precision, bool is_sparse) {
    if (precision < HLL_MIN_PRECISION ||
        precision > HLL_MAX_PRECISION) {
        printf("Precision must be between %d and %d", HLL_MIN_PRECISION, HLL_MAX_PRECISION );
        exit(EXIT_FAILURE);
    }
    size_t len;

    if (is_sparse){

        HyperLogLogPlusPlus *hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(hllss, &len);


        hll->is_sparse = true;
        hll->precision = precision;
        hll->num_registers = 0;
    }
    else {
        uint32_t num_registers = 1ULL << precision;
        num_registers = 1ULL << precision;

        /* TODO append here to allocate space for the registers. */
        (void)selva_string_append(hllss, NULL, 16);
        HyperLogLogPlusPlus *hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(hllss, &len);

        hll->is_sparse = false;
        hll->precision = precision;
        hll->num_registers = num_registers;
    }
}

int count_leading_zeros(uint64_t x) {
    return (x == 0 ? 0 : __builtin_clzll(x));
}

void hll_add(struct selva_string *hllss, const uint64_t hash) {
    printf("c hash: %llu\n", hash);
    printf("c hash: %x\n", hash);

    if (!hllss || !hash) {
        return;
    }

    size_t len;
    HyperLogLogPlusPlus *hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(hllss, &len);
    if (!hll) {
        printf("Failed to convert selva_string to HyperLogLogPlusPlus\n");
        return;
    }

    bool is_sparse = hll->is_sparse;
    uint32_t precision = hll->precision;

    // uint64_t hash = XXH64(element, strlen(element), 0);

    uint64_t index = hash >> (HASH_SIZE - precision);
    uint64_t w = (hash << precision) | (1ULL << (precision - 1));
    uint32_t rho = count_leading_zeros(w) + 1;

    if (hll->is_sparse) {
        if (index > hll->num_registers && hll->num_registers <= (1ULL << precision) ) {
            selva_string_append(hllss, 0, (index - hll->num_registers) * sizeof(uint32_t));
            selva_string_append(hllss, NULL, sizeof(uint32_t));
            hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(hllss, &len);
            hll->registers[index] = rho;
            hll->num_registers = (index + 1);
        }
    }
    /*
     * TODO or maybe here?
     *
    if (len < wgfe)
        selva_String_append()
        */
    hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(hllss, &len);
    if (rho > hll->registers[index]) {
        hll->registers[index] = rho;
    }

    printf("is Sparse: %d\n", hll->is_sparse);
    printf("Precision: %d\n", hll->precision);
    printf("Num registers: %d\n", hll->num_registers);
    for (int i = 0; i < hll->num_registers; i++) {
        printf("M[%d] = %u\n", i, hll->registers[i]);
    }

}

struct selva_string hll_array_union(struct selva_string *hll_array, size_t count) {

    HyperLogLogPlusPlus *first_hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(&hll_array[0], NULL);

    uint8_t precision = first_hll->precision;
    uint32_t num_registers = first_hll->num_registers;

    struct selva_string result;
    hll_init(&result, precision, DENSE);
    HyperLogLogPlusPlus *result_hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(&result, NULL);

    memcpy(result_hll->registers, first_hll->registers, num_registers * sizeof(uint32_t));

    for (size_t j = 1; j < count; j++) {
        HyperLogLogPlusPlus *current_hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(&hll_array[j], NULL);
        if (current_hll->precision != precision) {
            printf("Precision mismatch is unsupported (for now just returning NULL)\n");
            exit(EXIT_FAILURE);
        }
        for (size_t i = 0; i < num_registers; i++) {
            if (current_hll->registers[i] > result_hll->registers[i]) {
                result_hll->registers[i] = current_hll->registers[i];
            }
        }
    }

    return result;
}

const double bias_correction_table[][2] = {
    {4.0, 0.673},
    {5.0, 0.697},
    {6.0, 0.709},
};

double apply_bias_correction(double alpha_m, uint8_t precision) {
    for (size_t i = 0; i < sizeof(bias_correction_table) / sizeof(bias_correction_table[0]); i++) {
        if (bias_correction_table[i][0] == (double)precision) {
            return alpha_m * bias_correction_table[i][1];
        }
    }
    return alpha_m;
}

double compute_alpha_m(size_t m) {
    switch(m) {
        case 16: return 0.673; break;
        case 32: return 0.697; break;
        case 64: return 0.709; break;
        default:
            return 0.7213 / (1.0 + 1.079 / m); break;
    }
}

double hll_count(struct selva_string *hllss) {
    if (!hllss) return 0.0;

    size_t len;
    HyperLogLogPlusPlus *hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(hllss, &len);

    uint32_t precision = hll->precision;
    uint32_t num_registers = hll->num_registers;
    uint32_t *registers = hll->registers;

    printf("is Sparse: %d\n", hll->is_sparse);
    printf("Precision: %d\n", hll->precision);
    printf("Num registers: %d\n", hll->num_registers);

    double raw_estimate = 0.0;
    double zero_count = 0.0;


    for (size_t i = 0; i < num_registers; i++) {
        printf("M[%zu] = %u\n", i, registers[i]);
        if (registers[i] == 0) {
            zero_count++;
        }
        raw_estimate += pow(2.0, -((double)registers[i]));
    }

    double m = (double)num_registers;
    double alpha_m = compute_alpha_m(num_registers);
    double estimate = alpha_m * m * m / raw_estimate;

    if (estimate <= (5.0 / 2.0) * m) {
        estimate = m * log(m / zero_count);
    }

    estimate = apply_bias_correction(estimate, precision);

    return estimate;
}

int main(void) {
    // size_t precision = 14;

    const uint64_t hash = xxHash64("myCoolValue", strlen("myCoolValue"));

    size_t precision = 4;
    int initial_capacity = sizeof(bool) \
                            + sizeof(precision) \
                            + sizeof(uint32_t);

    struct selva_string hll;
    // selva_string_init(&hll, NULL, initial_capacity , SELVA_STRING_MUTABLE);

    // hll_init(&hll, precision, SPARSE);

    // int num_elements = 1e6;
    // char (*elements)[50] = malloc(num_elements * sizeof(*elements));
    // if (elements == NULL) {
    //     perror("Failed to allocate memory");
    //     exit(EXIT_FAILURE);
    // }

    // for (int i = 0; i < num_elements; i++) {
    //     snprintf(elements[i], 50, "hll1_%d", i);
    //     hll_add(&hll, elements[i]);
    // }
    // double estimated_cardinality = hll_count(&hll);

    // printf("Estimated cardinality: %f\n", estimated_cardinality);
    // float expected_cardinality = num_elements;
    // float error = fabs(expected_cardinality - estimated_cardinality);
    // printf("Error: %0.f (%.2f%%)\n", error, (float)(100.0 * (error / expected_cardinality)));

    // free(elements);

    printf("init: %d\n", initial_capacity);
    selva_string_init(&hll, NULL, initial_capacity , SELVA_STRING_MUTABLE);
    hll_init(&hll, precision, DENSE);
    hll_add(&hll, hash);
    double estimated_cardinality = hll_count(&hll);
    printf("Estimated cardinality: %f\n", estimated_cardinality);

    return 0;
}
