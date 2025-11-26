/*
 * Copyright (c) 2025 SAULX
 * Copyright (C) 2013, 2021 Mark Adler <madler@alumni.caltech.edu>
 * SPDX-License-Identifier: Zlib
 */
#pragma once

#include <stddef.h>
#include <stdint.h>
#include "selva/_export.h"

/**
 * Compute CRC-32C.
 */
SELVA_EXPORT
uint32_t crc32c(uint32_t crc, void const *buf, size_t len)
    __attribute__((pure, access(read_only, 2, 3)));
