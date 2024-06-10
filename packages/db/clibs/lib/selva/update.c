/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <string.h>
#include "selva_error.h"
#include "selva.h"
#include "db.h"
#include "fields.h"
#include "update.h"

#define READ_AS(TYPE, BUF) \
    ((TYPE){ *(TYPE *)memcpy(&(TYPE){ 0 }, (BUF), sizeof(TYPE)) })

int update(struct SelvaDb *, struct SelvaTypeEntry *type, struct SelvaNode *node, char *buf, size_t len)
{
    struct SelvaNodeSchema *ns = type->ns;

    /* TODO Prealloc fields data? */

    for (size_t i = 0; i < len;) {
        const struct Update *ud = (const struct Update *)(buf + i);
        const struct SelvaFieldSchema *fs;
        int err = 0;

        fs = db_get_fs_by_ns(ns, ud->field);
        switch (fs->type) {
        case SELVA_FIELD_TYPE_NULL:
            /* NOP */
            break;
        case SELVA_FIELD_TYPE_TIMESTAMP:
        case SELVA_FIELD_TYPE_CREATED:
        case SELVA_FIELD_TYPE_UPDATED:
            err = selva_fields_set_number(node, ud->field, READ_AS(uint64_t, ud->value));
            break;
        case SELVA_FIELD_TYPE_NUMBER:
            err = selva_fields_set_number(node, ud->field, READ_AS(double, ud->value));
            break;
        case SELVA_FIELD_TYPE_INTEGER:
            /* TODO */
            break;
        case SELVA_FIELD_TYPE_BOOLEAN:
            /* TODO */
            break;
        case SELVA_FIELD_TYPE_ENUM:
            /* TODO */
            break;
        case SELVA_FIELD_TYPE_STRING:
            /* TODO */
            break;
        case SELVA_FIELD_TYPE_TEXT:
            /* TODO */
            break;
        case SELVA_FIELD_TYPE_REFERENCE:
            /* TODO */
            break;
        case SELVA_FIELD_TYPE_REFERENCES:
            /* TODO */
            break;
        }
        if (err) {
            return err;
        }

        i += ud->size;
    }

    return 0;
}
