#include <stdio.h>
#include <string.h>
#include <math.h>
#include <inttypes.h>
#include "cdefs.h"
#include "selva/selva_string.h"
#include "selva/hll.h"
#include "selva/xxhash64.h"
#include "db_panic.h"

#define HLL_MIN_PRECISION 4
#define HLL_MAX_PRECISION 16
#define HASH_SIZE 64

#define SPARSE true
#define DENSE false

#define ASC true 
#define DSC false

typedef struct {
    struct {
        uint8_t is_sparse : 1;
        uint8_t dirty : 1;
        uint8_t precision : 6;
    };
    uint16_t num_registers;
    uint32_t count;
    uint32_t registers[];
} HyperLogLogPlusPlus;

static_assert(HLL_INIT_SIZE == sizeof(HyperLogLogPlusPlus));

void hll_init(struct selva_string *hllss, uint8_t precision, bool is_sparse) {
    if (precision < HLL_MIN_PRECISION ||
        precision > HLL_MAX_PRECISION) {
        printf("Precision must be between %d and %d", HLL_MIN_PRECISION, HLL_MAX_PRECISION );
        exit(EXIT_FAILURE);
    }
    if (hllss == nullptr){
        printf("Error: Getting NULL selva string during HLL initialization.\n");
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

        (void)selva_string_append(hllss, nullptr, num_registers * sizeof(uint32_t));
        HyperLogLogPlusPlus *hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(hllss, &len);

        hll->is_sparse = false;
        hll->precision = precision;
        hll->num_registers = num_registers;
    }
}

static int count_leading_zeros(uint64_t x) {
    return (x == 0 ? 0 : __builtin_clzll(x));
}

void hll_add(struct selva_string *hllss, const uint64_t hash) {
    if (!hllss || !hash) {
        db_panic("Error: Unable to read stored value.");
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
    uint32_t rho = count_leading_zeros(w) + 1;

    if (hll->is_sparse) {
        if (index > hll->num_registers && hll->num_registers <= (1ULL << precision) ) {
            selva_string_append(hllss, 0, (index - hll->num_registers) * sizeof(uint32_t));
            selva_string_append(hllss, nullptr, sizeof(uint32_t));
            hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(hllss, &len);
            hll->registers[index] = rho;
            hll->num_registers = (index + 1);
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

struct selva_string hll_array_union(struct selva_string *hll_array, size_t count) {

    HyperLogLogPlusPlus *first_hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(&hll_array[0], nullptr); //&?

    uint8_t precision = first_hll->precision;
    uint32_t num_registers = first_hll->num_registers;

    struct selva_string result;
    hll_init(&result, precision, DENSE);
    HyperLogLogPlusPlus *result_hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(&result, nullptr);

    memcpy(result_hll->registers, first_hll->registers, num_registers * sizeof(uint32_t));

    for (size_t j = 1; j < count; j++) {
        HyperLogLogPlusPlus *current_hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(&hll_array[j], nullptr);
        if (current_hll->precision != precision) {
            db_panic("Precision mismatch is unsupported.");
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

// static unsigned long locate(const float  *xx, size_t n, float x, bool ascnd) {
//     size_t jl = 0;
//     size_t ju = n;

//     while (ju - jl > 1) {
//         size_t jm = (ju + jl) >> 1;
//         if (x >= xx[jm] == ascnd) {
//             jl = jm;
//         } else {
//             ju = jm;
//         }
//     }
//     return jl;
// }

// static double apply_bias_correction(double estimate, uint8_t precision) {
//     size_t j = locate(raw_estimate_data[precision - 4], actual_cols[precision], estimate, ASC);
    
//     const float avg_estimate = (raw_estimate_data[precision - 4][j] + raw_estimate_data[precision - 4][j + 1]) * 0.5f;
//     const float avg_bias = (bias_data[precision - 4][j] + bias_data[precision - 4][j + 1]) * 0.5f;

//     return (avg_estimate + avg_bias) * 0.5f);
// }

static double compute_alpha_m(size_t m) {
    switch(m) {
        case 16: return 0.673; break;
        case 32: return 0.697; break;
        case 64: return 0.709; break;
        default:
            return 0.7213 / (1.0 + 1.079 / m); break;
    }
}

uint8_t *hll_count(struct selva_string *hllss) {
    if (!hllss) {
        return nullptr;
    }

    size_t len;
    HyperLogLogPlusPlus *hll = (HyperLogLogPlusPlus *)selva_string_to_mstr(hllss, &len);

    if (!hll->dirty) {
        return (uint8_t *)&hll->count;
    }

    // uint32_t precision = hll->precision;
    uint32_t num_registers = hll->num_registers;
    uint32_t *registers = hll->registers;

    double raw_estimate = 0.0;
    double zero_count = 0.0;


    for (size_t i = 0; i < num_registers; i++) {
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

    // bias correction is suspended until a validation of threshould table being done
    // if (estimate <= 5 * m){
    //     estimate = apply_bias_correction(estimate, precision);
    // }

    hll->count = (uint32_t)estimate;
    hll->dirty = false;
    return (uint8_t *)(&hll->count);
}

int main(void) {

    /* -------------------------------------------
    ** Single value test
    ** -----------------------------------------*/

#if 0
    size_t precision = 14;

    const uint64_t hash = xxHash64("myCoolValue", strlen("myCoolValue"));

    int initial_capacity = sizeof(bool) \
                            + sizeof(precision) \
                            + sizeof(uint32_t);

    struct selva_string hll;

    selva_string_init(&hll, nullptr, initial_capacity , SELVA_STRING_MUTABLE);
    hll_init(&hll, precision, SPARSE);
    hll_add(&hll, hash);
    double estimated_cardinality = hll_count(&hll);
    printf("Estimated cardinality: %f\n", estimated_cardinality);
#endif

    /* -------------------------------------------
    ** Array union test
    ** -----------------------------------------*/

    size_t precision = 14;
    int initial_capacity = sizeof(bool) \
                            + sizeof(precision) \
                            + sizeof(uint32_t);
    struct selva_string hll;
    selva_string_init(&hll, nullptr, initial_capacity , SELVA_STRING_MUTABLE);

    hll_init(&hll, precision, SPARSE);

    int num_elements = 1e7;
    char (*elements)[50] = malloc(num_elements * sizeof(*elements));
    if (elements == nullptr) {
        perror("Failed to allocate memory");
        exit(EXIT_FAILURE);
    }

    for (int i = 0; i < num_elements; i++) {
        snprintf(elements[i], 50, "hll1_%d", i);
        hll_add(&hll, xxHash64(elements[i], strlen(elements[i])));
    }
    uint32_t estimated_cardinality = *hll_count(&hll);

    printf("Estimated cardinality: %u\n", estimated_cardinality);
    float expected_cardinality = num_elements;
    float error = fabs(expected_cardinality - estimated_cardinality);
    printf("Error: %0.f (%.2f%%)\n", error, (float)(100.0 * (error / expected_cardinality)));

    free(elements);

    return 0;
}
