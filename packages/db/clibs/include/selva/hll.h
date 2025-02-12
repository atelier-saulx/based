#ifndef UTIL_HLL_H
#define UTIL_HLL_H

#include <stdlib.h>
#include <stdint.h>
#include "_export.h"
#include "selva_string.h"
#include <stdbool.h>
#include "cdefs.h"

SELVA_EXPORT
typedef struct {
    bool is_sparse;
    uint8_t precision;
    uint32_t num_registers;
    uint32_t registers[];
} HyperLogLogPlusPlus;

SELVA_EXPORT
void hll_init(struct selva_string *hllss, uint8_t precision, bool is_sparse);
SELVA_EXPORT
void hll_add(struct selva_string *hllss, const void* element);
SELVA_EXPORT
double hll_count(struct selva_string *hllss);
SELVA_EXPORT
struct selva_string hll_array_union(struct selva_string *hll_array, size_t count);

#endif