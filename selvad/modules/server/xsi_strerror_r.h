/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

/* Hack to avoid seeing GNU-specific strerror_r. */
int xsi_strerror_r(int errnum, char *buf, size_t buflen);
