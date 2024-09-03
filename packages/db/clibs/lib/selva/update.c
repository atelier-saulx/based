/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <string.h>
#include "jemalloc.h"
#include "util/auto_free.h"
#include "selva/fields.h"
#include "selva_error.h"
#include "db.h"
#include "update.h"

int update(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node, const char *buf, size_t len)
{
    struct SelvaNodeSchema *ns = &type->ns;

    for (size_t i = 0; i < len;) {
        struct Update ud;
        const struct SelvaFieldSchema *fs;
        const void *value = buf + i + sizeof(struct Update);
        size_t value_len;
        __selva_autofree void *value_arr = NULL;
        int err = 0;

        memcpy(&ud, buf + i, sizeof(struct Update));
        fs = selva_get_fs_by_ns_field(ns, ud.field);
        if (!fs) {
            return SELVA_EINTYPE;
        }

        if (ud.len == 0 || i + ud.len > len) {
            return SELVA_EINVAL;
        }

        switch (fs->type) {
        case SELVA_FIELD_TYPE_STRING:
            if (ud.len < 5) {
                return SELVA_EINVAL;
            }
            value_len = ud.len - sizeof(ud);
            break;
        case SELVA_FIELD_TYPE_REFERENCE:
            do {
                node_id_t dst_node_id;
                struct SelvaTypeEntry *type;
                struct SelvaNode *dst;

                if (ud.len - 5 != sizeof(dst_node_id)) {
                    return SELVA_EINVAL;
                }

                memcpy(&dst_node_id, value, sizeof(dst_node_id));

                type = selva_get_type_by_index(db, fs->edge_constraint.dst_node_type);
                if (!type) {
                    return SELVA_EINVAL;
                }

                dst = selva_find_node(type, dst_node_id);
                if (!dst) {
                    return SELVA_ENOENT;
                }

                /* Found the destination. */
                value = dst;
                value_len = sizeof(struct SelvaNode *);
            } while (0);
            break;
        case SELVA_FIELD_TYPE_REFERENCES:
            do {
                size_t ids_len = ud.len - sizeof(ud);
                size_t nr_nodes = ids_len / sizeof(node_id_t);
                struct SelvaTypeEntry *type;

                if ((ids_len % sizeof(node_id_t)) != 0) {
                    return SELVA_EINVAL;
                }

                type = selva_get_type_by_index(db, fs->edge_constraint.dst_node_type);
                if (!type) {
                    return SELVA_EINVAL;
                }

                value_arr = selva_malloc(nr_nodes * sizeof(struct SelvaNode *));
                for (size_t i = 0; i < nr_nodes; i++) {
                    node_id_t dst_id;
                    struct SelvaNode *dst;

                    memcpy(&dst_id, &((node_id_t *)value)[i], sizeof(dst_id));
                    dst = selva_find_node(type, dst_id);
                    if (!dst) {
                        return SELVA_ENOENT;
                    }

                    ((struct SelvaNode **)value_arr)[i] = dst;
                }
                value = value_arr;
                value_len = nr_nodes * sizeof(struct SelvaNode *);
            } while (0);
            break;
        default:
            value_len = selva_fields_get_data_size(fs);
            if (value_len > ud.len) {
                return SELVA_EINVAL;
            }
            break;
        }

        err = selva_fields_set(db, node, fs, value, value_len);
        if (err) {
            return err;
        }

        i += ud.len;
    }

    return 0;
}

int update_batch(struct SelvaDb *db, struct SelvaTypeEntry *type, const char *buf, size_t len)
{
#if 0
    struct mempool_slab_info slab_info = mempool_slab_info(&type->nodepool);
#endif

    for (size_t i = 0; i < len;) {
        uint32_t ud_len;
        node_id_t node_id;
        struct SelvaNode *node;
        int err;

        memcpy(&ud_len, buf + i + offsetof(struct UpdateBatch, len), sizeof(ud_len));
        memcpy(&node_id, buf + i + offsetof(struct UpdateBatch, node_id), sizeof(node_id));
        node = selva_upsert_node(type, node_id);
        assert(node);
        err = update(db, type, node, buf + i + sizeof(struct UpdateBatch), ud_len - sizeof(struct UpdateBatch));
        if (err) {
            return err;
        }

#if 0
        /*
         * Immediate swap out test.
         */
        if ((node_id % slab_info.nr_objects) == slab_info.nr_objects - 1) {
            //printf("page out\n");
            struct mempool_slab *slab = mempool_get_slab(&type->nodepool, node);
            mempool_pageout(&type->nodepool, slab);
        }
#endif

        i += ud_len;
    }

    return 0;
}
