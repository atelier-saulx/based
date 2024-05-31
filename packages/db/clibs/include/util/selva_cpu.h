/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#if __linux__
#include <sched.h>
#endif
#include <pthread.h>

#ifdef __APPLE__
typedef struct cpu_set {
  unsigned long long mask;
} cpu_set_t;

static inline void
CPU_ZERO(cpu_set_t *cs)
{
    cs->mask = 0;
}

static inline void CPU_SET(int cpu, cpu_set_t *cs)
{
    cs->mask |= (1 << cpu);
}

static inline void CPU_CLR(int cpu, cpu_set_t *cs)
{
    cs->mask &= ~(1 << cpu);
}

static inline int CPU_ISSET(int cpu, cpu_set_t *cs)
{
    return (cs->mask & (1 << cpu));
}

static inline void CPU_XOR(cpu_set_t *dest, cpu_set_t *src1, cpu_set_t *src2)
{
    dest->mask = src1->mask ^ src2->mask;
}
#endif

/**
 * Set a worker class QoS scheduler for a pthread_attr.
 */
void pthread_attr_set_worker_np(pthread_attr_t *attr);

/**
 * Start a pthread with a predefined affinity.
 * This function will modify attr.
 */
int pthread_create_affinity_np(
        pthread_t *restrict thread,
        pthread_attr_t *restrict attr,
        const cpu_set_t *cs,
        void *(*start_routine)(void *),
        void *restrict arg);

/**
 * Set the main thread affinity.
 */
void selva_cpu_set_main_affinity(const cpu_set_t *cs);

/***
 * Get the current affinity of the main thread.
 */
void selva_cpu_get_main_affinity(cpu_set_t *cs);

/**
 * Migrate the main thread to cpu.
 * This function should be only called from the main thread.
 * Calling this function is the same as calling selva_cpu_set_main_affinity()
 * for a single CPU.
 */
void selva_cpu_migrate_main(int cpu);

/**
 * Number of CPUs available.
 */
extern unsigned long long selva_cpu_count;

static inline void CPU_FILL(cpu_set_t *cs)
{
    CPU_ZERO(cs);

    for (unsigned long long i = 0; i < selva_cpu_count; i++) {
        CPU_SET(i, cs);
    }
}

/**
 * Set a user class QoS scheduler for the main thread.
 */
int selva_cpu_set_sched_user(void);

/**
 * Set a batch class QoS scheduler for the main thread.
 */
int selva_cpu_set_sched_batch(void);
