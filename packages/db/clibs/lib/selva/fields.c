/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <stdio.h> /* TODO REMOVE */
#include <string.h>
#include "jemalloc.h"
#include "util/align.h"
#include "util/selva_string.h"
#include "selva_error.h"
#include "selva.h"
#include "db.h"
#include "fields.h"

struct SelvaNodeReference {
    struct SelvaNode *dst;
    struct SelvaFields *edge_value; /* TODO */
};

struct SelvaNodeReferences { /* TODO */
    size_t len;
    struct SelvaNodeReference *refs;
};

const size_t selva_field_data_size[15] = {
    [SELVA_FIELD_TYPE_NULL] = 0,
    [SELVA_FIELD_TYPE_TIMESTAMP] = sizeof(int64_t), // time_t
    [SELVA_FIELD_TYPE_CREATED] = sizeof(int64_t),
    [SELVA_FIELD_TYPE_UPDATED] = sizeof(int64_t),
    [SELVA_FIELD_TYPE_NUMBER] = sizeof(double),
    [SELVA_FIELD_TYPE_INTEGER] = sizeof(int32_t),
    [SELVA_FIELD_TYPE_UINT8] = sizeof(uint8_t),
    [SELVA_FIELD_TYPE_UINT32] = sizeof(uint32_t),
    [SELVA_FIELD_TYPE_UINT64] = sizeof(uint64_t),
    [SELVA_FIELD_TYPE_BOOLEAN] = sizeof(int8_t),
    [SELVA_FIELD_TYPE_ENUM] = sizeof(uint8_t),
    [SELVA_FIELD_TYPE_STRING] = sizeof(struct selva_string *),
    [SELVA_FIELD_TYPE_TEXT] = 0, /* TODO */
    [SELVA_FIELD_TYPE_REFERENCE] = sizeof(struct SelvaNodeReference),
    [SELVA_FIELD_TYPE_REFERENCES] = sizeof(struct SelvaNodeReferences),
};

static inline void *nfo2p(struct SelvaFields *fields, const struct SelvaFieldInfo *nfo)
{
    return (char *)fields->data + (nfo->off << 3);
}

static struct SelvaFieldInfo alloc_block(struct SelvaFields *fields, enum SelvaFieldType type)
{
    size_t off = fields->data_len;
    size_t new_size = ALIGNED_SIZE(off + selva_field_data_size[type], SELVA_FIELDS_DATA_ALIGN);

    /* TODO Handle the rare case where we run out of space that can be reprented by data_len */

    if (!fields->data || selva_sallocx(fields->data, 0) < new_size) {
        fields->data = selva_realloc(fields->data, new_size);
    }
    fields->data_len = new_size;

    assert((off & 0x7) == 0);
    return (struct SelvaFieldInfo){
        .type = type,
        .off = off >> 3,
    };
}

static void set_value_string(struct SelvaFields *fields, struct SelvaFieldInfo *nfo, const char *str, size_t len)
{
    struct selva_string *string = selva_string_create(str, len, 0);

    memcpy(nfo2p(fields, nfo), &string, sizeof(struct selva_string *));
}

/**
 * Write a ref to fields data.
 * Note that this function doesn't touch the destination node.
 */
static int write_ref(struct SelvaNode * restrict node, const struct SelvaFieldSchema *fs, struct SelvaNode * restrict dst)
{
    struct SelvaFields *fields = &node->fields;
    const enum SelvaFieldType type = fs->type;
    const field_t field = fs->field;
    struct SelvaFieldInfo *nfo;

    nfo = &fields->fields_map[field];
    if (nfo->type == SELVA_FIELD_TYPE_NULL) {
        *nfo = alloc_block(fields, type);
    } else if (nfo->type != type) {
        return SELVA_EINVAL;
    }

    memcpy(nfo2p(fields, nfo), (void *)&dst, sizeof(struct SelvaNode *));
    return 0;
}

/**
 * Delete a reference field edge.
 * Clears both ways.
 */
static void remove_reference(const struct SelvaFieldSchema *fs_src, struct SelvaNode * restrict src)
{
    struct SelvaFields *fields_src = &src->fields;
    struct SelvaFieldInfo *nfo_src = &fields_src->fields_map[fs_src->field];
    struct SelvaNode *dst;

    if (nfo_src->type != SELVA_FIELD_TYPE_REFERENCE) {
        /* Nothing to do. */
    }

    memcpy(&dst, nfo2p(fields_src, nfo_src), sizeof(struct SelvaNode *));
    memset(nfo2p(fields_src, nfo_src), 0, sizeof(struct SelvaNode *));

    /*
     * Clear from the other end.
     */
    if (dst) {
        struct SelvaFields *fields_dst = &dst->fields;
        struct SelvaFieldInfo *nfo_dst;

        assert(fs_src->edge_constraint.inverse_field < fields_dst->nr_fields);
        nfo_dst = &fields_dst->fields_map[fs_src->edge_constraint.inverse_field];

        if (nfo_dst->type == SELVA_FIELD_TYPE_REFERENCE) {
            memset(nfo2p(fields_dst, nfo_dst), 0, sizeof(struct SelvaNode *));
        }
    }
}

static int selva_fields_set_reference(struct SelvaDb *db, const struct SelvaFieldSchema *fs_src, struct SelvaNode * restrict src, struct SelvaNode * restrict dst)
{
    struct SelvaTypeEntry *type_dst;
    struct SelvaFieldSchema *fs_dst;
    int err;

    if (src == dst) {
        return SELVA_EINVAL;
    }

    type_dst = db_get_type_by_node(db, dst);
    if (type_dst->type != fs_src->edge_constraint.dst_node_type) {
        return SELVA_EINTYPE; /* TODO Is this the error we want? */
    }

    fs_dst = db_get_fs_by_ns_field(&type_dst->ns, fs_src->edge_constraint.inverse_field);
    if (!fs_dst) {
        return SELVA_EINTYPE;
    }

    /*
     * Remove the previous reference if set.
     */
    remove_reference(fs_src, src);

    err = write_ref(src, fs_src, dst);
    if (err) {
        return 0;
    }

    err = write_ref(dst, fs_dst, src);
    if (err) {
        db_panic("Failed");
    }

    return err;
}

int selva_fields_set(struct SelvaDb *db, struct SelvaNode *node, const struct SelvaFieldSchema *fs, const void *value, size_t len)
{
    struct SelvaFields *fields = &node->fields;
    const enum SelvaFieldType type = fs->type;
    const field_t field = fs->field;
    struct SelvaFieldInfo *nfo;

    nfo = &fields->fields_map[field];
    if (nfo->type == SELVA_FIELD_TYPE_NULL) {
        *nfo = alloc_block(fields, type);
    } else if (nfo->type != type) {
        return SELVA_EINVAL;
    }

    switch (type) {
    case SELVA_FIELD_TYPE_NULL:
        break;
    case SELVA_FIELD_TYPE_TIMESTAMP:
    case SELVA_FIELD_TYPE_CREATED:
    case SELVA_FIELD_TYPE_UPDATED:
    case SELVA_FIELD_TYPE_NUMBER:
    case SELVA_FIELD_TYPE_INTEGER:
    case SELVA_FIELD_TYPE_UINT8:
    case SELVA_FIELD_TYPE_UINT32:
    case SELVA_FIELD_TYPE_UINT64:
    case SELVA_FIELD_TYPE_BOOLEAN:
    case SELVA_FIELD_TYPE_ENUM:
        memcpy(nfo2p(fields, nfo), value, len);
        break;
    case SELVA_FIELD_TYPE_STRING:
        set_value_string(fields, nfo, value, len);
        break;
    case SELVA_FIELD_TYPE_TEXT:
        /* TODO */
        break;
    case SELVA_FIELD_TYPE_REFERENCE:
        return selva_fields_set_reference(db, fs, node, (struct SelvaNode *)value);
    case SELVA_FIELD_TYPE_REFERENCES:
        /* TODO */
        break;
    }

    return 0;
}

int selva_fields_get(struct SelvaNode *node, field_t field, struct SelvaFieldsAny *any)
{
    struct SelvaFields *fields = &node->fields;
    const struct SelvaFieldInfo *nfo;
    void *p;

    if (field >= fields->nr_fields) {
        return SELVA_ENOENT;
    }

    nfo = &fields->fields_map[field];
    any->type = nfo->type;
    p = nfo2p(fields, nfo);

    switch (nfo->type) {
    case SELVA_FIELD_TYPE_NULL:
        any->p = NULL;
        break;
    case SELVA_FIELD_TYPE_TIMESTAMP:
    case SELVA_FIELD_TYPE_CREATED:
    case SELVA_FIELD_TYPE_UPDATED:
        memcpy(&any->timestamp, p, sizeof(any->timestamp));
        break;
    case SELVA_FIELD_TYPE_NUMBER:
        memcpy(&any->number, p, sizeof(any->number));
        break;
    case SELVA_FIELD_TYPE_INTEGER:
        memcpy(&any->integer, p, sizeof(any->integer));
        break;
    case SELVA_FIELD_TYPE_UINT8:
        memcpy(&any->uint8, p, sizeof(any->uint8));
        break;
    case SELVA_FIELD_TYPE_UINT32:
        memcpy(&any->uint32, p, sizeof(any->uint32));
        break;
    case SELVA_FIELD_TYPE_UINT64:
        memcpy(&any->uint64, p, sizeof(any->uint64));
        break;
    case SELVA_FIELD_TYPE_BOOLEAN:
        memcpy(&any->boolean, p, sizeof(any->boolean));
    case SELVA_FIELD_TYPE_ENUM:
        memcpy(&any->enu, p, sizeof(any->enu));
        break;
    case SELVA_FIELD_TYPE_STRING:
        memcpy(&any->string, p, sizeof(struct selva_string *));
        if (!any->string) {
            any->type = SELVA_FIELD_TYPE_NULL;
        }
        break;
    case SELVA_FIELD_TYPE_TEXT:
    case SELVA_FIELD_TYPE_REFERENCE:
    case SELVA_FIELD_TYPE_REFERENCES:
        /* TODO Get var type */
        any->p = NULL;
        break;
    }

    return 0;
}

int selva_field_del(struct SelvaDb *db, struct SelvaNode *node, field_t field)
{
    struct SelvaFields *fields = &node->fields;
    struct SelvaFieldInfo *nfo;

    if (field >= fields->nr_fields) {
        return SELVA_ENOENT;
    }

    nfo = &fields->fields_map[field];

    switch (nfo->type) {
    case SELVA_FIELD_TYPE_NULL:
    case SELVA_FIELD_TYPE_TIMESTAMP:
    case SELVA_FIELD_TYPE_CREATED:
    case SELVA_FIELD_TYPE_UPDATED:
    case SELVA_FIELD_TYPE_NUMBER:
    case SELVA_FIELD_TYPE_INTEGER:
    case SELVA_FIELD_TYPE_UINT8:
    case SELVA_FIELD_TYPE_UINT32:
    case SELVA_FIELD_TYPE_UINT64:
    case SELVA_FIELD_TYPE_BOOLEAN:
    case SELVA_FIELD_TYPE_ENUM:
        /* NOP */
        break;
    case SELVA_FIELD_TYPE_STRING:
        selva_string_free(nfo2p(fields, nfo));
        break;
    case SELVA_FIELD_TYPE_TEXT:
    case SELVA_FIELD_TYPE_REFERENCE:
        do {
            struct SelvaTypeEntry *type = db_get_type_by_node(db, node);
            struct SelvaFieldSchema *fs = db_get_fs_by_ns_field(&type->ns, field);

            remove_reference(fs, node);
        } while (0);
        break;
    case SELVA_FIELD_TYPE_REFERENCES:
        /* TODO Cleanup on del */
        break;
    }

    memset(nfo, 0, sizeof(*nfo));

    return 0;
}

int selva_field_remove_ref(struct SelvaDb *db, struct SelvaNode * restrict node, field_t field, struct SelvaNode * restrict dst)
{
    /* TODO */
    return SELVA_ENOTSUP;
}
