#include <stdio.h>
#include <string.h>
#include <math.h>
#include <inttypes.h>
#include "cdefs.h"
#include "selva/selva_string.h"
#include "selva/hll.h"
#include "xxhash.h"
#include "murmur3.c"

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
        int initial_capacity = sizeof(bool) \
                            + sizeof(precision) \
                            + sizeof(uint32_t);
        // selva_string_init(hllss, NULL, initial_capacity , SELVA_STRING_MUTABLE);

        HyperLogLogPlusPlus *hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(hllss, &len);  


        hll->is_sparse = true;
        hll->precision = precision;
        hll->num_registers = 0;
    }
    else {
        uint32_t num_registers = 1ULL << precision;
        num_registers = 1ULL << precision; //m

        int initial_capacity = sizeof(precision) + sizeof(num_registers) + (num_registers * sizeof(uint32_t));
        // selva_string_init(hllss, NULL, initial_capacity , SELVA_STRING_MUTABLE);

        fprintf(stderr, "%p %x\n", hllss, !hllss ?: hllss->flags);
        HyperLogLogPlusPlus *hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(hllss, &len);  

        hll->is_sparse = false;
        hll->precision = precision;
        hll->num_registers = num_registers;
    }
}

int count_leading_zeros(uint64_t x) {
    return (x == 0 ? 0 : __builtin_clzll(x));
}

void hll_add(struct selva_string *hllss, const void* element) {
    if (!hllss || !element) {
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
    
    uint64_t hash = XXH64(element, strlen(element), 0);
// uint64_t hash = murmur3_64(element, strlen(element), MURMUR3_SEED);

    uint64_t index = hash >> (HASH_SIZE - precision); // j
    uint64_t w = (hash << precision) | (1ULL << (precision - 1)); //w
    uint32_t rho = count_leading_zeros(w) + 1; // ρ(w)

    if (hll->is_sparse) {
        if (index > hll->num_registers && hll->num_registers <= (1ULL << precision) ) {
            selva_string_append(hllss, 0, (index - hll->num_registers) * sizeof(uint32_t));
            selva_string_append(hllss, NULL, sizeof(uint32_t));
            hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(hllss, &len);
            hll->registers[index] = rho;
            hll->num_registers = (index + 1);
        }
    }
    if (rho > hll->registers[index]) {
        hll->registers[index] = rho;
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

    // Step 1: Compute the raw estimate (harmonic mean)
    double raw_estimate = 0.0; //E
    double zero_count = 0.0; // V
    

    for (size_t i = 0; i < num_registers; i++) {
        if (registers[i] == 0) {
            zero_count++;
        }
        raw_estimate += pow(2.0, -((double)registers[i]));
    }
    
    // Step 2: Raw cardinality estimation
    double m = (double)num_registers;
    double alpha_m = compute_alpha_m(num_registers);    
    double estimate = alpha_m * m * m / raw_estimate;

    // Step 3: Small range correction
    if (estimate <= (5.0 / 2.0) * m) {
        // Linear counting for small cardinalities
        estimate = m * log(m / zero_count);
    }
    
    // Step 4: Large range correction
    estimate = apply_bias_correction(estimate, precision);

    return estimate;
}

int main(void) {
    // const char *elements[] = {"banana", "mango", "banana", "cherry", "mango", "apple", "citrus", "orange"};
    struct selva_string *hll;
    hll_init(&hll, 14, SPARSE);

    int num_elements = 1e6;
    char (*elements)[50] = malloc(num_elements * sizeof(*elements));
    if (elements == NULL) {
        perror("Failed to allocate memory");
        exit(EXIT_FAILURE);
    }

    for (int i = 0; i < num_elements; i++) {
        snprintf(elements[i], 50, "hll1_%d", i);
        hll_add(&hll, elements[i]);
    }
    double estimated_cardinality = hll_count(&hll);

    printf("Estimated cardinality: %f\n", estimated_cardinality);
    float expected_cardinality = num_elements;
    float error = fabs(expected_cardinality - estimated_cardinality);
    printf("Error: %0.f (%.2f%%)\n", error, (float)(100.0 * (error / expected_cardinality)));

    free(elements);

    // size_t num_hll = 3;
    // struct selva_string hll_array[num_hll];
    // for (size_t i = 0; i < num_hll; i++) {
    //     hll_array[i] = hll_init(14, DENSE);
    // }
    
    // char buffer[100];
    // for (int i = 0; i < 500000; i++) {
    //     snprintf(buffer, sizeof(buffer), "hll1_%d", i);
    //     hll_add(&hll_array[0], buffer);
    // }
    // for (int i = 250000; i < 750000; i++) {
    //     snprintf(buffer, sizeof(buffer), "hll2_%d", i);
    //     hll_add(&hll_array[1], buffer);
    // }
    // for (int i = 500000; i < 1000000; i++) {
    //     snprintf(buffer, sizeof(buffer), "hll3_%d", i);
    //     hll_add(&hll_array[2], buffer);
    // }

    // struct selva_string aggregated_hll = hll_array_union(hll_array, num_hll);

    // if (selva_string_to_mstr(&aggregated_hll, NULL) != NULL) {
    //     double estimated_cardinality = hll_count(&aggregated_hll);
    //     printf("Estimated cardinality after aggregated union: %f\n", estimated_cardinality);

    //     float expected_cardinality = 1.5e6;
    //     float error = fabs(expected_cardinality - estimated_cardinality);
    //     printf("Error: %0.f (%.2f%%)\n", error, (float)(100.0 * (error / expected_cardinality)));
    //     selva_string_free(&aggregated_hll);
    // }

    // for (size_t i = 0; i < num_hll; i++) {
    //     selva_string_free(&hll_array[i]);
    // }

    return 0;
}