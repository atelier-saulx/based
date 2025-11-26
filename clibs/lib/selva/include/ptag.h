/*
 * Copyright (c) 2021-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef _SELVA_PTAG_H_
#define _SELVA_PTAG_H_

/**
 * @addtogroup ptag
 * Tagged pointers.
 * We can add tags to the lowest or highest bits on pointers because we know
 * that the architecture will never use those bits. The tag bits needs to be
 * removed before using the pointer.
 * - high: 16-bits on aarch and x64 except with Intel 5-level paging when it becomes 7-bits
 * - low: 2-bits in any 4-byte aligned pointer
 * @{
 */

/**
 * Select low or high bits mode.
 * - 0: low
 * - 1: high
 */
#define PTAG_MODE 0

#if PTAG_MODE == 0
#define PTAG_MASK 0x03ull

/**
 * Create a tagged pointer.
 */
#define PTAG(value, tag) ({\
    static_assert(__builtin_types_compatible_p(typeof(tag), short) || \
                  __builtin_types_compatible_p(typeof(tag), int) || \
                  __builtin_types_compatible_p(typeof(tag), unsigned)); \
    ((typeof (value))(((uintptr_t)(value) & ~PTAG_MASK) | ((tag) & PTAG_MASK))); \
})

/**
 * Get the tag value from a tagged pointer.
 */
#define PTAG_GETTAG(ptag) \
    ((int)((uintptr_t)(ptag) & PTAG_MASK))

/**
 * Get the pointer value from a tagged pointer.
 */
#define PTAG_GETP(ptag) \
    (void *)((uintptr_t)(ptag) & ~PTAG_MASK)
#else
#define PTAG_MASK 0xFFFF000000000000ull
#define PTAG_VADDR 48

#define PTAG(value, tag) ({\
    static_assert(__builtin_types_compatible_p(typeof(tag), short) || \
                  __builtin_types_compatible_p(typeof(tag), int) || \
                  __builtin_types_compatible_p(typeof(tag), unsigned)); \
    ((typeof (value))(((uintptr_t)(value) & ~PTAG_MASK) | ((uintptr_t)(tag) << PTAG_VADDR))); \
})

#define PTAG_GETTAG(ptag) \
    ((int)(((uintptr_t)(ptag) & PTAG_MASK) >> PTAG_VADDR))

#ifdef __aarch64__
#define PTAG_GETP(ptag) \
    (void *)((uintptr_t)(ptag) & ~PTAG_MASK)
#else
#define PTAG_GETP(ptag) \
    (void *)(int *)(((uintptr_t)(ptag) & ((1ull << 48) - 1)) | \
                ~(((uintptr_t)(ptag) & (1ull << 47)) - 1));
#endif

#endif

/**
 * @}
 */

#endif /* _SELVA_PTAG_H_ */
