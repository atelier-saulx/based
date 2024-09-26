/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <stdio.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include <sys/types.h>
#include "jemalloc.h"
#include "tree.h"
#include "util/align.h"
#include "util/endian.h"
#include "selva_error.h"
#include "selva/fields.h"
#include "ref_save_map.h"
#include "db.h"
#include "schema.h"

struct schemabuf_parser_ctx {
    struct ref_save_map *ref_save_map;
    struct SelvaTypeEntry *te;
    const char *buf; /*!< Current position in the schema buf. */
    size_t len;
};

static int parse2efc(struct schemabuf_parser_ctx *ctx, struct EdgeFieldConstraint *efc, const char *buf, size_t len);

static int type2fs_reserved(struct schemabuf_parser_ctx *, struct SelvaFieldsSchema *, field_t)
{
    return SELVA_EINTYPE;
}

static int type2fs_timestamp(struct schemabuf_parser_ctx *, struct SelvaFieldsSchema *schema, field_t field)
{
    struct SelvaFieldSchema *fs = &schema->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_TIMESTAMP,
    };
    static_assert(sizeof(time_t) == sizeof(int64_t));

    return 1;
}

static int type2fs_timestamp_created(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field)
{
    int res;

    res = type2fs_timestamp(ctx, schema, field);

    ctx->te->ns.created_field = field;

    return res;
}

static int type2fs_timestamp_updated(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field)
{
    int res;

    res = type2fs_timestamp(ctx, schema, field);

    ctx->te->ns.updated_field = field;

    return res;
}

static int type2fs_number(struct schemabuf_parser_ctx *, struct SelvaFieldsSchema *schema, field_t field)
{
    struct SelvaFieldSchema *fs = &schema->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_NUMBER,
    };

    return 1;
}

static int type2fs_integer(struct schemabuf_parser_ctx *, struct SelvaFieldsSchema *schema, field_t field)
{
    struct SelvaFieldSchema *fs = &schema->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_INTEGER,
    };

    return 1;
}

static int type2fs_uint8(struct schemabuf_parser_ctx *, struct SelvaFieldsSchema *schema, field_t field)
{
    struct SelvaFieldSchema *fs = &schema->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_UINT8,
    };

    return 1;
}

static int type2fs_uint32(struct schemabuf_parser_ctx *, struct SelvaFieldsSchema *schema, field_t field)
{
    struct SelvaFieldSchema *fs = &schema->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_UINT32,
    };

    return 1;
}

static int type2fs_uint64(struct schemabuf_parser_ctx *, struct SelvaFieldsSchema *schema, field_t field)
{
    struct SelvaFieldSchema *fs = &schema->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_UINT64,
    };

    return 1;
}

static int type2fs_boolean(struct schemabuf_parser_ctx *, struct SelvaFieldsSchema *schema, field_t field)
{
    struct SelvaFieldSchema *fs = &schema->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_BOOLEAN,
    };

    return 1;
}

static int type2fs_enum(struct schemabuf_parser_ctx *, struct SelvaFieldsSchema *schema, field_t field)
{
    struct SelvaFieldSchema *fs = &schema->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_ENUM,
    };

    return 1;
}

static int type2fs_string(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field)
{
    struct SelvaFieldSchema *fs = &schema->field_schemas[field];
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

static int type2fs_refs(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field, enum SelvaFieldType type)
{
    const char *buf = ctx->buf + 1;
    size_t len = ctx->len - 1;
    size_t orig_len = ctx->len;
    struct SelvaFieldSchema *fs = &schema->field_schemas[field];
    struct {
        field_t inverse_field;
        node_type_t dst_node_type;
        uint32_t schema_len;
        /* uint8_t schema[]; */
    } __packed constraints;

    if (len < sizeof(constraints)) {
        return SELVA_EINVAL;
    }

    memcpy(&constraints, buf, sizeof(constraints));
    buf += sizeof(constraints);
    len -= sizeof(constraints);

    if (constraints.schema_len > len) {
        return SELVA_EINVAL;
    }

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = type,
        .edge_constraint = {
            .flags = ref_save_map_insert(ctx->ref_save_map, ctx->te->type, constraints.dst_node_type) ? 0 : EDGE_FIELD_CONSTRAINT_FLAG_SKIP_DUMP,
            .inverse_field = constraints.inverse_field,
            .dst_node_type = constraints.dst_node_type,
        },
    };

    if (constraints.schema_len > 0) {
        int err;

        err = parse2efc(ctx, &fs->edge_constraint, buf, constraints.schema_len);
#if 0
        buf += constraints.schema_len;
#endif
        len -= constraints.schema_len;
        if (err) {
            return err;
        }
    }

    return orig_len - len;
}

static int type2fs_reference(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field)
{
    return type2fs_refs(ctx, schema, field, SELVA_FIELD_TYPE_REFERENCE);
}

static int type2fs_references(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field)
{
    return type2fs_refs(ctx, schema, field, SELVA_FIELD_TYPE_REFERENCES);
}

static int type2fs_micro_buffer(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field)
{
    struct SelvaFieldSchema *fs = &schema->field_schemas[field];
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
    int (*type2fs)(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field_idx);
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

static void make_field_map_template(struct SelvaFieldsSchema *fields_schema)
{
    const size_t nr_fields = fields_schema->nr_fields;
    const size_t nr_fixed_fields = fields_schema->nr_fixed_fields;
    size_t fixed_field_off = 0;
    struct SelvaFieldInfo *nfo = selva_malloc(nr_fields * sizeof(struct SelvaFieldInfo));

    for (size_t i = 0; i < nr_fields; i++) {
        if (i < nr_fixed_fields) {
            struct SelvaFieldSchema *fs = get_fs_by_fields_schema_field(fields_schema, i);

            assert(fs);

            nfo[i] = (struct SelvaFieldInfo){
                .type = fs->type,
                .off = fixed_field_off >> 3,
            };
            fixed_field_off += ALIGNED_SIZE(selva_fields_get_data_size(fs), SELVA_FIELDS_DATA_ALIGN);
        } else {
            nfo[i] = (struct SelvaFieldInfo){
                .type = 0,
                .off = 0,
            };
        }
    }

    fields_schema->field_map_template.buf = nfo;
    fields_schema->field_map_template.len = nr_fields * sizeof(struct SelvaFieldInfo);
    fields_schema->field_map_template.fixed_data_size = ALIGNED_SIZE(fixed_field_off, SELVA_FIELDS_DATA_ALIGN);
}


static int parse2(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *fields_schema, const char *buf, size_t len)
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
        res = schemabuf_parsers[field_type].type2fs(ctx, fields_schema, field_idx);
        if (res < 0) {
            return res;
        }

        i += res;
        field_idx++;
    }

    make_field_map_template(fields_schema);

    return 0;
}

static int parse2efc(struct schemabuf_parser_ctx *ctx, struct EdgeFieldConstraint *efc, const char *buf, size_t len)
{
    struct schema_fields_count count;
    int err;

    err = schemabuf_count_fields(&count, buf, len);
    if (!err && count.nr_fields > 0) {
        efc->fields_schema = selva_calloc(1, sizeof_wflex(struct SelvaFieldsSchema, field_schemas, count.nr_fields));

        err = parse2(ctx, efc->fields_schema, buf, len);
    }

    return err;
}

/**
 * ns->nr_fields must be set before calling this function.
 * @param[out] ns
 * @param[out] type
 */
int schemabuf_parse_ns(struct SelvaDb *db, struct SelvaNodeSchema *ns, struct schema_fields_count *count, const char *buf, size_t len)
{
    struct SelvaFieldsSchema *fields_schema = &ns->fields_schema;
    struct schemabuf_parser_ctx ctx = {
        .ref_save_map = &db->schema.ref_save_map,
        .te = containerof(ns, struct SelvaTypeEntry, ns),
    };

    if (len == 0) {
        return SELVA_EINVAL;
    }

    /* We just assume that fields_schema is allocated properly. */

    fields_schema->nr_fields = count->nr_fields;
    fields_schema->nr_fixed_fields = count->nr_fixed_fields;
    ns->created_field = SELVA_FIELDS_RESERVED;
    ns->updated_field = SELVA_FIELDS_RESERVED;

    return parse2(&ctx, fields_schema, buf, len);
}

void schemabuf_deinit_fields_schema(struct SelvaFieldsSchema *schema)
{
    /* TODO Free fields_schemas in efcs */
    selva_free(schema->field_map_template.buf);
}
