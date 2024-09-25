/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stdio.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include <sys/types.h>
#include "jemalloc.h"
#include "tree.h"
#include "util/endian.h"
#include "selva_error.h"
#include "selva/fields.h"
#include "ref_save_map.h"
#include "db.h"
#include "schema.h"

struct schemabuf_parser_ctx {
    struct ref_save_map *ref_save_map;
    const char *buf; /*!< Current position in the schema buf. */
    size_t len;
};

static int type2fs_reserved(struct schemabuf_parser_ctx *, struct SelvaNodeSchema *, field_t)
{
    return SELVA_EINTYPE;
}

static int type2fs_timestamp(struct schemabuf_parser_ctx *, struct SelvaNodeSchema *ns, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_TIMESTAMP,
    };
    static_assert(sizeof(time_t) == sizeof(int64_t));

    return 1;
}

static int type2fs_timestamp_created(struct schemabuf_parser_ctx *ctx, struct SelvaNodeSchema *ns, field_t field)
{
    int res;

    res = type2fs_timestamp(ctx, ns, field);

    ns->created_field = field;

    return res;
}

static int type2fs_timestamp_updated(struct schemabuf_parser_ctx *ctx, struct SelvaNodeSchema *ns, field_t field)
{
    int res;

    res = type2fs_timestamp(ctx, ns, field);

    ns->updated_field = field;

    return res;
}

static int type2fs_number(struct schemabuf_parser_ctx *, struct SelvaNodeSchema *ns, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_NUMBER,
    };

    return 1;
}

static int type2fs_integer(struct schemabuf_parser_ctx *, struct SelvaNodeSchema *ns, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_INTEGER,
    };

    return 1;
}

static int type2fs_uint8(struct schemabuf_parser_ctx *, struct SelvaNodeSchema *ns, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_UINT8,
    };

    return 1;
}

static int type2fs_uint32(struct schemabuf_parser_ctx *, struct SelvaNodeSchema *ns, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_UINT32,
    };

    return 1;
}

static int type2fs_uint64(struct schemabuf_parser_ctx *, struct SelvaNodeSchema *ns, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_UINT64,
    };

    return 1;
}

static int type2fs_boolean(struct schemabuf_parser_ctx *, struct SelvaNodeSchema *ns, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_BOOLEAN,
    };

    return 1;
}

static int type2fs_enum(struct schemabuf_parser_ctx *, struct SelvaNodeSchema *ns, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_ENUM,
    };

    return 1;
}

static int type2fs_string(struct schemabuf_parser_ctx *ctx, struct SelvaNodeSchema *ns, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];
    uint8_t fixed_len;

    if (ctx->len < 1 + sizeof(fixed_len)) {
        return SELVA_EINVAL;
    }

    memcpy(&fixed_len, ctx->buf + 1, sizeof(fixed_len));

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

static int type2fs_reference(struct schemabuf_parser_ctx *ctx, struct SelvaNodeSchema *ns, field_t field)
{
    struct SelvaTypeEntry *te = containerof(ns, struct SelvaTypeEntry, ns);
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];
    struct {
        field_t inverse_field;
        node_type_t dst_node_type;
    } __packed constraints;

    if (ctx->len < 1 + sizeof(constraints)) {
        return SELVA_EINVAL;
    }

    memcpy(&constraints, ctx->buf + 1, sizeof(constraints));

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_REFERENCE,
        .edge_constraint = {
            .flags = ref_save_map_insert(ctx->ref_save_map, te->type, constraints.dst_node_type) ? 0 : EDGE_FIELD_CONSTRAINT_FLAG_SKIP_DUMP,
            .inverse_field = constraints.inverse_field,
            .dst_node_type = constraints.dst_node_type,
        },
    };

    return 1 + sizeof(constraints);
}

static int type2fs_references(struct schemabuf_parser_ctx *ctx, struct SelvaNodeSchema *ns, field_t field)
{
    struct SelvaTypeEntry *te = containerof(ns, struct SelvaTypeEntry, ns);
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];
    struct {
        field_t inverse_field;
        node_type_t dst_node_type;
    } __packed constraints;

    if (ctx->len < 1 + sizeof(constraints)) {
        return SELVA_EINVAL;
    }

    memcpy(&constraints, ctx->buf + 1, sizeof(constraints));

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_REFERENCES,
        .edge_constraint = {
            .flags = ref_save_map_insert(ctx->ref_save_map, te->type, constraints.dst_node_type) ? 0 : EDGE_FIELD_CONSTRAINT_FLAG_SKIP_DUMP,
            .inverse_field = constraints.inverse_field,
            .dst_node_type = constraints.dst_node_type,
        },
    };

    return 1 + sizeof(constraints);
}

static int type2fs_micro_buffer(struct schemabuf_parser_ctx *ctx, struct SelvaNodeSchema *ns, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];
    uint16_t len;

    if (ctx->len < 1 + sizeof(len)) {
        return SELVA_EINVAL;
    }

    memcpy(&len, ctx->buf + 1, sizeof(len));

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_MICRO_BUFFER,
        .smb = {
            .len = len,
        },
    };

    return 1 + sizeof(len);
}

static struct schemabuf_parser {
    enum SelvaFieldType type;
    int (*type2fs)(struct schemabuf_parser_ctx *ctx, struct SelvaNodeSchema *fs, field_t field_idx);
} __designated_init schemabuf_parsers[] = {
    [SELVA_FIELD_TYPE_NULL] = {
        .type = 0,
        .type2fs = type2fs_reserved,
    },
    [SELVA_FIELD_TYPE_TIMESTAMP] = {
        .type = SELVA_FIELD_TYPE_TIMESTAMP,
        .type2fs = type2fs_timestamp,
    },
    [SELVA_FIELD_TYPE_CREATED] = {
        .type = SELVA_FIELD_TYPE_CREATED,
        .type2fs = type2fs_timestamp_created,
    },
    [SELVA_FIELD_TYPE_UPDATED] = {
        .type = SELVA_FIELD_TYPE_UPDATED,
        .type2fs = type2fs_timestamp_updated,
    },
    [SELVA_FIELD_TYPE_NUMBER] = {
        .type = SELVA_FIELD_TYPE_NUMBER,
        .type2fs = type2fs_number,
    },
    [SELVA_FIELD_TYPE_INTEGER] = {
        .type = SELVA_FIELD_TYPE_INTEGER,
        .type2fs = type2fs_integer,
    },
    [SELVA_FIELD_TYPE_UINT8] = {
        .type = SELVA_FIELD_TYPE_UINT8,
        .type2fs = type2fs_uint8,
    },
    [SELVA_FIELD_TYPE_UINT32] = {
        .type = SELVA_FIELD_TYPE_UINT32,
        .type2fs = type2fs_uint32,
    },
    [SELVA_FIELD_TYPE_UINT64] = {
        .type = SELVA_FIELD_TYPE_UINT64,
        .type2fs = type2fs_uint64,
    },
    [SELVA_FIELD_TYPE_BOOLEAN] = {
        .type = SELVA_FIELD_TYPE_BOOLEAN,
        .type2fs = type2fs_boolean,
    },
    [SELVA_FIELD_TYPE_ENUM] = {
        .type = SELVA_FIELD_TYPE_ENUM,
        .type2fs = type2fs_enum,
    },
    [SELVA_FIELD_TYPE_STRING] = {
        .type = SELVA_FIELD_TYPE_STRING,
        .type2fs = type2fs_string,
    },
    [SELVA_FIELD_TYPE_REFERENCE] = {
        .type = SELVA_FIELD_TYPE_REFERENCE,
        .type2fs = type2fs_reference,
    },
    [SELVA_FIELD_TYPE_REFERENCES] = {
        .type = SELVA_FIELD_TYPE_REFERENCES,
        .type2fs = type2fs_references,
    },
    [SELVA_FIELD_TYPE_MICRO_BUFFER] = {
        .type = SELVA_FIELD_TYPE_MICRO_BUFFER,
        .type2fs = type2fs_micro_buffer,
    },
};

int schemabuf_count_fields(struct schema_fields_count *count, const char *buf, size_t len)
{
    if (len < 1) {
        return SELVA_EINVAL;
    }

    count->nr_fixed_fields = buf[0];
    count->nr_fields = len - 1;

    if (count->nr_fixed_fields > count->nr_fields) {
        return SELVA_EINVAL;
    }

    return 0;
}

static int parse2(struct schemabuf_parser_ctx *ctx, struct SelvaNodeSchema *ns, const char *buf, size_t len)
{
    field_t field_idx = 0;

    for (size_t i = 1; i < len;) {
        enum SelvaFieldType field_type = buf[i];
        int res;

        if ((size_t)field_type >= num_elem(schemabuf_parsers)) {
            return SELVA_EINTYPE;
        }

        ctx->buf = buf + i;
        ctx->len = len - i;
        res = schemabuf_parsers[field_type].type2fs(ctx, ns, field_idx);
        if (res < 0) {
            return res;
        }

        i += res;
        field_idx++;
    }

    return 0;
}

/**
 * ns->nr_fields must be set before calling this function.
 * @param[out] ns
 * @param[out] type
 */
int schemabuf_parse_ns(struct SelvaDb *db, struct SelvaNodeSchema *ns, const char *buf, size_t len)
{
    struct schemabuf_parser_ctx ctx = {
        .ref_save_map = &db->schema.ref_save_map,
    };

    if (len == 0) {
        return SELVA_EINVAL;
    }

    if (ns->nr_fields == 0) {
        return SELVA_ENOBUFS;
    }

    ns->created_field = SELVA_FIELDS_RESERVED;
    ns->updated_field = SELVA_FIELDS_RESERVED;

    return parse2(&ctx, ns, buf, len);
}
