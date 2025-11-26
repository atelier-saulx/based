/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#include <stdint.h>

static inline uint64_t selva_get_thread_id(void);

#ifdef __linux__
#define _GNU_SOURCE
#include <unistd.h>

/*
 * Sometimes the symbol for getid not there even if _GNU_SOURCE should now
 * expose it on glibc 2.30+.
 */
pid_t gettid(void);

static inline uint64_t selva_get_thread_id(void)
{
    return (uint64_t)gettid();
}
#elifdef __APPLE__
#include <pthread.h>

static inline uint64_t selva_get_thread_id(void)
{
    uint64_t tid;

    (void)pthread_threadid_np((void *)0, &tid);

    return tid;
}
#else
#error "Platform not supported"
#endif
