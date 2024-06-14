/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stdio.h> /* TODO remove */
#include <string.h>
#include "selva_error.h"
#include "selva.h"
#include "db.h"
#include "fields.h"
#include "update.h"

int update(struct SelvaDb *, struct SelvaTypeEntry *type, struct SelvaNode *node, const char *buf, size_t len)
{
    struct SelvaNodeSchema *ns = &type->ns;

    /* TODO Prealloc fields data? */

    for (size_t i = 0; i < len;) {
        struct Update ud;
        const struct SelvaFieldSchema *fs;
        const void *value = buf + i + sizeof(struct Update);
        int err = 0;

        memcpy(&ud, buf + i, sizeof(struct Update));
        fs = db_get_fs_by_ns(ns, ud.field);
        if (!fs) {
            /* FIXME REMOVE log */
            printf("No type for field %d\n", ud.field);
            return SELVA_EINTYPE;
        }

        err = selva_fields_set(node, ud.field, fs->type, value, selva_field_data_size[fs->type]);
        if (err) {
            return err;
        }

        i += ud.len;
    }

    return 0;
}
