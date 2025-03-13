/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stddef.h>
#include "selva/_export.h"

SELVA_EXPORT
bool fast_memcmp(const void *restrict a, const void *restrict b, size_t len);
