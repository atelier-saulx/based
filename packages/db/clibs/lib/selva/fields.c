/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <string.h>
#include "jemalloc.h"
#include "selva_error.h"
#include "selva.h"
#include "fields.h"

static const size_t field_data_size[] = {
    [SELVA_FIELD_TYPE_NULL] = 0,
    [SELVA_FIELD_TYPE_TIMESTAMP] = sizeof(uint64_t),
    [SELVA_FIELD_TYPE_CREATED] = sizeof(uint64_t),
    [SELVA_FIELD_TYPE_UPDATED] = sizeof(uint64_t),
    [SELVA_FIELD_TYPE_NUMBER] = sizeof(double),
    [SELVA_FIELD_TYPE_INTEGER] = sizeof(uint64_t),
    [SELVA_FIELD_TYPE_BOOLEAN] = sizeof(bool),
    [SELVA_FIELD_TYPE_ENUM] = sizeof(uint64_t),
    [SELVA_FIELD_TYPE_STRING] = 0, /* TODO */
    [SELVA_FIELD_TYPE_TEXT] = 0, /* TODO */
    [SELVA_FIELD_TYPE_REFERENCE] = 0, /* TODO */
    [SELVA_FIELD_TYPE_REFERENCES] = 0, /* TODO */
};

int selva_fields_get(struct SelvaNode *node, field_t field, struct SelvaFieldsAny *any)
{
    struct SelvaFields *fields = &node->fields;
    struct SelvaFieldInfo *nfo;
    void *p;

    if (field >= selva_fields_get_nr_fields(fields)) {
        return SELVA_ENOENT;
    }

    nfo = &fields->fields_map[field];
    any->type = nfo->type;
    p = (char *)fields->data + (nfo->off << 3);

    switch (nfo->type) {
    case SELVA_FIELD_TYPE_NULL:
        any->p = NULL;
        break;
    case SELVA_FIELD_TYPE_TIMESTAMP:
    case SELVA_FIELD_TYPE_CREATED:
    case SELVA_FIELD_TYPE_UPDATED:
        memcpy(&any->ll, p, sizeof(any->ll));
        break;
    case SELVA_FIELD_TYPE_NUMBER:
        memcpy(&any->d, p, sizeof(any->d));
        break;
    case SELVA_FIELD_TYPE_INTEGER:
        memcpy(&any->ll, p, sizeof(any->ll));
        break;
    case SELVA_FIELD_TYPE_BOOLEAN:
        memcpy(&any->b, p, sizeof(any->b));
    case SELVA_FIELD_TYPE_ENUM:
        memcpy(&any->ll, p, sizeof(any->ll));
        break;
    case SELVA_FIELD_TYPE_STRING:
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

    if (field <= selva_fields_get_nr_fields(fields)) {
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
    case SELVA_FIELD_TYPE_BOOLEAN:
    case SELVA_FIELD_TYPE_ENUM:
        /* NOP */
        break;
    case SELVA_FIELD_TYPE_STRING:
    case SELVA_FIELD_TYPE_TEXT:
    case SELVA_FIELD_TYPE_REFERENCE:
    case SELVA_FIELD_TYPE_REFERENCES:
        /* TODO Cleanup on del */
        break;
    }

    memset(nfo, 0, sizeof(*nfo));

    return 0;
}

static void prealloc_data(struct SelvaFields *fields, size_t new_size)
{
    fields->data = selva_realloc(fields->data, new_size);
}

static size_t alloc_block(struct SelvaFields *fields, enum SelvaFieldType type)
{
    const size_t off = selva_fields_get_data_len(fields);
    const size_t new_size = off + field_data_size[type];

    if (selva_sallocx(fields->data, 0) < new_size) {
        fields->data = selva_realloc(fields->data, new_size);
    }
    selva_fields_set_data_len(fields, new_size);

    return off;
}

int selva_fields_set_number(struct SelvaNode *node, field_t field, double value)
{
    struct SelvaFields *fields = &node->fields;
    struct SelvaFieldInfo *nfo;

    if (field <= selva_fields_get_nr_fields(fields)) {
        return SELVA_ENOENT;
    }

    nfo = &fields->fields_map[field];
    if (nfo->type == SELVA_FIELD_TYPE_NULL) {
        nfo->type = SELVA_FIELD_TYPE_NUMBER;
        nfo->off = alloc_block(fields, SELVA_FIELD_TYPE_NUMBER);
    }
    assert(nfo->type == SELVA_FIELD_TYPE_NUMBER);

    memcpy(fields->data, &value, sizeof(value));
    return 0;
}
