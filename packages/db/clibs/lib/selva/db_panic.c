/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "db_panic.h"

[[noreturn]]
void db_panic_fn(const char * restrict where, const char * restrict func, const char * restrict fmt, ...)
{
    va_list args;

    va_start(args);
    fprintf(stderr, "%s:%s: ", where, func);
    vfprintf(stderr, fmt, args);
    if (fmt[strlen(fmt) - 1] != '\n') {
        fputc('\n', stderr);
    }
    va_end(args);

    abort();
}
