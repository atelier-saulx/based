/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <stdio.h> /* TODO remove */
#include <string.h>
#include "selva_error.h"
#include "selva.h"
#include "db.h"
#include "fields.h"
#include "update.h"

int update(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node, const char *buf, size_t len)
{
    struct SelvaNodeSchema *ns = &type->ns;

    /* TODO Prealloc fields data? */

    for (size_t i = 0; i < len;) {
        struct Update ud;
        const struct SelvaFieldSchema *fs;
        const void *value = buf + i + sizeof(struct Update);
        size_t value_len;
        int err = 0;

        memcpy(&ud, buf + i, sizeof(struct Update));
        fs = db_get_fs_by_ns_field(ns, ud.field);
        if (!fs) {
            return SELVA_EINTYPE;
        }

        switch (fs->type) {
        case SELVA_FIELD_TYPE_STRING:
            value_len = ud.len - 5;
            break;
        default:
            value_len = selva_field_data_size[fs->type];
            break;
        }
        /* TODO check ud.len vs selva_field_data_size */

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
    for (size_t i = 0; i < len;) {
        uint32_t ud_len;
        node_id_t node_id;
        struct SelvaNode *node;
        int err;

        memcpy(&ud_len, buf + i + offsetof(struct UpdateBatch, len), sizeof(ud_len));
        memcpy(&node_id, buf + i + offsetof(struct UpdateBatch, node_id), sizeof(node_id));
        node = db_get_node(db, type, node_id, true);
        assert(node);
        err = update(db, type, node, buf + i + sizeof(struct UpdateBatch), ud_len - sizeof(struct UpdateBatch));
        if (err) {
            return err;
        }

        i += ud_len;
    }

    return 0;
}
