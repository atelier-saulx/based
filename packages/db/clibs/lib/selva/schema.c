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

static int type2fs_reserved(struct SelvaNodeSchema *, enum SelvaFieldType, field_t)
{
    return SELVA_EINTYPE;
}

static int type2fs_timestamp(struct SelvaNodeSchema *ns, enum SelvaFieldType field_type, field_t field)
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

    return 0;
}

static int type2fs_number(struct SelvaNodeSchema *ns, enum SelvaFieldType, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_NUMBER,
    };

    return 0;
}

static int type2fs_integer(struct SelvaNodeSchema *ns, enum SelvaFieldType, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_INTEGER,
    };

    return 0;
}

static int type2fs_uint8(struct SelvaNodeSchema *ns, enum SelvaFieldType, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_UINT8,
    };

    return 0;
}

static int type2fs_uint32(struct SelvaNodeSchema *ns, enum SelvaFieldType, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_UINT32,
    };

    return 0;
}

static int type2fs_uint64(struct SelvaNodeSchema *ns, enum SelvaFieldType, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_UINT64,
    };

    return 0;
}

static int type2fs_boolean(struct SelvaNodeSchema *ns, enum SelvaFieldType, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_BOOLEAN,
    };

    return 0;
}

static int type2fs_reference(struct SelvaNodeSchema *ns, enum SelvaFieldType, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_REFERENCE,
    };

    return 0;
}

static int type2fs_enum(struct SelvaNodeSchema *ns, enum SelvaFieldType, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_ENUM,
    };

    return 0;
}

static int type2fs_string(struct SelvaNodeSchema *ns, enum SelvaFieldType, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_STRING,
    };

    return 0;
}

static int type2fs_references(struct SelvaNodeSchema *ns, enum SelvaFieldType, field_t field)
{
    struct SelvaFieldSchema *fs = &ns->field_schemas[field];

    *fs = (struct SelvaFieldSchema){
        .field = field,
        .type = SELVA_FIELD_TYPE_REFERENCES,
    };

    return 0;
}

static struct schemabuf_parser {
    enum SelvaFieldType __packed type;
    char name[11];
    int (*type2fs)(struct SelvaNodeSchema *fs, enum SelvaFieldType, field_t field_idx);
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
    for (size_t i = 1; i < len; i++) {
        enum SelvaFieldType field_type = buf[i];

        if ((size_t)field_type >= num_elem(schemabuf_parsers)) {
            return SELVA_EINTYPE;
        }

        schemabuf_parsers[field_type].type2fs(ns, field_type, field_idx);

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
