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

/**
 * The schema types as known by the client.
 * TODO We cold use enum SelvaFieldType if these types would agree.
 */
enum schemabuf_type {
    SCHEMA_TIMESTAMP = 1,
    SCHEMA_CREATED = 2,
    SCHEMA_UPDATED = 3,
    SCHEMA_NUMBER = 4,
    SCHEMA_INTEGER = 5,
    SCHEMA_BOOLEAN = 6,
    SCHEMA_REFERENCE = 7,
    SCHEMA_ENUM = 8,
    SCHEMA_STRING = 9,
    SCHEMA_REFERENCES = 10,
} __packed type;

static int type2fs_reserved(struct SelvaFieldSchema *, enum schemabuf_type, field_t)
{
    return SELVA_EINTYPE;
}

static int type2fs_timestamp(struct SelvaFieldSchema *fs, enum schemabuf_type, field_t field)
{
    *fs = (struct SelvaFieldSchema){
        .field_index = field,
        .type = SELVA_FIELD_TYPE_TIMESTAMP,
    };
    static_assert(sizeof(time_t) == sizeof(int64_t));

    return 0;
}

static int type2fs_number(struct SelvaFieldSchema *fs, enum schemabuf_type, field_t field)
{
    *fs = (struct SelvaFieldSchema){
        .field_index = field,
        .type = SELVA_FIELD_TYPE_NUMBER,
    };

    return 0;
}

static int type2fs_integer(struct SelvaFieldSchema *fs, enum schemabuf_type, field_t field)
{
    *fs = (struct SelvaFieldSchema){
        .field_index = field,
        .type = SELVA_FIELD_TYPE_INTEGER,
    };

    return 0;
}

static int type2fs_boolean(struct SelvaFieldSchema *fs, enum schemabuf_type, field_t field)
{
    *fs = (struct SelvaFieldSchema){
        .field_index = field,
        .type = SELVA_FIELD_TYPE_BOOLEAN,
    };

    return 0;
}

static int type2fs_reference(struct SelvaFieldSchema *fs, enum schemabuf_type, field_t field)
{
    *fs = (struct SelvaFieldSchema){
        .field_index = field,
        .type = SELVA_FIELD_TYPE_REFERENCE,
    };

    return 0;
}

static int type2fs_enum(struct SelvaFieldSchema *fs, enum schemabuf_type, field_t field)
{
    *fs = (struct SelvaFieldSchema){
        .field_index = field,
        .type = SELVA_FIELD_TYPE_ENUM,
    };

    return 0;
}

static int type2fs_string(struct SelvaFieldSchema *fs, enum schemabuf_type, field_t field)
{
    *fs = (struct SelvaFieldSchema){
        .field_index = field,
        .type = SELVA_FIELD_TYPE_STRING,
    };

    return 0;
}

static int type2fs_references(struct SelvaFieldSchema *fs, enum schemabuf_type, field_t field)
{
    *fs = (struct SelvaFieldSchema){
        .field_index = field,
        .type = SELVA_FIELD_TYPE_REFERENCES,
    };

    return 0;
}

static struct schemabuf_parser {
    enum schemabuf_type __packed type;
    char name[11];
    int (*type2fs)(struct SelvaFieldSchema *fs, enum schemabuf_type, field_t field_idx);
} __designated_init schemabuf_parsers[] = {
    {
        .type = 0,
        .name = "reserved",
        .type2fs = type2fs_reserved,
    },
    {
        .type = SCHEMA_TIMESTAMP,
        .name = "timestamp",
        .type2fs = type2fs_timestamp,
    },
    {
        .type = SCHEMA_CREATED,
        .name = "created",
        .type2fs = type2fs_timestamp,
    },
    {
        .type = SCHEMA_UPDATED,
        .name = "updated",
        .type2fs = type2fs_timestamp,
    },
    {
        .type = SCHEMA_NUMBER,
        .name = "number",
        .type2fs = type2fs_number,
    },
    {
        .type = SCHEMA_INTEGER,
        .name = "integer",
        .type2fs = type2fs_integer,
    },
    {
        .type = SCHEMA_BOOLEAN,
        .name = "boolean",
        .type2fs = type2fs_boolean,
    },
    {
        .type = SCHEMA_REFERENCE,
        .name = "reference",
        .type2fs = type2fs_reference,
    },
    {
        .type = SCHEMA_ENUM,
        .name = "enum",
        .type2fs = type2fs_enum,
    },
    {
        .type = SCHEMA_STRING,
        .name = "string",
        .type2fs = type2fs_string,
    },
    {
        .type = SCHEMA_REFERENCES,
        .name = "references",
        .type2fs = type2fs_references,
    },
};

int schemabuf_count_fields(struct fields_count *count, const char *buf, size_t len)
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
    for (size_t i = 1; i < len; i++) {
        struct SelvaFieldSchema *fs = &ns->field_schemas[field_idx];
        enum schemabuf_type field_type = buf[i];

        if ((size_t)field_type >= num_elem(schemabuf_parsers)) {
            return SELVA_EINTYPE;
        }

        schemabuf_parsers[field_type].type2fs(fs, field_type, field_idx);

        switch (field_type) {
        case SCHEMA_CREATED:
            ns->created_field = field_idx;
            break;
        case SCHEMA_UPDATED:
            ns->updated_field = field_idx;
            break;
        default:
            break;
        }

        field_idx++;
    }

    /*
     * TODO Parse edge constraints.
     */
#if 0
    Edge_InitEdgeFieldConstraints(&ns->efc);
    for (size_t i = 0; i < cs.edge_constraints_len; i += sizeof(struct EdgeFieldDynConstraintParams)) {
        int err;

        err = Edge_NewDynConstraint(&ns->efc, (const struct EdgeFieldDynConstraintParams *)(cs.edge_constraints_str + i));
        if (err) {
            return SELVA_EINVAL;
        }
    }
#endif

    return 0;
}

#if 0
void SelvaSchema_Destroy(struct SelvaHierarchy *hierarchy)
{
    selva_free(hierarchy->types);
    destroy_schema(hierarchy->schema);
    hierarchy->types = NULL;
    hierarchy->schema = NULL;
}

int SelvaSchema_Load(struct selva_io *io, int encver, struct SelvaHierarchy *hierarchy)
{
    size_t nr_types = selva_io_load_unsigned(io);

    const char *types = selva_io_load_str(io, NULL);
    struct SelvaSchema *schema = alloc_schema(nr_types);

    for (size_t i = 0; i < nr_types; i++) {
        struct SelvaNodeSchema *ns = &schema->node[i];
        int err;

        ns->nr_emb_fields = selva_io_load_unsigned(io);
        selva_io_load_str_fixed(io, ns->created_field, SELVA_SHORT_FIELD_NAME_LEN);
        selva_io_load_str_fixed(io, ns->updated_field, SELVA_SHORT_FIELD_NAME_LEN);

        err = EdgeConstraint_Load(io, encver, &ns->efc);
        if (err) {
            return err;
        }
    }

    SelvaSchema_Destroy(hierarchy);
    hierarchy->types = (char *)types;
    hierarchy->schema = schema;

    return 0;
}

void SelvaSchema_Save(struct selva_io *io, struct SelvaHierarchy *hierarchy)
{
    const struct SelvaSchema *schema = hierarchy->schema;
    const struct SelvaNodeSchema *nodes = schema->node;

    selva_io_save_unsigned(io, schema->count);
    selva_io_save_str(io, hierarchy->types, (schema->count + 1) * SELVA_NODE_TYPE_SIZE);

    for (size_t i = 0; i < schema->count; i++) {
        const struct SelvaNodeSchema *ns = &nodes[i];

        selva_io_save_unsigned(io, ns->nr_emb_fields);
        selva_io_save_str(io, ns->created_field, SELVA_SHORT_FIELD_NAME_LEN);
        selva_io_save_str(io, ns->updated_field, SELVA_SHORT_FIELD_NAME_LEN);
        EdgeConstraint_Save(io, &ns->efc);
    }
}
#endif
