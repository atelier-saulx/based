/*
 * Copyright (c) 2020-2026 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef _UTIL_MEMPOOL_H_
#define _UTIL_MEMPOOL_H_

#include <stddef.h>
#include <stdint.h>
#include "queue.h"

/**
 * A structure describing a slab in the pool allocator.
 */
struct mempool_slab {
    size_t nr_free;
    SLIST_ENTRY(mempool_slab) next_slab;
} __attribute__((aligned((16)))); /* max_align_t would be better. */

/**
 * A structure describing a chunk allocation.
 */
struct mempool_chunk {
    /**
     * A pointer back the slab.
     * The first bit is used to mark that the chunk is in use.
     */
    uintptr_t slab;
    /**
     * A list entry pointing to the next free chunk if this object is in the
     * free list.
     */
    LIST_ENTRY(mempool_chunk) next_free;
} __attribute__((aligned(sizeof(size_t))));

/**
 * Memory use advice bitmask.
 * You can select on of MEMPOOL_ADV_NORMAL, MEMPOOL_ADV_RANDOM, and MEMPOOL_ADV_SEQUENTIAL.
 * In addition you can select one of MEMPOOL_ADV_HP_NO, MEMPOOL_ADV_HP_THP, MEMPOOL_ADV_HP_SOFT, and MEMPOOL_ADV_HP_HARD.
 * The defaults are MEMPOOL_ADV_NORMAL | MEMPOOL_ADV_HP_NO.
 */
enum mempool_advice {
    MEMPOOL_ADV_NORMAL = 0x01,
    MEMPOOL_ADV_RANDOM = 0x02,
    MEMPOOL_ADV_SEQUENTIAL = 0x04,
    MEMPOOL_ADV_HP_NO = 0x10,
    MEMPOOL_ADV_HP_THP = 0x20, /*!< Enable Transparent Huge Pages. */
    MEMPOOL_ADV_HP_SOFT = 0x40, /*!< Enable enforced huge pages. Fallback to whatever is the default. */
    MEMPOOL_ADV_HP_HARD = 0x80, /*!< Enable enforced huge pages. The program is aborted if no huge pages are available. */
};

/**
 * A structure describing a memory pool.
 */
struct mempool {
    uint16_t slab_size_kb;
    uint16_t obj_align;
    uint32_t obj_size;
    enum mempool_advice advice;
    SLIST_HEAD(mempool_slab_list, mempool_slab) slabs;
    LIST_HEAD(mempool_free_chunk_list, mempool_chunk) free_chunks;
};

/**
 * Slab descriptor for a mempool.
 * This struct is used to temporarily hold the slab size information shared by
 * all slabs in a pool.
 */
struct mempool_slab_info {
    size_t slab_size; /*!< Slab size. */
    size_t chunk_size; /*!< Chunk size. */
    size_t obj_size; /*!< Object size. */
    size_t nr_objects; /*!< Number of objects per slab. */
};

/**
 * Initialize a new mempool slab allocator.
 * @param slab_size is the size of a single slab.
 * @param obj_size is the size of a single object stored in a slab.
 */
void mempool_init(struct mempool *mempool, size_t slab_size, size_t obj_size, size_t obj_align)
    __attribute__((access(read_write, 1)));

void mempool_init2(struct mempool *mempool, size_t slab_size, size_t obj_size, size_t obj_align, enum mempool_advice advice)
    __attribute__((access(read_write, 1)));

/**
 * Destroy a mempool and free all memory.
 * Note that this function doesn't check whether all objects have been
 * returned.
 */
void mempool_destroy(struct mempool *mempool)
    __attribute__((access(read_write, 1)));

/**
 * Free all unused slabs.
 */
void mempool_gc(struct mempool *mempool)
    __attribute__((access(read_write, 1)));

/**
 * Defragment and sort chunks within slabs.
 * This operation will affect the object pointers.
 */
void mempool_defrag(struct mempool *mempool, int (*obj_compar)(const void *, const void*));

void mempool_prealloc(struct mempool *mempool, size_t nr_objects);

/**
 * Get a new object from the pool.
 */
[[nodiscard]]
void *mempool_get(struct mempool *mempool)
    __attribute__((access(read_write, 1), returns_nonnull));

/**
 * Return an object back to the pool.
 */
void mempool_return(struct mempool *mempool, void *p);

/**
 * Calculate mempool_slab_info for mempool.
 */
__purefn struct mempool_slab_info mempool_slab_info(const struct mempool *mempool);

char *mempool_get_obj(const struct mempool *mempool, struct mempool_chunk *chunk);
struct mempool_slab *mempool_get_slab(const struct mempool *mempool, void *obj);

void mempool_pagecold(struct mempool *mempool, struct mempool_slab *slab);
void mempool_pageout(struct mempool *mempool, struct mempool_slab *slab);
void mempool_pagein(struct mempool *mempool, struct mempool_slab *slab);

/**
 * Get a pointer to the first chunk in a slab.
 * The rest of the chunks are `info->chunk_size` apart from each other.
 */
static inline struct mempool_chunk *get_first_chunk(struct mempool_slab * restrict slab)
{
    char *p = ((char *)slab) + sizeof(struct mempool_slab);

    return (struct mempool_chunk *)p;
}

/**
 * For each slab in the mempool.
 * The current slab will be available as the pointer variable `slab`.
 * Must be terminated with MEMPOOL_FOREACH_SLAB_END().
 *
 * **Example**
 * ```c
 * MEMPOOL_FOREACH_SLAB_BEGIN(pool) {
 *     mempool_pageout(mempool, slab);
 * } MEMPOOL_FOREACH_SLAB_END();
 * ```
 */
#define MEMPOOL_FOREACH_SLAB_BEGIN(pool) \
    do { \
        struct mempool_slab *slab; \
        struct mempool_slab *_slab_temp; \
        SLIST_FOREACH_SAFE(slab, &(mempool)->slabs, next_slab, _slab_temp)

#define MEMPOOL_FOREACH_SLAB_END() \
   } while (0)

/**
 * For each chunk on the slab.
 * The current chunk will be available as the pointer variable `chunk`.
 * Must be terminated with MEMPOOL_FOREACH_CHUNK_END().
 *
 * **Example**
 * ```c
 * MEMPOOL_FOREACH_SLAB_BEGIN(pool) {
 *     MEMPOOL_FOREACH_CHUNK_BEGIN(slab_nfo, slab) {
 *         bool inuse = chunk->slab & 1;
 *         if (inuse) {
 *             void *obj = mempool_get_obj(pool, chunk);
 * ```
 * @param slab_nfo is a `struct slab_info` from `mempool_slab_info()`.
 * @param slab is a mempool slab. It can be retrieved from any mempool object by calling `mempool_get_slab()`.
 */
#define MEMPOOL_FOREACH_CHUNK_BEGIN(slab_nfo, slab) \
    static_assert(__builtin_types_compatible_p(typeof(slab_nfo), struct mempool_slab_info)); \
    static_assert(__builtin_types_compatible_p(typeof(slab), struct mempool_slab *)); \
    do { \
        struct mempool_chunk *chunk = get_first_chunk(slab); \
        for (size_t i = 0; i < (slab_nfo).nr_objects; (chunk = (struct mempool_chunk *)((char *)chunk + (slab_nfo).chunk_size)), i++)

#define MEMPOOL_FOREACH_CHUNK_END() \
    } while (0)

#endif /* _UTIL_MEMPOOl_H_ */
