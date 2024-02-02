/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include <dlfcn.h>
#include "jemalloc.h"
#include "libdeflate.h"
#include "linker_set.h"
#include "event_loop.h"
#include "module.h"
#include "selva_error.h"
#include "selva_langs.h"
#include "selva_log.h"
#include "selva_onload.h"
#include "selva_server.h"
#include "selva_io.h"
#include "config.h"
#include "db_config.h"
#include "selva_db.h"
#include "hierarchy.h"

struct selva_glob_config selva_glob_config = {
    .debug_modify_replication_delay_ns = 0,
    .hierarchy_initial_vector_len = 0,
    .hierarchy_expected_resp_len = 5000,
    .hierarchy_compression_level = 6,
    .hierarchy_auto_compress_period_ms = 0,
    .hierarchy_auto_compress_old_age_lim = 100,
    .find_indices_max = 0,
    .find_indexing_threshold = 100,
    .find_indexing_icb_update_interval = 5000,
    .find_indexing_interval = 60000,
    .find_indexing_popularity_ave_period = 216000,
};

static const struct config cfg_map[] = {
    { "DEBUG_MODIFY_REPLICATION_DELAY_NS",      CONFIG_INT,     &selva_glob_config.debug_modify_replication_delay_ns },
    { "HIERARCHY_INITIAL_VECTOR_LEN",           CONFIG_SIZE_T,  &selva_glob_config.hierarchy_initial_vector_len },
    { "HIERARCHY_EXPECTED_RESP_LEN",            CONFIG_SIZE_T,  &selva_glob_config.hierarchy_expected_resp_len },
    { "HIERARCHY_COMPRESSION_LEVEL",            CONFIG_INT,     &selva_glob_config.hierarchy_compression_level },
    { "HIERARCHY_AUTO_COMPRESS_PERIOD_MS",      CONFIG_INT,     &selva_glob_config.hierarchy_auto_compress_period_ms },
    { "HIERARCHY_AUTO_COMPRESS_OLD_AGE_LIM",    CONFIG_INT,     &selva_glob_config.hierarchy_auto_compress_old_age_lim },
    { "FIND_INDICES_MAX",                       CONFIG_INT,     &selva_glob_config.find_indices_max },
    { "FIND_INDEXING_THRESHOLD",                CONFIG_INT,     &selva_glob_config.find_indexing_threshold },
    { "FIND_INDEXING_ICB_UPDATE_INTERVAL",      CONFIG_INT,     &selva_glob_config.find_indexing_icb_update_interval },
    { "FIND_INDEXING_INTERVAL",                 CONFIG_INT,     &selva_glob_config.find_indexing_interval },
    { "FIND_INDEXING_POPULARITY_AVE_PERIOD",    CONFIG_INT,     &selva_glob_config.find_indexing_popularity_ave_period },
};

SET_DECLARE(selva_onload, Selva_Onload);
SET_DECLARE(selva_onunld, Selva_Onunload);

IMPORT() {
    evl_import_main(selva_log);
    evl_import_main(evl_set_timeout);
    evl_import_main(evl_clear_timeout);
    evl_import_main(config_resolve);
    evl_import_main(selva_langs);
    evl_import_event_loop();
    import_selva_server();
    import_selva_io();
}

static bool db_is_ready(void)
{
    return !!main_hierarchy;
}

static int db_load(struct selva_io *io)
{
    struct SelvaHierarchy *tmp_hierarchy = main_hierarchy;

    main_hierarchy = Hierarchy_Load(io);
    if (!main_hierarchy) {
        main_hierarchy = tmp_hierarchy;
        return SELVA_EGENERAL;
    }

    if (tmp_hierarchy) {
        SelvaModify_DestroyHierarchy(tmp_hierarchy);
    }

    return 0;
}

static void db_save(struct selva_io *io)
{
    Hierarchy_Save(io, main_hierarchy);
}

static void db_flush(void)
{
    SelvaModify_DestroyHierarchy(main_hierarchy);
    main_hierarchy = SelvaModify_NewHierarchy();
    if (!main_hierarchy) {
        SELVA_LOG(SELVA_LOGL_CRIT, "Failed to create a new main_hierarchy");
        exit(EXIT_FAILURE);
    }
}

__constructor static void init(void)
{
    int err;
    Selva_Onload **onload_p;

    evl_module_init("db");

    if (config_resolve("db", cfg_map, num_elem(cfg_map))) {
        exit(EXIT_FAILURE);
    }

    SET_FOREACH(onload_p, selva_onload) {
        Selva_Onload *onload = *onload_p;

        err = onload();
        if (err) {
            SELVA_LOG(SELVA_LOGL_CRIT, "Failed to init db: %s",
                      selva_strerror(err));
            exit(EXIT_FAILURE);
        }
    }

    main_hierarchy = SelvaModify_NewHierarchy();
    if (!main_hierarchy) {
        exit(EXIT_FAILURE);
    }

    selva_io_register_serializer(SELVA_IO_ORD_HIERARCHY, &(struct selva_io_serializer){
        .is_ready = db_is_ready,
        .deserialize = db_load,
        .serialize = db_save,
        .flush = db_flush,
    });
}

#if 0
__destructor static void deinit(void) {
    Selva_Onunload **onunload_p;

    SET_FOREACH(onunload_p, selva_onunld) {
        Selva_Onunload *onunload = *onunload_p;

        onunload();
    }
}
#endif
