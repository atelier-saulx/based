/*
 * Copyright (c) 2024-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <stdio.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include <sys/types.h>
#include "jemalloc_selva.h"
#include "tree.h"
#include "selva/align.h"
#include "selva/endian.h"
#include "selva_error.h"
#include "selva/fields.h"
#include "bits.h"
#include "db_panic.h"
#include "db.h"
#include "schema.h"

#define SCHEMA_MIN_SIZE                 8
#define SCHEMA_OFF_BLOCK_CAPACITY       0 /*!< u32 */
#define SCHEMA_OFF_NR_FIELDS            4 /*!< u8 */
#define SCHEMA_OFF_NR_FIXED_FIELDS      5 /*!< u8 */
#define SCHEMA_OFF_NR_VIRTUAL_FIELDS    6 /*!< u8 */
#define SCHEMA_OFF_SPARE1               7 /*!< u8 */

struct schemabuf_parser_ctx {
    struct SelvaTypeEntry *te;
    const uint8_t *buf; /*!< Current position in the schema buf. */
    size_t len;
    size_t alias_index;
    size_t colvec_index;
};

static int type2fs_reserved(struct schemabuf_parser_ctx *, struct SelvaFieldsSchema *, field_t)
{
    return SELVA_EINTYPE;
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

static int type2fs_text(struct schemabuf_parser_ctx *, struct SelvaFieldsSchema *schema, field_t field)
{
    struct SelvaFieldSchema *fs = &schema->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_TEXT,
    };

    return 1;
}

static int type2fs_refs(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field, enum SelvaFieldType type)
{
    const uint8_t *buf = ctx->buf;
    size_t len = ctx->len;
    size_t orig_len = ctx->len;
    struct SelvaFieldSchema *fs = &schema->field_schemas[field];
    struct {
        enum SelvaFieldType type;
        enum EdgeFieldConstraintFlag flags;
        node_type_t dst_node_type;
        field_t inverse_field;
        node_type_t meta_node_type;
    } __packed constraints;

    static_assert(sizeof(constraints) == 7);

    if (len < sizeof(constraints)) {
        return SELVA_EINVAL;
    }

    memcpy(&constraints, buf, sizeof(constraints));
    buf += sizeof(constraints);
    len -= sizeof(constraints);

    enum EdgeFieldConstraintFlag flags = constraints.flags & (EDGE_FIELD_CONSTRAINT_FLAG_DEPENDENT | EDGE_FIELD_CONSTRAINT_FLAG_SKIP_DUMP);

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = type,
        .edge_constraint = {
            .flags = flags,
            .inverse_field = constraints.inverse_field,
            .dst_node_type = constraints.dst_node_type,
            .meta_node_type = constraints.meta_node_type,
        },
    };

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

static int type2fs_weak_refs(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field, enum SelvaFieldType type)
{
    struct SelvaFieldSchema *fs = &schema->field_schemas[field];
    struct {
        enum SelvaFieldType type;
        uint8_t spare;
        node_type_t dst_node_type;
        uint8_t pad[5]; /* Reserved for future use. */
    } __packed constraints;

    static_assert(sizeof(constraints) == 9);

    if (ctx->len < sizeof(constraints)) {
        return SELVA_EINVAL;
    }

    memcpy(&constraints, ctx->buf, sizeof(constraints));

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = type,
        .edge_constraint = {
            .dst_node_type = constraints.dst_node_type,
        },
    };

    return sizeof(constraints);
}

static int type2fs_weak_reference(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field)
{
    return type2fs_weak_refs(ctx, schema, field, SELVA_FIELD_TYPE_WEAK_REFERENCE);
}

static int type2fs_weak_references(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field)
{
    return type2fs_weak_refs(ctx, schema, field, SELVA_FIELD_TYPE_WEAK_REFERENCES);
}

static int type2fs_alias(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field)
{
    struct SelvaFieldSchema *fs = &schema->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_ALIAS,
        .alias_index = ctx->alias_index++,
    };

    return 1;
}

static int type2fs_aliases(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field)
{
    struct SelvaFieldSchema *fs = &schema->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_ALIASES,
        .alias_index = ctx->alias_index++,
    };

    return 1;
}

static int type2fs_colvec(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field)
{
    struct SelvaFieldSchema *fs = &schema->field_schemas[field];

    struct {
        enum SelvaFieldType type;
        uint16_t vec_len; /*!< Length of a single vector. */
        uint16_t comp_size; /*!< Component size in the vector. */
    } __packed spec;

    if (ctx->len < sizeof(spec)) {
        return SELVA_EINVAL;
    }

    memcpy(&spec, ctx->buf, sizeof(spec));

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_COLVEC,
        .colvec = {
            .vec_len = spec.vec_len,
            .comp_size = spec.comp_size,
            .index = ctx->colvec_index++,
        },
    };

    return 1 + sizeof(spec);
}

static struct schemabuf_parser {
    enum SelvaFieldType type;
    int (*type2fs)(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field_idx);
} __designated_init schemabuf_parsers[] = {
    [SELVA_FIELD_TYPE_NULL] = {
        .type = 0,
        .type2fs = type2fs_reserved,
    },
    [SELVA_FIELD_TYPE_MICRO_BUFFER] = {
        .type = SELVA_FIELD_TYPE_MICRO_BUFFER,
        .type2fs = type2fs_micro_buffer,
    },
    [SELVA_FIELD_TYPE_STRING] = {
        .type = SELVA_FIELD_TYPE_STRING,
        .type2fs = type2fs_string,
    },
    [SELVA_FIELD_TYPE_TEXT] = {
        .type = SELVA_FIELD_TYPE_TEXT,
        .type2fs = type2fs_text,
    },
    [SELVA_FIELD_TYPE_REFERENCE] = {
        .type = SELVA_FIELD_TYPE_REFERENCE,
        .type2fs = type2fs_reference,
    },
    [SELVA_FIELD_TYPE_REFERENCES] = {
        .type = SELVA_FIELD_TYPE_REFERENCES,
        .type2fs = type2fs_references,
    },
    [SELVA_FIELD_TYPE_WEAK_REFERENCE] = {
        .type = SELVA_FIELD_TYPE_WEAK_REFERENCE,
        .type2fs = type2fs_weak_reference,
    },
    [SELVA_FIELD_TYPE_WEAK_REFERENCES] = {
        .type = SELVA_FIELD_TYPE_WEAK_REFERENCES,
        .type2fs = type2fs_weak_references,
    },
    [SELVA_FIELD_TYPE_ALIAS] = {
        .type = SELVA_FIELD_TYPE_ALIAS,
        .type2fs = type2fs_alias,
    },
    [SELVA_FIELD_TYPE_ALIASES] = {
        .type = SELVA_FIELD_TYPE_ALIASES,
        .type2fs = type2fs_aliases,
    },
    [SELVA_FIELD_TYPE_COLVEC] = {
        .type = SELVA_FIELD_TYPE_COLVEC,
        .type2fs = type2fs_colvec,
    },
};

int schemabuf_get_info(struct schema_info *nfo, const uint8_t *buf, size_t len)
{
    uint32_t block_capacity;

    if (len < SCHEMA_MIN_SIZE) {
        return SELVA_EINVAL;
    }

    memcpy(&block_capacity, buf + SCHEMA_OFF_BLOCK_CAPACITY, sizeof(block_capacity));

    *nfo = (struct schema_info){
        .block_capacity = block_capacity,
        .nr_fields = buf[SCHEMA_OFF_NR_FIELDS],
        .nr_fixed_fields = buf[SCHEMA_OFF_NR_FIXED_FIELDS],
        .nr_virtual_fields = buf[SCHEMA_OFF_NR_VIRTUAL_FIELDS],
    };

    if (nfo->nr_fixed_fields > nfo->nr_fields ||
        nfo->nr_virtual_fields > nfo->nr_fields) {
        return SELVA_EINVAL;
    }

    return 0;
}

static void make_field_map_template(struct SelvaFieldsSchema *fields_schema)
{
    const size_t nr_fields = fields_schema->nr_fields - fields_schema->nr_virtual_fields;
    const size_t nr_fixed_fields = fields_schema->nr_fixed_fields;
    struct SelvaFieldInfo *nfo = selva_malloc(nr_fields * sizeof(struct SelvaFieldInfo));
    size_t fixed_field_off = 0;

    for (size_t i = 0; i < nr_fields; i++) {
        if (i < nr_fixed_fields) {
            const struct SelvaFieldSchema *fs = get_fs_by_fields_schema_field(fields_schema, i);

            assert(fs);

            if ((fixed_field_off & ~(size_t)((((1 << bitsizeof(struct SelvaFieldInfo, off)) - 1) << SELVA_FIELDS_OFF))) != 0) {
                db_panic("Invalid fixed field offset: %zu", fixed_field_off);
            }

            nfo[i] = (struct SelvaFieldInfo){
                .in_use = true,
                .off = fixed_field_off >> SELVA_FIELDS_OFF,
            };
            fixed_field_off += ALIGNED_SIZE(selva_fields_get_data_size(fs), SELVA_FIELDS_DATA_ALIGN);
        } else {
            nfo[i] = (struct SelvaFieldInfo){
                .in_use = false,
                .off = 0,
            };
        }
    }

    fields_schema->field_map_template.buf = nfo;
    fields_schema->field_map_template.len = nr_fields * sizeof(struct SelvaFieldInfo);
    fields_schema->field_map_template.fixed_data_size = ALIGNED_SIZE(fixed_field_off, SELVA_FIELDS_DATA_ALIGN);
}

static int parse2(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *fields_schema, const uint8_t *buf, size_t len)
{
    field_t field_idx = 0;

    for (size_t i = 0; i < len;) {
        enum SelvaFieldType field_type = buf[i];
        int res;

        if ((size_t)field_type >= num_elem(schemabuf_parsers)) {
            return SELVA_EINTYPE;
        }

        ctx->buf = buf + i;
        ctx->len = len - i;
        if (field_idx >= fields_schema->nr_fields) {
            return SELVA_EINVAL;
        }

        res = schemabuf_parsers[field_type].type2fs(ctx, fields_schema, field_idx);
        if (res < 0) {
            /* TODO Potential memory leak */
            return res;
        }

        i += res;
        field_idx++;
    }

    /* TODO Better error handling */
    assert(field_idx == fields_schema->nr_fields);
    make_field_map_template(fields_schema);

    return 0;
}

/**
 * ns->nr_fields must be set before calling this function.
 * @param[out] ns
 * @param[out] type
 */
int schemabuf_parse_ns(struct SelvaNodeSchema *ns, const uint8_t *buf, size_t len)
{
    struct SelvaFieldsSchema *fields_schema = &ns->fields_schema;
    struct schemabuf_parser_ctx ctx = {
        .te = containerof(ns, struct SelvaTypeEntry, ns),
        .alias_index = 0,
    };

    if (len < SCHEMA_MIN_SIZE) {
        return SELVA_EINVAL;
    }

    /* We just assume that fields_schema is allocated properly. */
    fields_schema->nr_fields = buf[SCHEMA_OFF_NR_FIELDS];
    fields_schema->nr_fixed_fields = buf[SCHEMA_OFF_NR_FIXED_FIELDS];

    int err = parse2(&ctx, fields_schema, buf + SCHEMA_MIN_SIZE, len - SCHEMA_MIN_SIZE);
    ns->nr_aliases = ctx.alias_index;
    ns->nr_colvecs = ctx.colvec_index;

    return err;
}

void schemabuf_deinit_fields_schema(struct SelvaFieldsSchema *schema)
{
    selva_free(schema->field_map_template.buf);
}

__constructor static void schemabuf_parsers_init(void)
{
    for (size_t i = 0; i < num_elem(schemabuf_parsers); i++) {
        if (!schemabuf_parsers[i].type2fs) {
            schemabuf_parsers[i] = (struct schemabuf_parser){
                .type = i,
                .type2fs = type2fs_reserved,
            };
        }
    }
}
