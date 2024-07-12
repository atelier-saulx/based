/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include <sys/types.h>
#include "jemalloc.h"
#include "util/endian.h"
#include "selva_error.h"
#include "selva_proto.h"
#include "selva.h"
#include "schema.h"

static int type2fs_reserved(struct SelvaNodeSchema *, const char *, size_t, enum SelvaFieldType, field_t)
{
    return SELVA_EINTYPE;
}

static int type2fs_timestamp(struct SelvaNodeSchema *ns, const char *, size_t, enum SelvaFieldType field_type, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_TIMESTAMP,
    };
    static_assert(sizeof(time_t) == sizeof(int64_t));

    switch (field_type) {
    case SELVA_FIELD_TYPE_CREATED:
        ns->created_field = field;
        break;
    case SELVA_FIELD_TYPE_UPDATED:
        ns->updated_field = field;
        break;
    default:
        break;
    }

    return 1;
}

static int type2fs_number(struct SelvaNodeSchema *ns, const char *, size_t, enum SelvaFieldType, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_NUMBER,
    };

    return 1;
}

static int type2fs_integer(struct SelvaNodeSchema *ns, const char *, size_t, enum SelvaFieldType, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_INTEGER,
    };

    return 1;
}

static int type2fs_uint8(struct SelvaNodeSchema *ns, const char *, size_t, enum SelvaFieldType, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_UINT8,
    };

    return 1;
}

static int type2fs_uint32(struct SelvaNodeSchema *ns, const char *, size_t, enum SelvaFieldType, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_UINT32,
    };

    return 1;
}

static int type2fs_uint64(struct SelvaNodeSchema *ns, const char *, size_t, enum SelvaFieldType, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_UINT64,
    };

    return 1;
}

static int type2fs_boolean(struct SelvaNodeSchema *ns, const char *, size_t, enum SelvaFieldType, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_BOOLEAN,
    };

    return 1;
}

static int type2fs_enum(struct SelvaNodeSchema *ns, const char *, size_t, enum SelvaFieldType, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_ENUM,
    };

    return 1;
}

static int type2fs_string(struct SelvaNodeSchema *ns, const char *buf, size_t len, enum SelvaFieldType, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];
    uint8_t fixed_len;

    if (len < 1 + sizeof(fixed_len)) {
        return SELVA_EINVAL;
    }

    memcpy(&fixed_len, buf + 1, sizeof(fixed_len));

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_STRING,
        .string = {
            /*
             * We only allow very short strings to be stored as fixed embedded
             * strings. This is best to be aligned to 64-bit boundaries
             */
            .fixed_len = fixed_len <= 48 ? fixed_len : 0,
        },
    };

    return 1 + sizeof(fixed_len);
}

static int type2fs_reference(struct SelvaNodeSchema *ns, const char *buf, size_t len, enum SelvaFieldType, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];
    struct {
        field_t inverse_field;
        node_type_t dst_node_type;
    } __packed constraints;

    if (len < 1 + sizeof(constraints)) {
        return SELVA_EINVAL;
    }

    memcpy(&constraints, buf + 1, sizeof(constraints));

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_REFERENCE,
        .edge_constraint = {
            .flags = 0,
            .inverse_field = constraints.inverse_field,
            .dst_node_type = constraints.dst_node_type,
        },
    };

    return 1 + sizeof(constraints);
}

static int type2fs_references(struct SelvaNodeSchema *ns, const char *buf, size_t len, enum SelvaFieldType, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];
    struct {
        field_t inverse_field;
        node_type_t dst_node_type;
    } __packed constraints;

    if (len < 1 + sizeof(constraints)) {
        return SELVA_EINVAL;
    }

    memcpy(&constraints, buf + 1, sizeof(constraints));

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_REFERENCES,
        .edge_constraint = {
            .flags = 0,
            .inverse_field = constraints.inverse_field,
            .dst_node_type = constraints.dst_node_type,
        },
    };

    return 1 + sizeof(constraints);
}

static struct schemabuf_parser {
    enum SelvaFieldType __packed type;
    char name[11];
    int (*type2fs)(struct SelvaNodeSchema *fs, const char *buf, size_t len, enum SelvaFieldType, field_t field_idx);
} __designated_init schemabuf_parsers[] = {
    [SELVA_FIELD_TYPE_NULL] = {
        .type = 0,
        .name = "reserved",
        .type2fs = type2fs_reserved,
    },
    [SELVA_FIELD_TYPE_TIMESTAMP] = {
        .type = SELVA_FIELD_TYPE_TIMESTAMP,
        .name = "timestamp",
        .type2fs = type2fs_timestamp,
    },
    [SELVA_FIELD_TYPE_CREATED] = {
        .type = SELVA_FIELD_TYPE_CREATED,
        .name = "created",
        .type2fs = type2fs_timestamp,
    },
    [SELVA_FIELD_TYPE_UPDATED] = {
        .type = SELVA_FIELD_TYPE_UPDATED,
        .name = "updated",
        .type2fs = type2fs_timestamp,
    },
    [SELVA_FIELD_TYPE_NUMBER] = {
        .type = SELVA_FIELD_TYPE_NUMBER,
        .name = "number",
        .type2fs = type2fs_number,
    },
    [SELVA_FIELD_TYPE_INTEGER] = {
        .type = SELVA_FIELD_TYPE_INTEGER,
        .name = "integer",
        .type2fs = type2fs_integer,
    },
    [SELVA_FIELD_TYPE_UINT8] = {
        .type = SELVA_FIELD_TYPE_UINT8,
        .name = "uint8",
        .type2fs = type2fs_uint8,
    },
    [SELVA_FIELD_TYPE_UINT32] = {
        .type = SELVA_FIELD_TYPE_UINT32,
        .name = "uint32",
        .type2fs = type2fs_uint32,
    },
    [SELVA_FIELD_TYPE_UINT64] = {
        .type = SELVA_FIELD_TYPE_UINT64,
        .name = "uint64",
        .type2fs = type2fs_uint64,
    },
    [SELVA_FIELD_TYPE_BOOLEAN] = {
        .type = SELVA_FIELD_TYPE_BOOLEAN,
        .name = "boolean",
        .type2fs = type2fs_boolean,
    },
    [SELVA_FIELD_TYPE_ENUM] = {
        .type = SELVA_FIELD_TYPE_ENUM,
        .name = "enum",
        .type2fs = type2fs_enum,
    },
    [SELVA_FIELD_TYPE_STRING] = {
        .type = SELVA_FIELD_TYPE_STRING,
        .name = "string",
        .type2fs = type2fs_string,
    },
    [SELVA_FIELD_TYPE_REFERENCE] = {
        .type = SELVA_FIELD_TYPE_REFERENCE,
        .name = "reference",
        .type2fs = type2fs_reference,
    },
    [SELVA_FIELD_TYPE_REFERENCES] = {
        .type = SELVA_FIELD_TYPE_REFERENCES,
        .name = "references",
        .type2fs = type2fs_references,
    },
};

int schemabuf_count_fields(struct schema_fields_count *count, const char *buf, size_t len)
{
    if (len < 1) {
        return SELVA_EINVAL;
    }

    count->nr_main_fields = buf[0];
    count->nr_fields = len - 1;

    if (count->nr_main_fields > count->nr_fields) {
        return SELVA_EINVAL;
    }

    return 0;
}

/**
 * ns->nr_fields must be set before calling this function.
 * @param[out] ns
 * @param[out] type
 */
int schemabuf_parse(struct SelvaNodeSchema *ns, const char *buf, size_t len)
{
    if (len == 0) {
        return SELVA_EINVAL;
    }

    if (ns->nr_fields == 0) {
        return SELVA_ENOBUFS;
    }

    field_t field_idx = 0;
    for (size_t i = 1; i < len;) {
        enum SelvaFieldType field_type = buf[i];
        int res;

        if ((size_t)field_type >= num_elem(schemabuf_parsers)) {
            return SELVA_EINTYPE;
        }

        res = schemabuf_parsers[field_type].type2fs(ns, buf + i, len - i, field_type, field_idx);
        if (res < 0) {
            return res;
        }

        i += res;
        field_idx++;
    }

    return 0;
}
