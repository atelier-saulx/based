/*
 * Copyright (c) 2021-2022, 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include "jemalloc_selva.h"
#include "auto_free.h"

void _wrap_selva_free(void *p) {
    void **pp = (void **)p;

    selva_free(*pp);
}
