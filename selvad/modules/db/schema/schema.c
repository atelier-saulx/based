/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/types.h>
#include "jemalloc.h"
#include "util/finalizer.h"
#include "util/selva_string.h"
#include "endian.h"
#include "selva_error.h"
#include "selva_proto.h"
#include "selva_server.h"
#include "selva_io.h"
#include "selva_db.h"
#include "selva_log.h"
#include "selva_onload.h"
#include "hierarchy.h"
#include "schema.h"

/*
 * TODO Type map and type size map
 * TODO Add updated and created types
 * [1, 'timestamp'],
 * [2, 'number'],
 * [3, 'integer'],
 * [4, 'boolean'],
 * [5, 'reference'],
 * [6, 'enum'],
 * [7, 'string'],
 * [8, 'references'],
 *
 * TODO This is the format we are receiving from the client
 * const SIZE_MAP: Partial<Record<BasedSchemaFieldType, number>> = {
 * timestamp: 8, // 64bit
 * // double-precision 64-bit binary format IEEE 754 value
 * number: 8, // 64bit
 * integer: 4, // 32bit Unsigned 4  16bit
 * boolean: 1, // 1bit (6 bits overhead)
 * reference: 4,
 * enum: 4, // enum
 * string: 0, // var length fixed length will be different
 * references: 0,
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
    SCHEMA_REFERENCES = 1,
} __packed type;

static int type2fs_reserved(struct SelvaFieldSchema *, enum schemabuf_type)
{
    return SELVA_EINTYPE;
}

static int type2fs_timestamp(struct SelvaFieldSchema *fs, enum schemabuf_type)
{
    *fs = (struct SelvaFieldSchema){
        .type1 = SELVA_FIELD_SCHEMA_TYPE_DATA,
        .type2 = SELVA_OBJECT_LONGLONG,
    };

    return 0;
}

static int type2fs_number(struct SelvaFieldSchema *fs, enum schemabuf_type)
{
    *fs = (struct SelvaFieldSchema){
        .type1 = SELVA_FIELD_SCHEMA_TYPE_DATA,
        .type2 = SELVA_OBJECT_DOUBLE,
    };

    return 0;
}

static int type2fs_integer(struct SelvaFieldSchema *fs, enum schemabuf_type)
{
    *fs = (struct SelvaFieldSchema){
        .type1 = SELVA_FIELD_SCHEMA_TYPE_DATA,
        .type2 = SELVA_OBJECT_LONGLONG,
    };

    return 0;
}

static int type2fs_boolean(struct SelvaFieldSchema *fs, enum schemabuf_type)
{
    *fs = (struct SelvaFieldSchema){
        .type1 = SELVA_FIELD_SCHEMA_TYPE_DATA,
        .type2 = SELVA_OBJECT_LONGLONG,
    };

    return 0;
}

static int type2fs_reference(struct SelvaFieldSchema *fs, enum schemabuf_type)
{
    *fs = (struct SelvaFieldSchema){
        .type1 = SELVA_FIELD_SCHEMA_TYPE_EDGE,
        .type2 = SELVA_OBJECT_NULL,
    };

    return 0;
}

static int type2fs_enum(struct SelvaFieldSchema *fs, enum schemabuf_type)
{
    *fs = (struct SelvaFieldSchema){
        .type1 = SELVA_FIELD_SCHEMA_TYPE_DATA,
        .type2 = SELVA_OBJECT_LONGLONG,
    };

    return 0;
}

static int type2fs_string(struct SelvaFieldSchema *fs, enum schemabuf_type)
{
    *fs = (struct SelvaFieldSchema){
        .type1 = SELVA_FIELD_SCHEMA_TYPE_DATA,
        .type2 = SELVA_OBJECT_STRING,
    };

    return 0;
}

static int type2fs_references(struct SelvaFieldSchema *fs, enum schemabuf_type)
{
    *fs = (struct SelvaFieldSchema){
        .type1 = SELVA_FIELD_SCHEMA_TYPE_EDGE,
        .type2 = SELVA_OBJECT_NULL,
    };

    return 0;
}

static struct schemabuf_parser {
    enum schemabuf_type __packed type;
    char name[11];
    int (*type2fs)(struct SelvaFieldSchema *fs, enum schemabuf_type);
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

struct fields_count {
    size_t nr_main_fields;
    size_t nr_fields;
};

static int schemabuf_count_fields(struct fields_count *count, const char *buf, size_t size)
{
    bool mf = false;

    if (size < SELVA_NODE_TYPE_SIZE + 1) {
        return SELVA_EINVAL;
    }

    count->nr_main_fields = 0;
    count->nr_fields = 0;

    for (size_t i = 2; i < size; i++) {
        if (buf[i] == '\0') {
            mf = !mf;
        } else {
            if (mf) {
                count->nr_main_fields++;
            }
            count->nr_fields++;
        }
    }

    return 0;
}

static ssize_t find_node_type(const char types[], const Selva_NodeType type)
{
    size_t i = 0;

    while (memcmp(SELVA_NULL_TYPE, types + i, SELVA_NODE_TYPE_SIZE)) {
      if (!memcmp(type, types + i, SELVA_NODE_TYPE_SIZE)) return (ssize_t)(i / SELVA_NODE_TYPE_SIZE);
      i += SELVA_NODE_TYPE_SIZE;
    };

    return -1;
}

struct SelvaNodeSchema *SelvaSchema_FindNodeSchema(struct SelvaHierarchy *hierarchy, const Selva_NodeType type)
{
    ssize_t idx;

    idx = find_node_type(hierarchy->types, type);
    if (idx < 0) {
        /* FIXME We should make sure we verify type before entering here. */
        SELVA_LOG(SELVA_LOGL_CRIT, "Schema not found");
        exit(EXIT_SUCCESS);
    }

    return &hierarchy->schema->node[idx];
}

struct SelvaFieldSchema *SelvaSchema_FindFieldSchema(struct SelvaNodeSchema *ns, char field_name[SELVA_SHORT_FIELD_NAME_LEN])
{
    char buf[SELVA_SHORT_FIELD_NAME_LEN];

    strncpy(buf, field_name, SELVA_SHORT_FIELD_NAME_LEN);
    for (size_t i = 0; i < ns->nr_fields; i++) {
        struct SelvaFieldSchema *fs = &ns->field_schemas[i];

        if (!memcmp(fs->field_name, buf, sizeof(buf))) {
            return fs;
        }
    }

    return NULL;
}

void SelvaSchema_Destroy(struct SelvaSchema *schema)
{
    for (size_t i = 0; i < schema->count; i++) {
        struct SelvaNodeSchema *ns = &schema->node[i];

        selva_free(ns->field_schemas);
        Edge_DeinitEdgeFieldConstraints(&ns->efc);
    }

    selva_free(schema);
}

static char *alloc_types(size_t nr_types)
{
    char *types;

    types = selva_malloc((nr_types + 1) * SELVA_NODE_TYPE_SIZE);

    /*
     * Termination.
     */
    types[nr_types * SELVA_NODE_TYPE_SIZE] = '\0';
    types[nr_types * SELVA_NODE_TYPE_SIZE + 1] = '\0';

    return types;
}

static struct SelvaSchema *alloc_schema(size_t nr_types)
{
    struct SelvaSchema *schema;

    schema = selva_malloc(sizeof(struct SelvaSchema) + nr_types * sizeof(struct SelvaNodeSchema));
    schema->count = nr_types;

    return schema;
}

/**
 * @param[out] ns
 * @param[out] type
 */
static int parse_node_schema(struct SelvaNodeSchema *ns, char type[SELVA_NODE_TYPE_SIZE], const char *buf, size_t len)
{
    struct fields_count counts;
    int err;

    if (len < SELVA_NODE_TYPE_SIZE) {
        return SELVA_EINVAL;
    }

    memcpy(type, buf, SELVA_NODE_TYPE_SIZE);

    err = schemabuf_count_fields(&counts, buf, len);
    if (err) {
        return err;
    }

    *ns = (struct SelvaNodeSchema){
        .nr_emb_fields = counts.nr_main_fields,
        .nr_fields = counts.nr_fields,
        .created_en = false, /* TODO */
        .updated_en = false, /* TODO */
    };

    ns->field_schemas = selva_malloc(counts.nr_fields * sizeof(struct SelvaFieldSchema));

    bool main_fields = false;
    int field_idx = 0;
    for (size_t i = 2; i < len; i++) {
        if (buf[i] == '\0') {
            main_fields = !main_fields;
        } else {
            struct SelvaFieldSchema *fs = &ns->field_schemas[field_idx];
            size_t field_type = buf[i];

            if (field_type >= num_elem(schemabuf_parsers)) {
                return SELVA_EINTYPE;
            }

            schemabuf_parsers[field_type].type2fs(fs, (enum schemabuf_type)field_type);
            snprintf(fs->field_name, SELVA_SHORT_FIELD_NAME_LEN, "%d", field_idx);
            field_idx++;
        }
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

/* TODO New schema must be a super set of old schema or all old nodes must have been deleted. */
static void schema_set(struct selva_server_response_out *resp, const void *buf, size_t len)
{
    struct SelvaHierarchy *hierarchy = main_hierarchy;
    __auto_finalizer struct finalizer fin;
    struct selva_string **argv = NULL;
    int argc;

    finalizer_init(&fin);

    argc = selva_proto_scanf(&fin, buf, len, "...", &argv);
    if (argc < 0) {
        selva_send_errorf(resp, argc, "Failed to parse args");
        return;
    }

    const size_t nr_types = argc;
    char *types = alloc_types(nr_types);
    struct SelvaSchema *schema = alloc_schema(nr_types);

    for (size_t i = 0; i < (size_t)argc; i++) {
        struct SelvaNodeSchema *ns = &schema->node[i];
        size_t cs_len;
        const char *cs_buf = selva_string_to_str(argv[i], &cs_len);
        int err;

        err = parse_node_schema(ns, &types[i * SELVA_NODE_TYPE_SIZE], cs_buf, cs_len);
        if (err) {
            selva_free(types);
            SelvaSchema_Destroy(schema);
            selva_send_errorf(resp, SELVA_EINVAL, "Invalid field_schema at %zu", i);
            return;
        }
    }

    selva_free(hierarchy->types);
    SelvaSchema_Destroy(hierarchy->schema);

    hierarchy->types = types;
    hierarchy->schema = schema;

    selva_io_set_dirty();
    selva_send_ll(resp, 1);
    selva_replication_replicate(selva_resp_to_ts(resp), selva_resp_to_cmd_id(resp), buf, len);
}

static void schema_get(struct selva_server_response_out *resp, const void *buf __unused, size_t len) {
    struct SelvaHierarchy *hierarchy = main_hierarchy;
    const char *types = hierarchy->types;
    const struct SelvaNodeSchema *nodes = hierarchy->schema->node;

    if (len != 0) {
        selva_send_error_arity(resp);
        return;
    }

    size_t i = 0;
    while (memcmp(SELVA_NULL_TYPE, types + i, SELVA_NODE_TYPE_SIZE)) {
        size_t idx = i / SELVA_NODE_TYPE_SIZE;
        selva_send_array(resp, 2 * 5);
        selva_send_str(resp, "type", 4);
        selva_send_str(resp, types + i, SELVA_NODE_TYPE_SIZE);
        selva_send_str(resp, "nr_emb_fields", 13);
        selva_send_ll(resp, nodes[idx].nr_emb_fields);
        selva_send_str(resp, "created_en", 10);
        selva_send_ll(resp, nodes[idx].created_en);
        selva_send_str(resp, "updated_en", 10);
        selva_send_ll(resp, nodes[idx].updated_en);
        selva_send_str(resp, "fields", 6);
        selva_send_array(resp, nodes[idx].nr_fields);
        for (size_t field = 0; field < nodes[idx].nr_fields; field++) {
            selva_send_strf(resp, "%.*s", SELVA_SHORT_FIELD_NAME_LEN, nodes[idx].field_schemas[field].field_name);
        }

        /* TODO Send edge constraints */
#if 0
        err = SelvaObject_ReplyWithObject(resp, NULL, get_dyn_constraints(&ns->efc), NULL, 0);
        if (err) {
            selva_send_error(resp, err, NULL, 0);
        }
#endif
        i += SELVA_NODE_TYPE_SIZE;
    }
}

void SelvaSchema_SetDefaultSchema(struct SelvaHierarchy *hierarchy)
{
    char *types = alloc_types(0);
    struct SelvaSchema  *schema = alloc_schema(0);

    hierarchy->types = types;
    hierarchy->schema = schema;
}

int SelvaSchema_Load(struct selva_io *io, int encver, struct SelvaHierarchy *hierarchy)
{
    size_t nr_types = selva_io_load_unsigned(io);

    const char *types = selva_io_load_str(io, NULL);
    struct SelvaSchema *schema = alloc_schema(nr_types);

    for (size_t i = 0; i < nr_types; i++) {
        struct SelvaNodeSchema *ns = &schema->node[i];
        uint64_t flags;
        int err;

        ns->nr_emb_fields = selva_io_load_unsigned(io);
        flags = selva_io_load_unsigned(io);
        ns->created_en = flags & 1;
        ns->updated_en = flags & 2;

        err = EdgeConstraint_Load(io, encver, &ns->efc);
        if (err) {
            return err;
        }
    }

    selva_free(hierarchy->types);
    SelvaSchema_Destroy(hierarchy->schema);
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
        selva_io_save_unsigned(io, (ns->updated_en << 1) | ns->created_en);
        EdgeConstraint_Save(io, &ns->efc);
    }
}

static int SelvaHierarchyTypes_OnLoad(void)
{
    selva_mk_command(CMD_ID_HIERARCHY_SCHEMA_SET, SELVA_CMD_MODE_MUTATE, "schema.set", schema_set);
    selva_mk_command(CMD_ID_HIERARCHY_SCHEMA_GET, SELVA_CMD_MODE_PURE, "schema.get", schema_get);

    return 0;
}
SELVA_ONLOAD(SelvaHierarchyTypes_OnLoad);
