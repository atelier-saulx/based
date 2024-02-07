/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <string.h>
#include "xsi_strerror_r.h"

int xsi_strerror_r(int errnum, char *buf, size_t buflen)
{
    return strerror_r(errnum, buf, buflen);
}
