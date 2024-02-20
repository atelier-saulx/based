/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#define _GNU_SOURCE
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <sys/stat.h>
#include "util/selva_cpu.h"
#include "selva_log.h"
#include "event_loop.h"
#include "proc_init.h"

static void set_nofile_limit(void)
{
    struct rlimit limit;
    rlim_t newlim = EVENT_LOOP_MAX_FDS + 3;

    if (getrlimit(RLIMIT_NOFILE, &limit) == -1) {
        int e = errno;

        SELVA_LOG(SELVA_LOGL_CRIT, "Unable to obtain RLIMIT_NOFILE: %s", strerror(e));
        exit(EXIT_FAILURE);
    }

    if (limit.rlim_max < newlim) {
        SELVA_LOG(SELVA_LOGL_WARN, "RLIMIT_NOFILE will be lower than required (%ju < %ju)",
                  (uintmax_t)limit.rlim_max, (uintmax_t)newlim);
    }

    if (limit.rlim_cur != newlim) {
        limit.rlim_cur = min(limit.rlim_max, (rlim_t)newlim);

        if (setrlimit(RLIMIT_NOFILE, &limit) == -1) {
            int e = errno;

            SELVA_LOG(SELVA_LOGL_CRIT, "Unable to set RLIMIT_NOFILE: %s", strerror(e));
            exit(EXIT_FAILURE);
        }
    }
}

void proc_init(int main_cpu)
{
    selva_cpu_migrate_main(main_cpu);
    (void)selva_cpu_set_sched_user();

    /*
     * Safer umask to disallow creating executables or world readable dumps.
     */
    umask((S_IRUSR | S_IWUSR | S_IRGRP) ^ 0777);

    set_nofile_limit();

    /*
     * In case the caller gave us something that's actually readable, we'll
     * get rid of it now.
     */
    freopen("/dev/null", "r", stdin);
}
