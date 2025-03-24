/*
 * Copyright (c) 2024-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <pthread.h>
#include "selva/selva_string.h"
#include "selva/worker_ctx.h"

static __thread bool worker_initialized;

void worker_ctx_init()
{
#if 0
    pthread_t x = pthread_self();
#endif

    selva_string_init_tls();
    worker_initialized = true;
}

void worker_ctx_deinit()
{
    if (worker_initialized) {
        selva_string_deinit_tls();
        worker_initialized = false;
    }
}
