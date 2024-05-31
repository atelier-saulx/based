/*
 * Copyright (c) 2023-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef _UTIL_RUSAGE_H_
#define _UTIL_RUSAGE_H_

struct selva_timespec {
    int64_t tv_sec;
    int64_t tv_nsec;
};

struct selva_rusage {
    struct selva_timespec ru_utime;
    struct selva_timespec ru_stime;
    uint64_t ru_maxrss; /* in bytes */
};

enum selva_rusage_who {
    SELVA_RUSAGE_SELF,
    SELVA_RUSAGE_CHILDREN,
};

void selva_getrusage(enum selva_rusage_who who, struct selva_rusage *rusage)
    __attribute__((access(write_only, 2)));

void selva_getrusage_net(enum selva_rusage_who who, struct selva_rusage *rusage)
    __attribute__((access(write_only, 2)));

#endif /* _UTIL_RUSAGE_H_ */
