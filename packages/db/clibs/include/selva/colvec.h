/*
 * Copyright (c) 2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma once

#include <stddef.h>
#include <stdint.h>
#include "selva/types.h"
#include "selva/selva_hash128.h"
#include "selva/_export.h"

struct SelvaColvec {
    field_t field;
    uint16_t vec_size;
    size_t slab_size; /* Size of each slab in v. */

    /**
     * Array of pointers to vector slabs.
     * te->blocks->len number of pointers to vector blocks each containing
     * te->blocks->block_capacity vectors.
     */
    void **v;
};

/**
 * Initialize colvec record keeping under te->col_fields.
 */
void colvec_init_te(struct SelvaTypeEntry *te);

/**
 * Deinitialize colvec record keeping and col slabs under te->col_fields.
 */
void colvec_deinit_te(struct SelvaTypeEntry *te);

/**
 * Initialize a slab at block_i if not already Initialized.
 */
void *colvec_init_slab(struct SelvaColvec *colvec, block_id_t block_i);

/**
 * Initialize all columnar fields of node.
 * This function will also initialize the slab(s) if it's not allocated.
 */
void colvec_init_node(struct SelvaTypeEntry *te, struct SelvaNode *node);

/**
 * Compute the hash for a node_id in colvec.
 */
void colvec_hash_update(struct SelvaTypeEntry *te, node_id_t node_id, struct SelvaColvec *colvec, selva_hash_state_t *hash_state);

/**
 * Get the whole column for fs.
 */
SELVA_EXPORT
struct SelvaColvec *colvec_get(struct SelvaTypeEntry *te, const struct SelvaFieldSchema *fs);

/**
 * Get a single vector in a colvec field by node_id.
 */
SELVA_EXPORT
void *colvec_get_vec(struct SelvaTypeEntry *te, node_id_t node_id, const struct SelvaFieldSchema *fs);

/**
 * Set a single vector in a colvec field.
 */
SELVA_EXPORT
void colvec_set_vec(struct SelvaTypeEntry *te, node_id_t node_id, const struct SelvaFieldSchema *fs, const void *vec);

SELVA_EXPORT
int colvec_foreach(struct SelvaTypeEntry *te, const struct SelvaFieldSchema *fs, node_id_t start, uint32_t len, void (*cb)(node_id_t node_id, void *vec, void *arg), void *arg);
