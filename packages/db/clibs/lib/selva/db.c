/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <stdarg.h>
#include <stdio.h>
#include <string.h>
#include <sys/mman.h>
#include "jemalloc.h"
#include "util/align.h"
#include "selva_object.h"
#include "selva.h"
#include "schema.h"
#include "fields.h"
#include "db.h"

#define NODEPOOL_SLAB_SIZE 2097152

RB_PROTOTYPE_STATIC(SelvaNodeIndex, SelvaNode, _index_entry, SelvaNode_Compare)
RB_PROTOTYPE_STATIC(SelvaTypeIndex, SelvaTypeEntry, _type_entry, SelvaTypeEntry_Compare);


static int SelvaNode_Compare(const struct SelvaNode *a, const struct SelvaNode *b)
{
    return a->node_id - b->node_id;
}

static int SelvaTypeEntry_Compare(const struct SelvaTypeEntry *a, const struct SelvaTypeEntry *b)
{
    return a->type - b->type;
}

static int SVector_SelvaNode_expire_compare(const void ** restrict a_raw, const void ** restrict b_raw)
{
    const struct SelvaNode *a = *(const struct SelvaNode **)a_raw;
    const struct SelvaNode *b = *(const struct SelvaNode **)b_raw;
    int diff;

    assert(a && b);

    diff = a->expire - b->expire;
    if (diff) {
        return diff;
    }

    return a->node_id - b->node_id;
}

RB_GENERATE_STATIC(SelvaNodeIndex, SelvaNode, _index_entry, SelvaNode_Compare)
RB_GENERATE_STATIC(SelvaTypeIndex, SelvaTypeEntry, _type_entry, SelvaTypeEntry_Compare);

struct SelvaDb *db_create(void)
{
    struct SelvaDb *db = selva_calloc(1, sizeof(*db));

    RB_INIT(&db->types);
    SVector_Init(&db->expiring.list, 0, SVector_SelvaNode_expire_compare);
    db->expiring.next = SELVA_NODE_EXPIRE_NEVER;
    /* TODO Expiring nodes timer */
#if 0
    db->expiring.tim_id = evl_set_timeout(&hierarchy_expire_period, hierarchy_expire_tim_proc, hierarchy);
#endif

    return db;
}

/**
 * Delete all nodes under this type.
 */
static void del_all_nodes(struct SelvaDb *db, struct SelvaTypeEntry *type)
{
    struct SelvaNode *node;
    struct SelvaNode *tmp;

    RB_FOREACH_SAFE(node, SelvaNodeIndex, &type->nodes, tmp) {
        db_del_node(db, type, node);
    }
}

static void del_type(struct SelvaDb *db, struct SelvaTypeEntry *type)
{
    del_all_nodes(db, type);

    /* TODO Destroy aliases */
    (void)RB_REMOVE(SelvaTypeIndex, &db->types, type);

    mempool_destroy(&type->nodepool);
    selva_free(type->field_map_template.buf);
    selva_free(type);
}

void db_destroy(struct SelvaDb *db)
{
    /* FIXME */
    struct SelvaTypeEntry *type;
    struct SelvaTypeEntry *tmp;

    /* TODO Destroy timers */

    RB_FOREACH_SAFE(type, SelvaTypeIndex, &db->types, tmp) {
        del_type(db, type);
    }

    selva_free(db);
}

static void make_field_map_template(struct SelvaTypeEntry *type)
{
    struct SelvaNodeSchema *ns = &type->ns;
    const size_t nr_fields = ns->nr_fields;
    const size_t nr_main_fields = ns->nr_main_fields;
    size_t main_field_off = 0;
    struct SelvaFieldInfo *nfo = selva_malloc(nr_fields * sizeof(struct SelvaFieldInfo));

    for (size_t i = 0; i < nr_fields; i++) {
        if (i < nr_main_fields) {
            struct SelvaFieldSchema *fs = db_get_fs_by_ns_field(ns, i);

            assert(fs);

            nfo[i] = (struct SelvaFieldInfo){
                .type = fs->type,
                .off = main_field_off >> 3,
            };
            main_field_off += ALIGNED_SIZE(selva_field_data_size[fs->type], SELVA_FIELDS_DATA_ALIGN);
        } else {
            nfo[i] = (struct SelvaFieldInfo){
                .type = 0,
                .off = 0,
            };
        }
    }

    type->field_map_template.buf = nfo;
    type->field_map_template.len = nr_fields * sizeof(struct SelvaFieldInfo);
    type->field_map_template.main_data_size = ALIGNED_SIZE(main_field_off, SELVA_FIELDS_DATA_ALIGN);
}

int db_schema_create(struct SelvaDb *db, node_type_t type, const char *schema_buf, size_t schema_len)
{
    struct schema_fields_count count;
    int err;

    err = schemabuf_count_fields(&count, schema_buf, schema_len);
    if (err) {
        return err;
    }

    struct SelvaTypeEntry *e = selva_calloc(1, sizeof(*e) + count.nr_fields * sizeof(struct SelvaFieldSchema));

    e->type = type;
    e->ns.nr_fields = count.nr_fields;
    e->ns.nr_main_fields = count.nr_main_fields;
    err = schemabuf_parse(&e->ns, schema_buf, schema_len);
    if (err) {
        selva_free(e);
        return err;
    }
    make_field_map_template(e);

    RB_INIT(&e->nodes);
    SelvaObject_Init(e->aliases._obj_data, 0);

    const size_t node_size = sizeof(struct SelvaNode) + count.nr_fields * sizeof(struct SelvaFieldInfo);
    mempool_init2(&e->nodepool, NODEPOOL_SLAB_SIZE, node_size, alignof(size_t), MEMPOOL_ADV_RANDOM | MEMPOOL_ADV_HP_SOFT);

    struct SelvaTypeEntry *prev = RB_INSERT(SelvaTypeIndex, &db->types, e);
    if (prev) {
        db_panic("Schema update not supported");
    }
    return 0;
}

struct SelvaTypeEntry *db_get_type_by_index(struct SelvaDb *db, node_type_t type)
{
    struct SelvaTypeEntry find = {
        .type = type,
    };

    return RB_FIND(SelvaTypeIndex, &db->types, &find);
}

struct SelvaTypeEntry *db_get_type_by_node(struct SelvaDb *db, struct SelvaNode *node)
{
    struct SelvaTypeEntry find = {
        .type = node->type,
    };

    return RB_FIND(SelvaTypeIndex, &db->types, &find);
}

struct SelvaFieldSchema *db_get_fs_by_ns_field(struct SelvaNodeSchema *ns, field_t field)
{
    if (field >= ns->nr_fields) {
        return NULL;
    }

    return &ns->field_schemas[field];
}

struct SelvaFieldSchema *get_fs_by_node(struct SelvaDb *db, struct SelvaNode *node, field_t field)
{
    struct SelvaTypeEntry *type;

    type = db_get_type_by_node(db, node);
    if (!type) {
        return NULL;
    }

    return db_get_fs_by_ns_field(&type->ns, field);
}

void db_del_node(struct SelvaDb *db, struct SelvaTypeEntry *type, struct SelvaNode *node)
{
    RB_REMOVE(SelvaNodeIndex, &type->nodes, node);

    if (node->expire) {
        /* TODO clear expire */
    }

    selva_fields_destroy(db, node);
    mempool_return(&type->nodepool, node);
}

struct SelvaNode *db_find_node(struct SelvaDb *db, struct SelvaTypeEntry *type, node_id_t node_id)
{
    struct SelvaNode find = {
        .node_id = node_id,
    };

    return RB_FIND(SelvaNodeIndex, &type->nodes, &find);
}

struct SelvaNode *db_upsert_node(struct SelvaDb *db, struct SelvaTypeEntry *type, node_id_t node_id)
{
    struct SelvaNode *node = mempool_get(&type->nodepool);
    struct SelvaNode *prev;

    node->node_id = node_id;
    node->type = type->type;
    prev = RB_INSERT(SelvaNodeIndex, &type->nodes, node);
    if (prev) {
        mempool_return(&type->nodepool, node);
        node = prev;
    } else {
        memset(&node->trx_label, 0, sizeof(node->trx_label));
        node->expire = 0;
        selva_fields_init(type, node);
    }

    return node;
}

[[noreturn]]
void db_panic_fn(const char * restrict where, const char * restrict func, const char * restrict fmt, ...)
{
    va_list args;

    va_start(args, fmt);
    fprintf(stderr, "%s:%s: ", where, func);
    vfprintf(stderr, fmt, args);
    if (fmt[strlen(fmt) - 1] != '\n') {
        fputc('\n', stderr);
    }
    va_end(args);

    abort();
}
