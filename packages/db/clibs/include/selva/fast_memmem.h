/*
 * Copyright (c) 2024-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stddef.h>
#include "selva/_export.h"

SELVA_EXPORT
void *fast_memmem(const void *h0, size_t k, const void *n0, size_t l);
