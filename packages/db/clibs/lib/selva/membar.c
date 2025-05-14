/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stdatomic.h>
#include "selva/membar.h"

void membar_sync_read(void)
{
#if defined(__arm__) || defined(__aarch64__)
    __asm__ volatile (
            "dmb ishld"
            ::: "memory");
#else
    atomic_thread_fence(memory_order_acquire);
#endif
}

void membar_sync_write(void)
{
#if defined(__arm__) || defined(__aarch64__)
    __asm__ volatile (
            "isb\n\t"
            "dmb ishst"
            ::: "memory");
#else
    atomic_thread_fence(memory_order_release);
#endif

}
