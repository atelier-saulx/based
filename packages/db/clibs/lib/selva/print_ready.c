/*
 * Copyright (c) 2024-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stdarg.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include "selva/ctime.h"
#include "print_ready.h"

void print_ready(
        char *restrict msg,
        struct timespec * restrict ts_start,
        struct timespec * restrict ts_end,
        const char *restrict format,
        ...)
{
    va_list args;
    struct timespec ts_diff;
    double t;
    const char *t_unit;

    va_start(args);

    timespec_sub(&ts_diff, ts_end, ts_start);
    t = timespec2ms(&ts_diff);

    if (t < 0.001) {
        t *= 1e6;
        t_unit = "ns";
    } else if (t < 1) {
        t *= 1e3;
        t_unit = "us";
    } else if (t < 1e3) {
        t_unit = "ms";
    } else if (t < 60e3) {
        t /= 1e3;
        t_unit = "s";
    } else if (t < 3.6e6) {
        t /= 60e3;
        t_unit = "min";
    } else {
        t /= 3.6e6;
        t_unit = "h";
    }

    fprintf(stderr, "%s ready in %.2f %s ", msg, t, t_unit);
    vfprintf(stderr, format, args);
    if (format[strlen(format) - 1] != '\n') {
        fprintf(stderr, "\n");
    }

    va_end(args);
}
