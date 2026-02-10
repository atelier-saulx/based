/*
 * Copyright (c) 2024-2026 SAULX
 * SPDX-License-Identifier: MIT
 *
 * A colvec is a columnar vector field in Selva. Specifically a colvec structure
 * represents a single column of a field. Colvecs are allocated in slabs of size
 * `block_capacity * vec_size`.
 *
 * ```
 * +-slab1--------------------+  +-slab2---------------------+
 * | [node1_f1],[node2_f1],.. |->| [noden_f1],[noden+1_f1],..|
 * +--------------------------+  +---------------------------+
 * ```
 */
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include <sys/mman.h>
#include "selva/types.h"
#include "selva/fields.h"
#include "db.h"
#include "db_panic.h"
#include "selva/colvec.h"

static inline size_t colvec_slab_off(size_t block_capacity, size_t vec_size, node_id_t node_id)
{
    return ((node_id - 1) % block_capacity) * vec_size;
}

void colvec_init_te(struct SelvaTypeEntry *te)
{
    size_t nr_colvecs = te->ns.nr_colvec_fields;
    struct SelvaNodeSchema *ns = &te->ns;
    size_t nr_blocks = te->blocks->len;
    size_t block_capacity = selva_get_block_capacity(te);

    if (nr_colvecs == 0) {
        te->col_fields.colvec = nullptr;
        return;
    }

    te->col_fields.colvec = selva_calloc(nr_colvecs, sizeof(te->col_fields.colvec[0]));

    for (size_t i = 0; i < ns->fields_schema.nr_fields; i++) {
        struct SelvaFieldSchema *fs = &ns->fields_schema.field_schemas[i];

        if (fs->type == SELVA_FIELD_TYPE_COLVEC) {
            size_t ci = fs->colvec.index;
            size_t slab_size = block_capacity * fs->colvec.vec_len * fs->colvec.comp_size;

            assert(ci < ns->nr_colvec_fields);

            te->col_fields.colvec[ci] = (struct SelvaColvec){
                .field = i,
                .vec_size = fs->colvec.vec_len * fs->colvec.comp_size,
                .slab_size = slab_size,
                .v = selva_calloc(nr_blocks, sizeof(void *)),
            };
        }
    }
}

void colvec_deinit_te(struct SelvaTypeEntry *te)
{
    for (size_t i = 0; i < te->ns.nr_colvec_fields; i++) {
        struct SelvaColvec *colvec = &te->col_fields.colvec[i];
        block_id_t blocks_len = te->blocks->len;

        for (size_t j = 0; j < blocks_len; j++) {
            (void)munmap(colvec->v[j], colvec->slab_size);
            colvec->v[j] = nullptr;
        }
    }
    selva_free(te->col_fields.colvec);
}

void *colvec_init_slab(struct SelvaColvec *colvec, block_id_t block_i)
{
    uint8_t *slab = (uint8_t *)colvec->v[block_i];

    if (!slab) {
        const int prot = PROT_READ | PROT_WRITE;
        const int flags = MAP_PRIVATE | MAP_ANONYMOUS;

        slab = mmap(nullptr, colvec->slab_size, prot, flags, -1, 0);
        if (slab == (void *)(-1)) {
            db_panic("Failed to allocate a colvec slab");
        }

        colvec->v[block_i] = slab;
    }

    return slab;
}

void colvec_init_node(struct SelvaTypeEntry *te, struct SelvaNode *node)
{
    block_id_t block_i = selva_node_id2block_i2(te, node->node_id);

    /*
     * Initialize each col field of this node.
     */
    for (size_t i = 0; i < te->ns.nr_colvec_fields; i++) {
        struct SelvaColvec *colvec = &te->col_fields.colvec[i];
        const struct SelvaFieldSchema *fs = get_fs_by_fields_schema_field(&te->ns.fields_schema, colvec->field);
        uint8_t *slab = colvec_init_slab(colvec, block_i);

        assert(fs->type == SELVA_FIELD_TYPE_COLVEC);

        void *vec = slab + colvec_slab_off(selva_get_block_capacity(te), colvec->vec_size, node->node_id);
        if (fs->colvec.default_off > 0) {
            const uint8_t *schema_buf = te->schema_buf;
            const void *default_vec = schema_buf + fs->colvec.default_off;
            memcpy(vec, default_vec, colvec->vec_size);
        } else {
            memset(vec, 0, colvec->vec_size);
        }
    }
}

void colvec_hash_update(struct SelvaTypeEntry *te, node_id_t node_id, struct SelvaColvec *colvec, selva_hash_state_t *hash_state)
{
    uint8_t *slab = (uint8_t *)colvec->v[selva_node_id2block_i2(te, node_id)];

    selva_hash_update(hash_state, slab + colvec_slab_off(selva_get_block_capacity(te), colvec->vec_size, node_id), colvec->vec_size);
}

struct SelvaColvec *colvec_get(struct SelvaTypeEntry *te, const struct SelvaFieldSchema *fs)
{
    return &te->col_fields.colvec[fs->colvec.index];
}

void *colvec_get_vec(struct SelvaTypeEntry *te, node_id_t node_id, const struct SelvaFieldSchema *fs)
{
    struct SelvaColvec *colvec = colvec_get(te, fs);
    uint8_t *slab = (uint8_t *)colvec->v[selva_node_id2block_i2(te, node_id)];

    return slab + colvec_slab_off(selva_get_block_capacity(te), colvec->vec_size, node_id);
}

void colvec_set_vec(struct SelvaTypeEntry *te, node_id_t node_id, const struct SelvaFieldSchema *fs, const void *vec)
{
    assert(fs->type == SELVA_FIELD_TYPE_COLVEC);

    struct SelvaColvec *colvec = &te->col_fields.colvec[fs->colvec.index];
    uint8_t *slab = (uint8_t *)colvec->v[selva_node_id2block_i2(te, node_id)];
    void *dst = slab + colvec_slab_off(selva_get_block_capacity(te), colvec->vec_size, node_id);

    memcpy(dst, vec, colvec->vec_size);
}

int colvec_foreach(struct SelvaTypeEntry *te, const struct SelvaFieldSchema *fs, node_id_t start, uint32_t len, void (*cb)(node_id_t node_id, void *vec, void *arg), void *arg)
{
    struct SelvaColvec *colvec = colvec_get(te, fs);
    uint32_t end = start + len;
    size_t block_capacity = selva_get_block_capacity(te);
    size_t vec_size = colvec->vec_size;

    /*
     * This function is provided more as an example rather than an efficient
     * implementation.
     */
    for (uint32_t i = start; i < end; i++) {
        block_id_t block_i = selva_node_id2block_i2(te, i);
        uint8_t *slab = (uint8_t *)colvec->v[block_i];

        if (!slab) {
            return 0;
        }

        cb(i, slab + colvec_slab_off(block_capacity, vec_size, i), arg);
    }

    return 0;
}
