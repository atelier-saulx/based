/*
 * Copyright (c) 2023, 2025 SAULX
 * SPDX-License-Identifier: MIT
 */

#include <stdint.h>
#include <sys/types.h>
#include <stdlib.h>
#include "../cstrings.h"

void *selva_malloc(size_t n)
{
    return malloc(n);
}

int LLVMFuzzerTestOneInput(const uint8_t *Data, size_t Size)
{
    if (Size < 3 && ((Size - 1) % 2) != 0) {
        return 0;
    }

    const char wildcard = Data[0];
    const char *list = (const char *)Data + 1;
    size_t len = (Size - 1) / 2;
    const char *str = (const char *)Data + 1 + len;

    (void)stringlist_search(list, str, len, wildcard);

    return 0;
}
