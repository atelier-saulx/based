/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <stddef.h>
#include <stdint.h>
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

struct client_schema {
    uint32_t nr_emb_fields;
    char type[SELVA_NODE_TYPE_SIZE];
    uint8_t created_en;
    uint8_t updated_en;
    char edge_constraints_str; /* n * EdgeFieldDynConstraintParams */
    size_t edge_constraints_len;
};

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
    if (idx >= 0) {
        return &hierarchy->schema->node[idx];
    }

    return SelvaSchema_FindNodeSchema(hierarchy, "ro");
}

void SelvaSchema_Destroy(struct SelvaSchema *schema)
{
    for (size_t i = 0; i < schema->count; i++) {
        struct SelvaNodeSchema *ns = &schema->node[i];

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

static void apply_root_schema(struct SelvaNodeSchema *ns)
{
    *ns = (struct SelvaNodeSchema){
        .nr_emb_fields = HIERARCHY_ROOT_NR_EMB_FIELDS,
        .created_en = true,
        .updated_en = true,
    };
    Edge_InitEdgeFieldConstraints(&ns->efc);
}

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

    bool implicit_root = true;

    for (size_t i = 0; i < (size_t)argc; i++) {
        size_t len;
        const char *buf = selva_string_to_str(argv[i], &len);

        if (len != sizeof(struct client_schema)) {
            selva_send_errorf(resp, SELVA_EINVAL, "Invalid schema argument at %zu", i);
            return;
        }

        if (!memcmp("ro", &buf[offsetof(struct client_schema, type)], SELVA_NODE_TYPE_SIZE)) {
            implicit_root = false;
        }

        const size_t edge_constraints_len = letoh(*(size_t *)memcpy(&(size_t){0}, &buf[offsetof(struct client_schema, edge_constraints_len)], sizeof(size_t)));
        if (!!(edge_constraints_len % sizeof(struct EdgeFieldDynConstraintParams))) {
            selva_send_errorf(resp, SELVA_EINVAL, "Invalid edge constraints at %zu", i);
            return;
        }
    }

    const size_t nr_types = argc + implicit_root;
    char *types = alloc_types(nr_types);
    struct SelvaSchema *schema = alloc_schema(nr_types);

    for (size_t i = 0; i < (size_t)argc; i++) {
        const char *buf = selva_string_to_str(argv[i], NULL);
        struct client_schema cs;
        struct SelvaNodeSchema *ns;

        memcpy(&cs, buf, sizeof(cs));
        cs.nr_emb_fields = letoh(cs.nr_emb_fields);
        memcpy(&types[i * SELVA_NODE_TYPE_SIZE], cs.type, sizeof(cs.type));

        ns = &schema->node[i];
        *ns = (struct SelvaNodeSchema){
            .nr_emb_fields = cs.nr_emb_fields,
            .created_en = !!cs.created_en,
            .updated_en = !!cs.updated_en,
        };

        Edge_InitEdgeFieldConstraints(&ns->efc);
        for (size_t j = 0; j < cs.edge_constraints_len; j += sizeof(struct EdgeFieldDynConstraintParams)) {
            int err;

            err = Edge_NewDynConstraint(&ns->efc, (const struct EdgeFieldDynConstraintParams *)(cs.edge_constraints_str + j));
            if (err) {
                selva_send_errorf(resp, SELVA_EINVAL, "Invalid edge constraint at %zu.%zu", i, j);
                return;
            }
        }
    }

    if (implicit_root) {
        size_t i = nr_types - 1;
        types[i * SELVA_NODE_TYPE_SIZE] = 'r';
        types[i * SELVA_NODE_TYPE_SIZE + 1] = 'o';
        apply_root_schema(&schema->node[i]);
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
        selva_send_array(resp, 4);
        selva_send_str(resp, types + i, SELVA_NODE_TYPE_SIZE);
        selva_send_ll(resp, nodes[idx].nr_emb_fields);
        selva_send_ll(resp, nodes[idx].created_en);
        selva_send_ll(resp, nodes[idx].updated_en);
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
    char *types = alloc_types(1);
    struct SelvaSchema  *schema = alloc_schema(1);

    types[0] = 'r';
    types[1] = 'o';
    apply_root_schema(&schema->node[0]);

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
    selva_mk_command(CMD_ID_HIERARCHY_SCHEMA_SET, SELVA_CMD_MODE_MUTATE, "hierarchy.schema.set", schema_set);
    selva_mk_command(CMD_ID_HIERARCHY_SCHEMA_GET, SELVA_CMD_MODE_PURE, "hierarchy.schema.get", schema_get);

    return 0;
}
SELVA_ONLOAD(SelvaHierarchyTypes_OnLoad);
