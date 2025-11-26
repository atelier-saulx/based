/*
 * Copyright (c) 2023, 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "selva/_export.h"

struct backoff_timeout;

struct backoff_timeout {
    double t_min; /*!< Min time. [ms] */
    double t_max; /*!< Max time. [ms] */
    double factor;
    int attempt; /*!< Current attempt nr. Can be reset by caller. */
#ifndef __APPLE__
    struct random_data rnd_state;
#endif
    char rnd_state_buf[32];
};

SELVA_EXPORT
extern const struct backoff_timeout backoff_timeout_defaults;

SELVA_EXPORT
void backoff_timeout_init(struct backoff_timeout *s);

SELVA_EXPORT
void backoff_timeout_next(struct backoff_timeout *s, struct timespec *ts);
