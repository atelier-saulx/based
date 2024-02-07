/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

void dump_init(void);

/**
 * Save db at exit.
 */
extern bool save_at_exit;

/**
 * [sec] Load the default SDB on startup and save a dump on interval.
 * 0 = disabled.
 */
extern int auto_save_interval;
