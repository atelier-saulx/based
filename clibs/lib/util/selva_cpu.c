/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#define _GNU_SOURCE
#include "util/selva_cpu.h"

void selva_cpu_migrate_main(int cpu)
{
    cpu_set_t cpuset;

    CPU_ZERO(&cpuset);
    CPU_SET(cpu, &cpuset);
    selva_cpu_set_main_affinity(&cpuset);
}
