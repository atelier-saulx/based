/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <errno.h>
#include <locale.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "jemalloc.h"
#include "libdeflate.h"
#include "config.h"
#include "event_loop.h"
#include "module.h"
#include "selva_langs.h"
#include "selva_log.h"
#include "proc_init.h"
#include "../tunables.h"

static int main_cpu = 0;

static const struct config main_cfg_map[] = {
    { "SELVA_MAIN_CPU",     CONFIG_INT, &main_cpu },
};

static const char *modules[] = {
    "mod_signal.so",
#if 0
    "mod_demo_timeout.so",
    "mod_demo_async.so",
    "mod_demo_sock.so",
#endif
    "mod_server.so",
    "mod_io.so",
    "mod_mq.so",
    "mod_db.so",
    "mod_piper.so",
};

int main(void)
{
    evl_module_init("main");
    evl_init();

    if (config_resolve("main", main_cfg_map, num_elem(main_cfg_map))) {
        exit(EXIT_FAILURE);
    }

    proc_init(main_cpu);

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
