/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stddef.h>
#include <stdint.h>
#include "selva/_export.h"

SELVA_EXPORT
uint8_t fast_memcmp(void *restrict a, void *restrict b, size_t len);
