/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include "selva/_export.h"

/*
 * When you run threads on different cores on Graviton it doesn't guarantee that
 * a write in one thread is seen in the other one immediately.
 * https://github.com/aws/aws-graviton-getting-started/blob/main/optimizing.md#ordering-issues
 *
 * This is also true on the Apple M arch:
 * https://developer.apple.com/documentation/apple-silicon/addressing-architectural-differences-in-your-macos-code
 */

/**
 * Read memory barrier.
 * Call this function before read in case another thread has potentially
 * written to the memory addresses the current thread is going to access.
 */
SELVA_EXPORT
__attribute__((no_reorder))
void membar_sync_read(void);

/**
 * Write memory barrier.
 * Call this function after write to memory when another thread is expected to
 * read the written data.
 */
SELVA_EXPORT
__attribute__((no_reorder))
void membar_sync_write(void);
