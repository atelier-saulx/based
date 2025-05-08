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

void colvec_init_te(struct SelvaTypeEntry *te);
void colvec_deinit_te(struct SelvaTypeEntry *te);
void *colvec_init_slab(struct SelvaColvec *colvec, block_id_t block_i);
void colvec_init_node(struct SelvaTypeEntry *te, struct SelvaNode *node);

SELVA_EXPORT
struct SelvaColvec *colvec_get(struct SelvaTypeEntry *te, const struct SelvaFieldSchema *fs);

SELVA_EXPORT
void *colvec_get_single(struct SelvaTypeEntry *te, node_id_t node_id, const struct SelvaFieldSchema *fs);

void colvec_hash_update(struct SelvaTypeEntry *te, node_id_t node_id, struct SelvaColvec *colvec, selva_hash_state_t *hash_state);

SELVA_EXPORT
void colvec_set_vec(struct SelvaTypeEntry *te, node_id_t node_id, const struct SelvaFieldSchema *fs, const void *vec);


SELVA_EXPORT
int colvec_foreach(struct SelvaTypeEntry *te, const struct SelvaFieldSchema *fs, node_id_t start, uint32_t len, void (*cb)(node_id_t node_id, void *vec, void *arg), void *arg);
