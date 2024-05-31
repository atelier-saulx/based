/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#define _GNU_SOURCE
#include <errno.h>
#include <sched.h>
#include <sys/sysinfo.h>
#include "selva_error.h"
#include "util/selva_cpu.h"

unsigned long long selva_cpu_count;

void pthread_attr_set_worker_np(pthread_attr_t *attr)
{
    pthread_attr_setinheritsched(attr, PTHREAD_EXPLICIT_SCHED);
    pthread_attr_setschedpolicy(attr, SCHED_OTHER);
    pthread_attr_setschedparam(attr, &(struct sched_param){ .sched_priority = 0 });
}

int pthread_create_affinity_np(
        pthread_t *restrict thread,
        pthread_attr_t *restrict attr,
        const cpu_set_t *cs,
        void *(*start_routine)(void *),
        void *restrict arg)
{
    pthread_attr_setaffinity_np(attr, sizeof(*cs), cs);

    return pthread_create(thread, attr, start_routine, arg);
}

void selva_cpu_set_main_affinity(const cpu_set_t *cs)
{
    sched_setaffinity(0, sizeof(*cs), cs);
}

void selva_cpu_get_main_affinity(cpu_set_t *cs)
{
    if (sched_getaffinity(0, sizeof(*cs), cs) == -1) {
        CPU_FILL(cs);
    }
}

int selva_cpu_set_sched_user(void)
{
    struct sched_param param = {
        .sched_priority = 0,
    };
    int res;

    res = sched_setscheduler(0, SCHED_OTHER, &param);

    return (res == -1) ? SELVA_EGENERAL : 0;
}

int selva_cpu_set_sched_batch(void)
{
    struct sched_param param = {
        .sched_priority = 0,
    };
    int res;

    res = sched_setscheduler(0, SCHED_BATCH, &param);

    return (res == -1) ? SELVA_EGENERAL : 0;
}

__attribute__((constructor)) static void cpu_init(void)
{
    selva_cpu_count = get_nprocs();
}
