/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <locale.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/stat.h>
#include "jemalloc.h"
#include "libdeflate.h"
#include "selva_log.h"
#include "event_loop.h"
#include "module.h"
#include "selva_langs.h"
#include "../tunables.h"

static const char *modules[] = {
    "mod_signal.so",
#if 0
    "mod_demo_timeout.so",
    "mod_demo_async.so",
    "mod_demo_sock.so",
#endif
    "mod_server.so",
    "mod_io.so",
    "mod_db.so",
    "mod_piper.so",
};

int main(void)
{
    evl_module_init("main");
    evl_init();

    /*
     * This should probably always be en_GB or en_US to avoid any unforeseen
     * consequences like ctype functions breaking or error messages changing.
     * Although, if necessary, it could be possible to just change the LC_CTYPE
     * or some other specific category.
     */
    if (!setlocale(LC_ALL, "en_GB.UTF-8")) {
        SELVA_LOG(SELVA_LOGL_CRIT, "Failed to set the process default locale");
        exit(EXIT_FAILURE);
    }
    if (load_langs()) {
        SELVA_LOG(SELVA_LOGL_CRIT, "selva_langs init failed");
        exit(EXIT_FAILURE);
    }

    /*
     * Safer umask to disallow creating executables or world readable dumps.
     */
    umask((S_IRUSR | S_IWUSR | S_IRGRP) ^ 0777);

    /*
     * In case the caller gave us something that's actually readable, we'll
     * get rid of it now.
     */
    freopen("/dev/null", "r", stdin);

    for (size_t i = 0; i < num_elem(modules); i++) {
        if (!evl_load_module(modules[i])) {
            exit(EXIT_FAILURE);
        }
    }

    evl_start();
    evl_deinit();

    return 0;
}

__constructor static void init_main(void)
{
    libdeflate_set_memory_allocator(selva_malloc, selva_free);
}
