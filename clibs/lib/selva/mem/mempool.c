/*
 * Copyright (c) 2020-2026 SAULX
 * SPDX-License-Identifier: MIT
 */
#if defined(__STDC_LIB_EXT1__)
#define __STDC_WANT_LIB_EXT1__ 1
#elif defined(__linux__)
#define _GNU_SOURCE
#endif
#include <stdio.h>
#include <assert.h>
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include "selva/align.h"
#include "mempool.h"

#define HUGE_PAGES_NA   0
#define HUGE_PAGES_THP  1 /*!< Enable Transparent Huge Pages. */
#define HUGE_PAGES_SOFT 2 /*!< Enable enforced huge pages. Fallback to whatever is the default. */
#define HUGE_PAGES_HARD 3 /*!< Enable enforced huge pages. The program is aborted if no huge pages are available. */

/**
 *
 * HUGE_PAGES_SOFT,and HUGE_PAGES_HARD requires that the user is a member of the
 * /proc/sys/vm/hugetlb_shm_group group.
 * In addition, HUGE_PAGES_HARD requires that /proc/sys/vm/nr_hugepages is set
 * to greater than equal the number of huge pages that will be required.
 * HUGE_PAGES_SOFT will always work it but it will slow down slightly if the
 * system runs out of huge pages.
 */
#define HUGE_PAGES HUGE_PAGES_SOFT

/**
 * Selects whether the free chucks are inserted from smallest address to the largest
 * or vice versa.
 * Growing might seem like a more natural selection and it's indeed slightly
 * easier for stream buffers/sequential prefetching to work it out on reads but
 * on the other hand, insertions might get slightly more costly.
 * As reads are almost equally fast both ways, it might make sense to keep this
 * knob turned off.
 */
#if 0
#define MEMPOOL_GROWING_FREE_LIST 1
#endif

char *mempool_get_obj(const struct mempool *mempool, struct mempool_chunk *chunk)
{
    return ((char *)chunk) + sizeof(struct mempool_chunk) + PAD(sizeof(struct mempool_chunk), mempool->obj_align);
}

static struct mempool_chunk *get_chunk(const struct mempool *mempool, void *obj)
{
    char *p = ((char *)obj) - PAD(sizeof(struct mempool_chunk), mempool->obj_align) - sizeof(struct mempool_chunk);

    return (struct mempool_chunk *)p;
}

static struct mempool_slab *get_slab(const struct mempool_chunk *chunk)
{
    return (struct mempool_slab *)(chunk->slab & ~(uintptr_t)1);
}

struct mempool_slab *mempool_get_slab(const struct mempool *mempool, void *obj)
{
    return get_slab(get_chunk(mempool, obj));
}

struct mempool_slab_info mempool_slab_info(const struct mempool *mempool)
{
    const size_t slab_size = (size_t)mempool->slab_size_kb * 1024;
    const size_t chunk_size = ALIGNED_SIZE(
            sizeof(struct mempool_chunk) +
            PAD(sizeof(struct mempool_chunk), (size_t)mempool->obj_align) +
            (size_t)mempool->obj_size,
            alignof(struct mempool_chunk));
    const size_t nr_total = (slab_size - sizeof(struct mempool_slab)) / chunk_size;

    assert(nr_total > 0);

    return (struct mempool_slab_info){
        .slab_size = slab_size,
        .chunk_size = chunk_size,
        .obj_size = mempool->obj_size,
        .nr_objects = nr_total,
    };
}

void mempool_init(struct mempool *mempool, size_t slab_size, size_t obj_size, size_t obj_align)
{
    assert(slab_size - sizeof(struct mempool_slab) > obj_size &&
           slab_size / 1024 > 0 &&
           slab_size / 1024 < UINT16_MAX &&
           ALIGNED_SIZE(slab_size, 512) == slab_size);
    assert(obj_size < UINT16_MAX);
    assert(obj_align < UINT16_MAX && obj_align <= obj_size);

    mempool->slab_size_kb = (typeof(mempool->slab_size_kb))(slab_size / 1024);
    mempool->obj_size = (typeof(mempool->obj_size))(obj_size);
    mempool->obj_align = (typeof(mempool->obj_align))(obj_align);
    SLIST_INIT(&mempool->slabs);
    LIST_INIT(&mempool->free_chunks);
    mempool->advice = MEMPOOL_ADV_NORMAL | MEMPOOL_ADV_HP_NO;
}

void mempool_init2(struct mempool *mempool, size_t slab_size, size_t obj_size, size_t obj_align, enum mempool_advice advice)
{
    mempool_init(mempool, slab_size, obj_size, obj_align);
    mempool->advice = advice;
}

/**
 * Free slab that was allocated in mempool
 */
static void mempool_free_slab(const struct mempool *mempool, struct mempool_slab *slab)
{
    (void)munmap(slab, mempool->slab_size_kb * 1024);
}

void mempool_destroy(struct mempool *mempool)
{
    /*
     * We don't keep track of the slab pointers because we assume the user to
     * know the slabs and return every single one of them before destroying the
     * mempool.
     */
    while (!SLIST_EMPTY(&mempool->slabs)) {
        struct mempool_slab *slab;

        slab = SLIST_FIRST(&mempool->slabs);
        SLIST_REMOVE_HEAD(&mempool->slabs, next_slab);
        mempool_free_slab(mempool, slab);
    }

    memset(mempool, 0, sizeof(*mempool));
}

void mempool_gc(struct mempool *mempool)
{
    struct mempool_slab_info info = mempool_slab_info(mempool);

    /*
     * Go through all the slabs and find the ones that have no object
     * allocations.
     */
    MEMPOOL_FOREACH_SLAB_BEGIN(pool) {
        if (slab->nr_free == info.nr_objects) {

            SLIST_REMOVE(&mempool->slabs, slab, mempool_slab, next_slab);

            /*
             * Remove all the objects of this slab from the free list.
             */
            MEMPOOL_FOREACH_CHUNK_BEGIN(info, slab) {
                LIST_REMOVE(chunk, next_free);
            } MEMPOOL_FOREACH_CHUNK_END();

            mempool_free_slab(mempool, slab);
        }
    } MEMPOOL_FOREACH_SLAB_END();
}

struct mempool_defrag_ctx {
    struct mempool *mempool;
    int (*obj_compar)(const void *, const void*);
};

#if defined(__STDC_LIB_EXT1__) || defined(__linux__)
static int defrag_cmp(const void *a, const void *b, void *ctx_)
#elif defined(__APPLE__)
static int defrag_cmp(void *ctx_, const void *a, const void *b)
#else
#error "No qsort with ctx available"
#endif
{
    struct mempool_defrag_ctx *ctx = ctx_;
    struct mempool_chunk *chunk_a = (typeof(chunk_a))a;
    struct mempool_chunk *chunk_b = (typeof(chunk_b))b;
    const int inuse_a = chunk_a->slab & 1;
    const int inuse_b = chunk_b->slab & 1;

    //fprintf(stderr, "%p %p %d %d\n", chunk_a, chunk_b, inuse_a, inuse_b);
    if (chunk_a == chunk_b) {
        return 0;
    } else if (inuse_a && inuse_b) {
        return ctx->obj_compar(mempool_get_obj(ctx->mempool, chunk_a), mempool_get_obj(ctx->mempool, chunk_b));
    } else if (inuse_b) { /* a or b depending if we keep empty at the beginning or end. */
        return 1;
    } else if (inuse_a) {
        return -1;
    }
    return chunk_a < chunk_b;
}

void mempool_defrag(struct mempool *mempool, int (*obj_compar)(const void *, const void*))
{
    struct mempool_slab_info slab_nfo = mempool_slab_info(mempool);
    struct mempool_defrag_ctx ctx = {
        .mempool = mempool,
        .obj_compar = obj_compar,
    };

    MEMPOOL_FOREACH_SLAB_BEGIN(mempool) {
        if (slab->nr_free != slab_nfo.nr_objects) {
            /*
             * Temporarily remove all free chunks of this slab from the free list
             * so we can reorder them safely.
             */
            MEMPOOL_FOREACH_CHUNK_BEGIN(slab_nfo, slab) {
                if (!(chunk->slab & (uintptr_t)1)) {
                    LIST_REMOVE(chunk, next_free);
                }
            } MEMPOOL_FOREACH_CHUNK_END();

            struct mempool_chunk *first = get_first_chunk(slab);
            size_t n = slab_nfo.nr_objects;
#if defined(__STDC_LIB_EXT1__)
            (void)qsort_s(first, n, slab_nfo.chunk_size, defrag_cmp, &ctx);
#elif defined(__linux__)
            qsort_r(first, n, slab_nfo.chunk_size, defrag_cmp, &ctx);
#elif defined(__APPLE__)
            qsort_r(first, n, slab_nfo.chunk_size, &ctx, defrag_cmp);
#else
#error "No qsort with ctx available"
#endif

            /*
             * Add the free chunks back to the free list.
             */
#ifdef MEMPOOL_GROWING_FREE_LIST
    struct mempool_chunk *prev = nullptr;
#endif
            MEMPOOL_FOREACH_CHUNK_BEGIN(slab_nfo, slab) {
                if (!(chunk->slab & (uintptr_t)1)) {
#ifdef MEMPOOL_GROWING_FREE_LIST
                    if (prev) {
                        LIST_INSERT_AFTER(prev, chunk, next_free);
                    } else {
#endif
                        LIST_INSERT_HEAD(&mempool->free_chunks, chunk, next_free);
#ifdef MEMPOOL_GROWING_FREE_LIST
                    }
                    prev = chunk;
#endif
                }
            } MEMPOOL_FOREACH_CHUNK_END();
        }
    } MEMPOOL_FOREACH_SLAB_END();
}

static void add_new_slab2freelist(struct mempool *mempool, struct mempool_slab *slab)
{
    const struct mempool_slab_info info = mempool_slab_info(mempool);
    typeof(mempool->free_chunks) *free_chunks = &mempool->free_chunks;
#ifdef MEMPOOL_GROWING_FREE_LIST
    struct mempool_chunk *prev = nullptr;
#endif

    slab->nr_free = info.nr_objects;

    /*
     * Add all new objects to the list of free objects in the pool.
     */
    MEMPOOL_FOREACH_CHUNK_BEGIN(info, slab) {
        chunk->slab = (uintptr_t)slab; /* also marked as free. */
#ifdef MEMPOOL_GROWING_FREE_LIST
        if (prev) {
            LIST_INSERT_AFTER(prev, chunk, next_free);
        } else {
#endif
            LIST_INSERT_HEAD(free_chunks, chunk, next_free);
#ifdef MEMPOOL_GROWING_FREE_LIST
        }
        prev = chunk;
#endif
    } MEMPOOL_FOREACH_CHUNK_END();

    SLIST_INSERT_HEAD(&mempool->slabs, slab, next_slab);
}

/**
 * Allocate a new slab using mmap().
 */
static void mempool_new_slab(struct mempool *mempool)
{
    const size_t bsize = mempool->slab_size_kb * 1024;
#if !defined(__linux__)
    constexpr
#endif
    int mmap_flags = MAP_PRIVATE | MAP_ANONYMOUS;
    struct mempool_slab *slab;

#if defined(__linux__)
    if (bsize >= 2048 * 1024 &&
        (mempool->advice & (MEMPOOL_ADV_HP_SOFT | MEMPOOL_ADV_HP_HARD))) {
        mmap_flags |= MAP_HUGETLB /* | MAP_HUGE_2MB */;
    }
#endif

#if defined(__linux__)
retry:
#endif
    slab = mmap(0, bsize, PROT_READ | PROT_WRITE, mmap_flags, -1, 0);
    if (slab == MAP_FAILED) {
#if defined(__linux__)
        if ((mmap_flags & MAP_HUGETLB) &&
            (mempool->advice & MEMPOOL_ADV_HP_SOFT)) {
            mmap_flags &= ~MAP_HUGETLB;
            goto retry;
        }
#endif
        perror("Failed to allocate a slab");
        abort();
    }

#if defined(__linux__) || defined(__MACH__)
    if (mempool->advice & (MEMPOOL_ADV_RANDOM | MEMPOOL_ADV_SEQUENTIAL)) {
        switch (mempool->advice & (MEMPOOL_ADV_RANDOM | MEMPOOL_ADV_SEQUENTIAL)) {
        case MEMPOOL_ADV_RANDOM:
            madvise(slab, bsize, MADV_RANDOM);
            break;
        case MEMPOOL_ADV_SEQUENTIAL:
            madvise(slab, bsize, MADV_SEQUENTIAL);
            break;
        default: /* NOP */
            break;
        }
    }
#endif

#if defined(__linux__)
    if (bsize >= 2048 * 1024 && (mempool->advice & MEMPOOL_ADV_HP_THP)) {
        (void)madvise(slab, bsize, MADV_HUGEPAGE);
    }
#endif

    add_new_slab2freelist(mempool, slab);
}

void mempool_prealloc(struct mempool *mempool, size_t nr_objects)
{
    struct mempool_slab_info nfo = mempool_slab_info(mempool);
    const size_t nr_slabs = (nr_objects + nfo.nr_objects - 1) / nfo.nr_objects;
    const size_t slab_size = nr_slabs * mempool->slab_size_kb * 1024;
    const size_t bsize = nr_slabs * slab_size;
#if !defined(__linux__)
    constexpr
#endif
    int mmap_flags = MAP_PRIVATE | MAP_ANONYMOUS;
    struct mempool_slab *slabs;

    assert(nr_objects > 0);

    /* TODO Verify that huge pages can be partially unmapped later if necessary. */
#if 0 && defined(__linux__)
    if (bsize >= 2048 * 1024 &&
        (mempool->advice & (MEMPOOL_ADV_HP_SOFT | MEMPOOL_ADV_HP_HARD))) {
        mmap_flags |= MAP_HUGETLB /* | MAP_HUGE_2MB */;
    }
#endif

#if defined(__linux__)
retry:
#endif
    slabs = mmap(0, bsize, PROT_READ | PROT_WRITE, mmap_flags, -1, 0);
    if (slabs == MAP_FAILED) {
#if defined(__linux__)
        if ((mmap_flags & MAP_HUGETLB) &&
            (mempool->advice & MEMPOOL_ADV_HP_SOFT)) {
            mmap_flags &= ~MAP_HUGETLB;
            goto retry;
        }
#endif
        perror("Failed to allocate a slabs");
        abort();
    }

#if defined(__linux__) || defined(__MACH__)
    if (mempool->advice & (MEMPOOL_ADV_RANDOM | MEMPOOL_ADV_SEQUENTIAL)) {
        switch (mempool->advice & (MEMPOOL_ADV_RANDOM | MEMPOOL_ADV_SEQUENTIAL)) {
        case MEMPOOL_ADV_RANDOM:
            madvise(slabs, bsize, MADV_RANDOM);
            break;
        case MEMPOOL_ADV_SEQUENTIAL:
            madvise(slabs, bsize, MADV_SEQUENTIAL);
            break;
        default: /* NOP */
            break;
        }
    }
#endif

#if defined(__linux__)
    if (bsize >= 2048 * 1024 && (mempool->advice & MEMPOOL_ADV_HP_THP)) {
        (void)madvise(slabs, bsize, MADV_HUGEPAGE);
    }
#endif

    for (size_t i = 0; i < nr_slabs; i++) {
        add_new_slab2freelist(mempool, (typeof(slabs))((uint8_t *)slabs + i * slab_size));
    }
}

void *mempool_get(struct mempool *mempool)
{
    struct mempool_chunk *next;

    if (LIST_EMPTY(&mempool->free_chunks)) {
        mempool_new_slab(mempool);
    }

    next = LIST_FIRST(&mempool->free_chunks);
    LIST_REMOVE(next, next_free);
    get_slab(next)->nr_free--;
    next->slab |= 1;

    return mempool_get_obj(mempool, next);
}

void mempool_return(struct mempool *mempool, void *p)
{
    struct mempool_chunk *chunk = get_chunk(mempool, p);

    LIST_INSERT_HEAD(&mempool->free_chunks, chunk, next_free);
    get_slab(chunk)->nr_free++;
    chunk->slab ^= 1;

    /*
     * Note that we never free slabs here. Slabs are only removed when the user
     * explicitly calls mempool_gc().
     *
     * Some fragmentation may occur in the allocator as we are not preferring
     * partially full slabs when getting new objects. Therefore, we may end up
     * with a lot of partially full slabs while the optimal utilization would
     * have mostly full slabs.
     */
}

void mempool_pagecold(struct mempool *mempool, struct mempool_slab *slab)
{
    const size_t bsize = mempool->slab_size_kb * 1024;

#if defined(__linux__)
    (void)madvise(slab, bsize, MADV_COLD);
#else
    (void)posix_madvise(slab, bsize, POSIX_MADV_DONTNEED);
#endif
}

void mempool_pageout(struct mempool *mempool, struct mempool_slab *slab)
{
#if defined(__linux__)
    const size_t bsize = mempool->slab_size_kb * 1024;

    (void)madvise(slab, bsize, MADV_PAGEOUT);
#else
    mempool_pagecold(mempool, slab);
#endif
}

void mempool_pagein(struct mempool *mempool, struct mempool_slab *slab)
{
    const size_t bsize = mempool->slab_size_kb * 1024;

#if defined(__linux__)
    (void)madvise(slab, bsize, MADV_POPULATE_READ);
#else
    (void)posix_madvise(slab, bsize, POSIX_MADV_WILLNEED);
#endif
}
