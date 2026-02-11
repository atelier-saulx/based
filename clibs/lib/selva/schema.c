/*
 * Copyright (c) 2024-2026 SAULX
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
#include "selva/fields.h"
#include "selva/selva_string.h"
#include "selva_error.h"
#include "bits.h"
#include "db_panic.h"
#include "db.h"
#include "io.h"
#include "schema.h"

#define SCHEMA_MIN_SIZE                 8
#define SCHEMA_OFF_BLOCK_CAPACITY       0 /*!< u32 */
#define SCHEMA_OFF_NR_FIELDS            4 /*!< u8 */
#define SCHEMA_OFF_NR_FIXED_FIELDS      5 /*!< u8 */
#define SCHEMA_OFF_NR_VIRTUAL_FIELDS    6 /*!< u8 */
#define SCHEMA_OFF_VERSION              7 /*!< u8 */

struct schemabuf_parser_ctx {
    struct SelvaTypeEntry *te;
    const uint8_t *schema_buf; /*!< Original schema buf. */
    const uint8_t *buf; /*!< Current position in the schema buf. */
    size_t len; /*!< Remaining bytes in buf. */
    size_t alias_index;
    size_t colvec_index;
    unsigned version;
};

typedef uint8_t __attribute__((__hardbool__(0, 1))) schema_bool_t;
static_assert(sizeof(schema_bool_t) == 1);

static inline uint32_t calc_default_off(struct schemabuf_parser_ctx *ctx, size_t off)
{
    return (uint32_t)((ptrdiff_t)(ctx->buf - ctx->schema_buf) + off);
}

static int type2fs_reserved(struct schemabuf_parser_ctx *, struct SelvaFieldsSchema *, field_t)
{
    return SELVA_EINTYPE;
}

static int type2fs_micro_buffer(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field)
{
    struct {
        enum SelvaFieldType type;
        uint16_t len;
        schema_bool_t has_default;
    } __packed head;
    size_t off = 0;
    struct SelvaFieldSchema *fs = &schema->field_schemas[field];

    if (ctx->len < sizeof(head)) {
        return SELVA_EINVAL;
    }

    memcpy(&head, ctx->buf + off, sizeof(head));
    off += sizeof(head);

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_MICRO_BUFFER,
        .smb = {
            .len = head.len,
            .default_off = 0,
        },
    };

    if (head.has_default) {
        if (ctx->len < off + head.len) {
            return SELVA_EINVAL;
        }

        /* * Default is copied straight from the schema buffer. */
        fs->smb.default_off = calc_default_off(ctx, off);
        off += head.len;
    }

    return off;
}

static int type2fs_string(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field)
{
    struct {
        enum SelvaFieldType type;
        uint8_t fixed_len;
        uint32_t default_len;
    } __packed head;
    size_t off = 0;
    struct SelvaFieldSchema *fs = &schema->field_schemas[field];

    if (ctx->len < sizeof(head)) {
        return SELVA_EINVAL;
    }

    memcpy(&head, ctx->buf + off, sizeof(head));
    off += sizeof(head);

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_STRING,
        .string = {
            /*
             * We only allow very short strings to be stored as fixed embedded
             * strings. This is best to be aligned to 64-bit boundaries
             */
            .fixed_len = head.fixed_len <= 48 ? head.fixed_len : 0,
            .default_len = head.default_len,
        },
    };

    if (head.default_len > 0) { /* has default */
        if (ctx->len < off + head.default_len) {
            return SELVA_EINVAL;
        }

        /* default is copied straight from the schema buffer. */
        fs->string.default_off = calc_default_off(ctx, off);
        off += head.default_len;
    }

    return off;
}

static int type2fs_text(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field)
{
    struct {
        enum SelvaFieldType type;
        uint8_t nr_defaults;
    } __packed head;
    size_t off = 0;
    struct SelvaFieldSchema *fs = &schema->field_schemas[field];

    if (ctx->len < sizeof(head)) {
        return SELVA_EINVAL;
    }

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_TEXT,
    };

    memcpy(&head, ctx->buf + off, sizeof(head));
    off += sizeof(head);
    fs->text.nr_defaults = head.nr_defaults;

    if (head.nr_defaults > 0) { /* has defaults */
        fs->text.defaults_off = (uint32_t)((ptrdiff_t)(ctx->buf - ctx->schema_buf) + off);

        /*
         * Iterate over the defaults and skip them.
         */
        for (size_t i = 0; i < head.nr_defaults; i++) {
            uint32_t len;

            if (ctx->len < off + sizeof(len)) {
                return SELVA_EINVAL;
            }

            memcpy(&len, ctx->buf + off, sizeof(len));
            off += sizeof(len) + len;
        }
    }

    return off;
}

static int type2fs_refs(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field, enum SelvaFieldType type)
{
    const uint8_t *buf = ctx->buf;
    struct SelvaFieldSchema *fs = &schema->field_schemas[field];
    struct {
        enum SelvaFieldType type;
        enum EdgeFieldConstraintFlag flags;
        node_type_t dst_node_type;
        field_t inverse_field;
        node_type_t edge_node_type;
        uint32_t capped;
    } __packed spec;

    static_assert(sizeof(spec) == 11);

    if (ctx->len < sizeof(spec)) {
        return SELVA_EINVAL;
    }

    memcpy(&spec, buf, sizeof(spec));

    enum EdgeFieldConstraintFlag flags = spec.flags & (EDGE_FIELD_CONSTRAINT_FLAG_DEPENDENT);

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = type,
        .edge_constraint = {
            .flags = flags,
            .inverse_field = spec.inverse_field,
            .dst_node_type = spec.dst_node_type,
            .edge_node_type = spec.edge_node_type,
            .limit = spec.capped,
        },
    };

    return sizeof(spec);
}

static int type2fs_reference(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field)
{
    return type2fs_refs(ctx, schema, field, SELVA_FIELD_TYPE_REFERENCE);
}

static int type2fs_references(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field)
{
    return type2fs_refs(ctx, schema, field, SELVA_FIELD_TYPE_REFERENCES);
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

static int type2fs_colvec(struct schemabuf_parser_ctx *ctx, struct SelvaFieldsSchema *schema, field_t field)
{
    struct SelvaFieldSchema *fs = &schema->field_schemas[field];
    struct {
        enum SelvaFieldType type;
        uint16_t vec_len; /*!< Length of a single vector. */
        uint16_t comp_size; /*!< Component size in the vector. */
        schema_bool_t has_default;
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
            .default_off = (spec.has_default) ? calc_default_off(ctx, sizeof(spec)) : 0,
        },
    };

    return sizeof(spec);
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
    [SELVA_FIELD_TYPE_ALIAS] = {
        .type = SELVA_FIELD_TYPE_ALIAS,
        .type2fs = type2fs_alias,
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

static void make_field_map_template(struct SelvaFieldsSchema *schema)
{
    const size_t nr_fields = schema->nr_fields - schema->nr_virtual_fields;
    const size_t nr_fixed_fields = schema->nr_fixed_fields;
    struct SelvaFieldInfo *nfo = selva_malloc(nr_fields * sizeof(struct SelvaFieldInfo));
    size_t fixed_field_off = 0;

    /*
     * Field order:
     * 1. fixed fields
     * 2. dynamic fields
     * 3. virtual fields
     */
    for (size_t i = 0; i < nr_fixed_fields; i++) {
        const struct SelvaFieldSchema *fs = get_fs_by_fields_schema_field(schema, i);

        assert(fs);

        if ((fixed_field_off & ~(size_t)((((1 << bitsizeof(struct SelvaFieldInfo, off)) - 1) << SELVA_FIELDS_OFF))) != 0) {
            db_panic("Invalid fixed field offset: %zu", fixed_field_off);
        }

        nfo[i] = (struct SelvaFieldInfo){
            .in_use = true,
            .off = fixed_field_off >> SELVA_FIELDS_OFF,
        };

        fixed_field_off += ALIGNED_SIZE(selva_fields_get_data_size(fs), SELVA_FIELDS_DATA_ALIGN);
    }
    for (size_t i = nr_fixed_fields; i < nr_fields; i++) {
        nfo[i] = (struct SelvaFieldInfo){
            .in_use = false,
            .off = 0,
        };
    }

    schema->template.field_map_buf = nfo;
    schema->template.field_map_len = nr_fields * sizeof(struct SelvaFieldInfo);
    schema->template.fixed_data_len = ALIGNED_SIZE(fixed_field_off, SELVA_FIELDS_DATA_ALIGN);
}

static bool has_defaults(struct SelvaFieldsSchema *schema)
{
    const size_t nr_fixed_fields = schema->nr_fixed_fields;

    for (size_t i = 0; i < nr_fixed_fields; i++) {
        const struct SelvaFieldSchema *fs = get_fs_by_fields_schema_field(schema, i);

        if ((fs->type == SELVA_FIELD_TYPE_MICRO_BUFFER && fs->smb.default_off > 0) ||
            (fs->type == SELVA_FIELD_TYPE_STRING && fs->string.default_off > 0) ||
            (fs->type == SELVA_FIELD_TYPE_TEXT && fs->string.default_off > 0)) {
            return true;
        }
    }
    return false;
}

/**
 * Set fixed field defaults.
 * Defaults that are just plain bytes will be set here in the fields
 * template buffer. Defaults that require a dynamic memory allocation per each
 * node must be initialized in fields.c:selva_fields_init().
 */
static void make_fixed_fields_template(struct SelvaFieldsSchema *schema, const uint8_t *schema_buf)
{
    if (has_defaults(schema)) {
        uint8_t *fixed_data_buf = selva_calloc(1, schema->template.fixed_data_len);
        struct SelvaFieldInfo *nfo = schema->template.field_map_buf;
        const size_t nr_fixed_fields = schema->nr_fixed_fields;

        for (size_t i = 0; i < nr_fixed_fields; i++) {
            const struct SelvaFieldSchema *fs = get_fs_by_fields_schema_field(schema, i);
            void *field_data = fixed_data_buf + (nfo[i].off << SELVA_FIELDS_OFF);

            if (fs->type == SELVA_FIELD_TYPE_MICRO_BUFFER && fs->smb.default_off > 0) {
                memcpy(field_data, schema_buf + fs->smb.default_off, fs->smb.len);
            } else if (fs->type == SELVA_FIELD_TYPE_STRING && fs->string.default_off > 0) {
                if (fs->string.fixed_len > 0) { /* Fixed string needs to be copied here. */
                    struct selva_string *s = (struct selva_string *)field_data;
                    const void *default_str = schema_buf + fs->string.default_off;
                    size_t default_len = fs->string.default_len;
                    int err;

                    err = selva_string_init(s, nullptr, fs->string.fixed_len, SELVA_STRING_MUTABLE_FIXED | SELVA_STRING_CRC);
                    if (unlikely(err)) {
                        db_panic("Failed to init string default");
                    }
                    err = selva_string_replace(s, default_str, default_len);
                    if (unlikely(err)) {
                        db_panic("Failed to set string default");
                    }
                } else {
                    /* Handled in selva_fields_init() */
                }
            }
        }

        schema->template.fixed_data_buf = fixed_data_buf;
    } else {
        schema->template.fixed_data_buf = nullptr;
    }
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
            return res;
        }

        i += res;
        field_idx++;
    }

    if (field_idx != fields_schema->nr_fields) {
        return SELVA_EINVAL;
    }

    make_field_map_template(fields_schema);
    make_fixed_fields_template(fields_schema, buf - SCHEMA_MIN_SIZE);

    return 0;
}

/**
 * ns->nr_fields must be set before calling this function.
 * @param[out] ns
 * @param[out] type
 */
int schemabuf_parse_ns(struct SelvaNodeSchema *ns, const uint8_t *buf, size_t len, uint32_t max_version)
{
    struct SelvaFieldsSchema *fields_schema = &ns->fields_schema;
    struct schemabuf_parser_ctx ctx = {
        .schema_buf = buf,
        .te = containerof(ns, struct SelvaTypeEntry, ns),
        .alias_index = 0,
    };

    if (len < SCHEMA_MIN_SIZE) {
        return SELVA_EINVAL;
    }

    /* We just assume that fields_schema is allocated properly. */
    ctx.version = buf[SCHEMA_OFF_VERSION];
    fields_schema->nr_fields = buf[SCHEMA_OFF_NR_FIELDS];
    fields_schema->nr_fixed_fields = buf[SCHEMA_OFF_NR_FIXED_FIELDS];

    if (ctx.version > max_version) {
        /* Can't load a schema created with a newer version. */
        return SELVA_ENOTSUP;
    }

    int err = parse2(&ctx, fields_schema, buf + SCHEMA_MIN_SIZE, len - SCHEMA_MIN_SIZE);
    ns->nr_alias_fields = ctx.alias_index;
    ns->nr_colvec_fields = ctx.colvec_index;

    return err;
}

void schemabuf_deinit_fields_schema(struct SelvaFieldsSchema *schema)
{
    selva_free(schema->template.field_map_buf);
    selva_free(schema->template.fixed_data_buf);
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
