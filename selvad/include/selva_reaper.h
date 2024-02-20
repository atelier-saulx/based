/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "_evl_export.h"

#if SELVA_SIGNAL_MAIN
void setup_sigchld(void);
#define SELVA_SIGNAL_EXPORT(_ret_, _fun_name_, ...) _ret_ _fun_name_(__VA_ARGS__) EVL_EXTERN
#else
#define SELVA_SIGNAL_EXPORT(_ret_, _fun_name_, ...) _ret_ (*_fun_name_)(__VA_ARGS__) EVL_COMMON
#endif

typedef int (*reaper_hook_t)(pid_t pid, int status, int selva_err);

SELVA_SIGNAL_EXPORT(void, selva_reaper_register_hook, reaper_hook_t hook, int prio);

#define _import_selva_reaper(apply) \
    apply(selva_reaper_register_hook)

/* Reaper is actually implemented in mod_signal. */
#define _import_selva_reaper1(f) \
    evl_import(f, "mod_signal.so");

/**
 * Import all symbols from selva_reaper.h.
 */
#define import_selva_reaper() \
    _import_selva_reaper(_import_selva_reaper1)
