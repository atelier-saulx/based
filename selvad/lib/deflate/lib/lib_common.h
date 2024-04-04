/*
 * lib_common.h - internal header included by all library code
 */

#ifndef LIB_LIB_COMMON_H
#define LIB_LIB_COMMON_H

#ifdef LIBDEFLATE_H
#  error "lib_common.h must always be included before libdeflate.h"
   /* because BUILDING_LIBDEFLATE must be set first */
#endif

#define BUILDING_LIBDEFLATE

#include "common_defs.h"

void *libdeflate_malloc(size_t size);
void libdeflate_free(void *ptr);

void *libdeflate_aligned_malloc(size_t alignment, size_t size);
void libdeflate_aligned_free(void *ptr);

#include <string.h>
#include <assert.h>

#define ASSERT assert

#define CONCAT_IMPL(a, b)   a##b
#define CONCAT(a, b)        CONCAT_IMPL(a, b)
#define ADD_SUFFIX(name)    CONCAT(name, SUFFIX)

#endif /* LIB_LIB_COMMON_H */
