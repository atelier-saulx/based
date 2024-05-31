/*
 * Copyright (c) 2023-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stdint.h>
#include <sys/resource.h>
#include <sys/time.h>
#include "util/endian.h"
#include "util/selva_rusage.h"

static int get_rusage_who(enum selva_rusage_who who)
{
    switch (who) {
    case SELVA_RUSAGE_CHILDREN:
        return RUSAGE_CHILDREN;
    default:
        return RUSAGE_SELF;
    }
}

void selva_getrusage(enum selva_rusage_who who, struct selva_rusage *rusage)
{
    struct rusage ru = {};

    (void)getrusage(get_rusage_who(who), &ru);

    *rusage = (struct selva_rusage){
        .ru_utime = (struct selva_timespec){
            .tv_sec = ru.ru_utime.tv_sec,
            .tv_nsec = ru.ru_utime.tv_usec * 1000,
        },
        .ru_stime = (struct selva_timespec){
            .tv_sec = ru.ru_stime.tv_sec,
            .tv_nsec = ru.ru_stime.tv_usec * 1000,
        },
#if __linux__
        .ru_maxrss = ru.ru_maxrss * 1024
#elif __APPLE__ && __MACH__
        .ru_maxrss = ru.ru_maxrss,
#else
#error "OS not supported"
#endif
    };
}

void selva_getrusage_net(enum selva_rusage_who who, struct selva_rusage *rusage)
{
    struct rusage ru = {};

    (void)getrusage(get_rusage_who(who), &ru);

    *rusage = (struct selva_rusage){
        .ru_utime = (struct selva_timespec){
            .tv_sec = htole64(ru.ru_utime.tv_sec),
            .tv_nsec = htole64(ru.ru_utime.tv_usec * 1000),
        },
        .ru_stime = (struct selva_timespec){
            .tv_sec = htole64(ru.ru_stime.tv_sec),
            .tv_nsec = htole64(ru.ru_stime.tv_usec * 1000),
        },
#if __linux__
        .ru_maxrss = htole64(ru.ru_maxrss * 1024)
#elif __APPLE__ && __MACH__
        .ru_maxrss = htole64(ru.ru_maxrss),
#else
#error "OS not supported"
#endif
    };
}
