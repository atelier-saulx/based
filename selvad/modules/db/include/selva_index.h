/*
 * Copyright (c) 2021-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include "traversal.h"

struct SelvaHierarchy;
struct SelvaIndexControlBlock;
struct SelvaSet;
struct indexing_timer_args;
struct selva_string;

/**
 * Initialize a new indexing subsystem instance for hierarchy.
 */
void SelvaIndex_Init(struct SelvaHierarchy *hierarchy);

/**
 * Deinit the indexing subsystem instance initialized for hierarchy.
 */
void SelvaIndex_Deinit(struct SelvaHierarchy *hierarchy);

size_t SelvaIndex_IcbCard(const struct SelvaIndexControlBlock *icb);

/**
 * Check if an index exists for this query, update it, and get the indexing result set.
 * Any selva_strings passed as arguments can be freed after the call.
 * @param order Set to other than SELVA_RESULT_ORDER_NONE if the index should be sorted.
 * @param order_field Should be non-NULL only if the index should be sorted.
 * @param out is a SelvaSet of node_ids indexed for given clause.
 */
int SelvaIndex_Auto(
        struct SelvaHierarchy *hierarchy,
        enum SelvaTraversal dir, const char *dir_opt_str, size_t dir_opt_len,
        const Selva_NodeId node_id,
        enum SelvaResultOrder order,
        struct selva_string *order_field,
        struct selva_string *filter,
        struct SelvaIndexControlBlock **icb_out)
    __attribute__((access(read_only, 3, 4), access(read_only, 5), access(write_only, 9)));

int SelvaIndex_AutoMulti(
        struct SelvaHierarchy *hierarchy,
        enum SelvaTraversal dir, const char *dir_opt_str, size_t dir_opt_len,
        const Selva_NodeId node_id,
        enum SelvaResultOrder order,
        struct selva_string *order_field,
        size_t nr_index_hints,
        struct selva_string *index_hints[static restrict nr_index_hints],
        struct SelvaIndexControlBlock *ind_icb_out[static restrict nr_index_hints])
    __attribute__((access(read_only, 3, 4), access(read_only, 5), access(read_only, 9, 8), access(write_only, 10, 8)));

/**
 * Check whether an ICB is created as an ordered.
 * This function doesn't check whether the index is actually valid.
 */
int SelvaIndex_IsOrdered(
        struct SelvaIndexControlBlock *icb,
        enum SelvaResultOrder order,
        struct selva_string *order_field);

int SelvaIndex_Traverse(
        struct SelvaHierarchy *hierarchy,
        struct SelvaIndexControlBlock *icb,
        SelvaHierarchyNodeCallback node_cb,
        void *node_arg);

/**
 * Update indexing accounting.
 * @param acc_take is the number of nodes taken from the original set.
 * @param acc_tot is the total number of nodes in the original set.
 */
void SelvaIndex_Acc(
        struct SelvaIndexControlBlock * restrict icb,
        size_t acc_take,
        size_t acc_tot);
void SelvaIndex_AccMulti(
        struct SelvaIndexControlBlock *ind_icb[],
        size_t nr_index_hints,
        int ind_select,
        size_t acc_take,
        size_t acc_tot);
