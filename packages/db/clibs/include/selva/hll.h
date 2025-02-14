#ifndef UTIL_HLL_H
#define UTIL_HLL_H

#include <stdlib.h>
#include <stdint.h>
#include "selva/_export.h"
#include "selva_string.h"
#include <stdbool.h>
#include "cdefs.h"


SELVA_EXPORT
void hll_init(struct selva_string *hllss, uint8_t precision, bool is_sparse);
SELVA_EXPORT
void hll_add(struct selva_string *hllss, uint64_t element);
SELVA_EXPORT
double hll_count(struct selva_string *hllss);
SELVA_EXPORT
struct selva_string hll_array_union(struct selva_string *hll_array, size_t count);

#endif