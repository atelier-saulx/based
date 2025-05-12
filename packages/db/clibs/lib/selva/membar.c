/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include "selva/membar.h"

void membar_sync_read(void)
{
    __sync_synchronize();
}

void membar_sync_write(void)
{
#if defined(__arm__) || defined(__aarch64__)
    __asm__ volatile ("isb" ::: "memory");
#else
    __sync_synchronize();
#endif
}
