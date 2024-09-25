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
#include "db.h"
#include "schema.h"

/*
 * ref_save_map is used to determine which end of Bidirectional references
 * should be marked for save while parsing the schema.
 */
struct ref_save_map_item {
    node_type_t types[2];
    RB_ENTRY(ref_save_map_item) entry;
};

static int ref_save_map_item_cmp(struct ref_save_map_item *a, struct ref_save_map_item *b)
{
    return memcmp(a->types, b->types, sizeof_field(struct ref_save_map_item, types));
}

RB_HEAD(ref_save_map, ref_save_map_item);
RB_GENERATE_STATIC(ref_save_map, ref_save_map_item, entry, ref_save_map_item_cmp)

static bool ref_save_map_insert(struct ref_save_map *map, node_type_t src_type, node_type_t dst_type)
{
    struct ref_save_map_item *item = selva_malloc(sizeof(*item));

    if (src_type < dst_type) {
        item->types[0] = src_type;
        item->types[1] = dst_type;
    } else {
        item->types[0] = dst_type;
        item->types[1] = src_type;
    }

    if (RB_INSERT(ref_save_map, map, item)) {
#if 0
        fprintf(stderr, "%p skippedy %d:%d\n", map, src_type, dst_type);
#endif
        selva_free(item);
        return false;
    }
#if 0
    fprintf(stderr, "%p noskippedy %d:%d\n", map, src_type, dst_type);
#endif
    return true;
}

static void ref_save_map_init(struct ref_save_map *map)
{
    RB_INIT(map);
}

static void ref_save_map_destroy(struct ref_save_map *map)
{
    struct ref_save_map_item *item;
    struct ref_save_map_item *tmp;

    RB_FOREACH_SAFE(item, ref_save_map, map, tmp) {
        selva_free(item);
    }
}

struct schemabuf_parser_ctx {
    struct ref_save_map ref_save_map;
    const char *buf;
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
            .flags = ref_save_map_insert(&ctx->ref_save_map, te->type, constraints.dst_node_type) ? 0 : EDGE_FIELD_CONSTRAINT_FLAG_SKIP_DUMP,
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
            .flags = ref_save_map_insert(&ctx->ref_save_map, te->type, constraints.dst_node_type) ? 0 : EDGE_FIELD_CONSTRAINT_FLAG_SKIP_DUMP,
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

struct schemabuf_parser_ctx *schemabuf_create_ctx(void)
{
    struct schemabuf_parser_ctx *ctx = selva_calloc(1, sizeof(*ctx));

    ref_save_map_init(&ctx->ref_save_map);

    return ctx;
}

void schemabuf_destroy_ctx(struct schemabuf_parser_ctx *ctx)
{
    ref_save_map_destroy(&ctx->ref_save_map);
    selva_free(ctx);
}

/**
 * ns->nr_fields must be set before calling this function.
 * @param[out] ns
 * @param[out] type
 */
int schemabuf_parse(struct schemabuf_parser_ctx *ctx, struct SelvaNodeSchema *ns, const char *buf, size_t len)
{
    int res, err = 0;

    if (len == 0) {
        return SELVA_EINVAL;
    }

    if (ns->nr_fields == 0) {
        return SELVA_ENOBUFS;
    }

    ns->created_field = SELVA_FIELDS_RESERVED;
    ns->updated_field = SELVA_FIELDS_RESERVED;

    field_t field_idx = 0;
    for (size_t i = 1; i < len;) {
        enum SelvaFieldType field_type = buf[i];

        if ((size_t)field_type >= num_elem(schemabuf_parsers)) {
            return SELVA_EINTYPE;
        }

        ctx->buf = buf + i;
        ctx->len = len - i;
        res = schemabuf_parsers[field_type].type2fs(ctx, ns, field_idx);
        if (res < 0) {
            err = res;
            break;
        }

        i += res;
        field_idx++;
    }

    return err;
}
