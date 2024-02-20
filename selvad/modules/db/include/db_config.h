/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once
#ifndef _SELVA_CONFIG_H_
#define _SELVA_CONFIG_H_

/**
 * A structure type of global config params that can be changed at startup.
 * See db.c for the default values of these parameters.
 */
struct selva_glob_config {
    /**
     * Add delay to the replication of the Modify command.
     * Unit is nanoseconds. Normally this should be set to 0.
     */
    int debug_modify_replication_delay_ns;
    /**
     * Initial vector lengths for children and parents lists.
     */
    size_t hierarchy_initial_vector_len;
    /**
     * Expected average length of a find response.
     */
    size_t hierarchy_expected_resp_len;
    /**
     * Compression level used for compressing subtrees.
     * Range: 1 - 12
     */
    int hierarchy_compression_level;
    /**
     * Attempt to compress inactive nodes in-memory.
     * 0 Disables automatic compression.
     */
    int hierarchy_auto_compress_period_ms;
    /**
     * Hierarchy auto compression transaction age limit.
     */
    int hierarchy_auto_compress_old_age_lim;
    /**
     * Maximum number of indices.
     * 0 = disable indexing.
     */
    int index_max;
    /**
     * A candidate for indexing must have at least this many visits per traversal.
     */
    int index_threshold;
    /**
     * [ms] ICB refresh interval.
     */
    int index_icb_update_interval;
    /**
     * How often the set of active indices is decided.
     */
    int index_interval;
    /**
     * [sec] Averaging period for indexing hint demand count. After this period the original value is reduced to 1/e * n.
     */
    int index_popularity_ave_period;
};

extern struct selva_glob_config selva_glob_config;

#endif /* _SELVA_CONFIG_H_ */
