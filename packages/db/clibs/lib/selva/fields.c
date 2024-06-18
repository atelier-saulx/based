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
#include "fields.h"

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
    [SELVA_FIELD_TYPE_REFERENCE] = sizeof(void *),
    [SELVA_FIELD_TYPE_REFERENCES] = sizeof(void *),
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

int selva_fields_set(struct SelvaNode *node, field_t field, enum SelvaFieldType type, const void *value, size_t len)
{
    struct SelvaFields *fields = &node->fields;
    struct SelvaFieldInfo *nfo;

    if (field >= fields->nr_fields) {
        return SELVA_ENOENT;
    }

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
        do {
            struct selva_string *string = selva_string_create(value, len, 0);
            memcpy(nfo2p(fields, nfo), &string, sizeof(struct selva_string *));
        } while (0);
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

    return 0;
}

int selva_fields_set_timestamp(struct SelvaNode *node, field_t field, int64_t value)
{
    return selva_fields_set(node, field, SELVA_FIELD_TYPE_TIMESTAMP, &value, sizeof(value));
}

int selva_fields_set_number(struct SelvaNode *node, field_t field, double value)
{
    return selva_fields_set(node, field, SELVA_FIELD_TYPE_NUMBER, &value, sizeof(value));
}

int selva_fields_set_integer(struct SelvaNode *node, field_t field, int32_t value)
{
    return selva_fields_set(node, field, SELVA_FIELD_TYPE_INTEGER, &value, sizeof(value));
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

int selva_field_del(struct SelvaNode *node, field_t field)
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
    case SELVA_FIELD_TYPE_REFERENCES:
        /* TODO Cleanup on del */
        break;
    }

    memset(nfo, 0, sizeof(*nfo));

    return 0;
}
