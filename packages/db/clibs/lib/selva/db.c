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
#include "selva_error.h"
#include "selva.h"
#include "schema.h"
#include "fields.h"
#include "db.h"

#define NODEPOOL_SLAB_SIZE 2097152

RB_PROTOTYPE_STATIC(SelvaNodeIndex, SelvaNode, _index_entry, SelvaNode_Compare)
RB_PROTOTYPE_STATIC(SelvaAliasesByName, SelvaAlias, _entry, SelvaAlias_comp_name);
RB_PROTOTYPE_STATIC(SelvaAliasesByDest, SelvaAlias, _entry, SelvaAlias_comp_dest);

static int SelvaNode_Compare(const struct SelvaNode *a, const struct SelvaNode *b)
{
    return a->node_id - b->node_id;
}

static int SelvaAlias_comp_name(const struct SelvaAlias *a, const struct SelvaAlias *b)
{
    return strcmp(a->name, b->name);
}

static int SelvaAlias_comp_dest(const struct SelvaAlias *a, const struct SelvaAlias *b)
{
    return a->dest - b->dest;
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

static inline void *SelvaTypeEntry2vecptr(struct SelvaTypeEntry *type)
{
    assert(((uintptr_t)type & 0xFFFF) == 0);
    return (void *)((uintptr_t)type | type->type);
}

static inline struct SelvaTypeEntry *vecptr2SelvaTypeEntry(void *p)
{
    struct SelvaTypeEntry *te = (struct SelvaTypeEntry *)((uintptr_t)p & ~0xFFFF);
    __builtin_prefetch(te);
    return te;
}

static int SVector_SelvaTypeEntry_compare(const void ** restrict a_raw, const void ** restrict b_raw)
{
    uint16_t a_type = 0xFFFF & (uintptr_t)(*a_raw);
    uint16_t b_type = 0xFFFF & (uintptr_t)(*b_raw);

    return a_type - b_type;
}

RB_GENERATE_STATIC(SelvaNodeIndex, SelvaNode, _index_entry, SelvaNode_Compare)
RB_GENERATE_STATIC(SelvaAliasesByName, SelvaAlias, _entry, SelvaAlias_comp_name);
RB_GENERATE_STATIC(SelvaAliasesByDest, SelvaAlias, _entry, SelvaAlias_comp_dest);

struct SelvaDb *db_create(void)
{
    struct SelvaDb *db = selva_calloc(1, sizeof(*db));

    SVector_Init(&db->type_list, 1, SVector_SelvaTypeEntry_compare);
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
    /* We assume that as the nodes are deleted the aliases are also freed. */

    (void)SVector_Remove(&db->type_list, SelvaTypeEntry2vecptr(type));

    mempool_destroy(&type->nodepool);
    selva_free(type->field_map_template.buf);
    selva_free(type);
}

static void del_all_types(struct SelvaDb *db)
{
    SVECTOR_AUTOFREE(types_copy);
    struct SVectorIterator it;
    struct SelvaTypeEntry *type;

    SVector_Clone(&types_copy, &db->type_list, NULL);
    SVector_ForeachBegin(&it, &types_copy);
    while ((type = vecptr2SelvaTypeEntry(SVector_Foreach(&it)))) {
        del_type(db, type);
    }
}

void db_destroy(struct SelvaDb *db)
{
    /* FIXME */

    /* TODO Destroy timers */
    del_all_types(db);
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
            main_field_off += ALIGNED_SIZE(fields_get_data_size(fs), SELVA_FIELDS_DATA_ALIGN);
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
    const size_t te_ns_max_size = (sizeof(struct SelvaTypeEntry) - offsetof(struct SelvaTypeEntry, ns) - sizeof(struct SelvaTypeEntry){0}.ns);
    int err;

    err = schemabuf_count_fields(&count, schema_buf, schema_len);
    if (err) {
        return err;
    }

    if (count.nr_fields * sizeof(struct SelvaFieldSchema) > te_ns_max_size) {
        /* schema too large. */
        return SELVA_ENOBUFS;
    }

    struct SelvaTypeEntry *te = selva_aligned_alloc(alignof(*te), sizeof(*te));
    memset(te, 0, sizeof(*te) - te_ns_max_size + count.nr_fields * sizeof(struct SelvaFieldSchema));

    te->type = type;
    te->ns.nr_fields = count.nr_fields;
    te->ns.nr_main_fields = count.nr_main_fields;
    err = schemabuf_parse(&te->ns, schema_buf, schema_len);
    if (err) {
        selva_free(te);
        return err;
    }
    make_field_map_template(te);

    RB_INIT(&te->nodes);
    RB_INIT(&te->aliases.alias_by_name);
    RB_INIT(&te->aliases.alias_by_dest);

    const size_t node_size = sizeof(struct SelvaNode) + count.nr_fields * sizeof(struct SelvaFieldInfo);
    mempool_init2(&te->nodepool, NODEPOOL_SLAB_SIZE, node_size, alignof(size_t), MEMPOOL_ADV_RANDOM | MEMPOOL_ADV_HP_SOFT);

#if 0
    struct mempool_slab_info slab_info = mempool_slab_info(&te->nodepool);
    printf("\ntype: %d\n"
           "node_size: %zu\n"
           "slab_size: %zu\n"
           "chunk_size: %zu\n"
           "obj_size: %zu\n"
           "nr_objects: %zu\n",
           type,
           node_size,
           slab_info.slab_size,
           slab_info.chunk_size,
           slab_info.obj_size,
           slab_info.nr_objects);
#endif

    void *prev = SVector_Insert(&db->type_list, SelvaTypeEntry2vecptr(te));
    if (prev) {
        db_panic("Schema update not supported");
    }
    return 0;
}

struct SelvaTypeEntry *db_get_type_by_index(struct SelvaDb *db, node_type_t type)
{
    void *find = (void *)(uintptr_t)type;

    return vecptr2SelvaTypeEntry(SVector_Search(&db->type_list, find));
}

struct SelvaTypeEntry *db_get_type_by_node(struct SelvaDb *db, struct SelvaNode *node)
{
    void *find = (void *)(uintptr_t)node->type;

    return vecptr2SelvaTypeEntry(SVector_Search(&db->type_list, find));
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
    /* TODO Remove aliases */

    selva_fields_destroy(db, node);
    mempool_return(&type->nodepool, node);
}

struct SelvaNode *db_find_node(struct SelvaTypeEntry *type, node_id_t node_id)
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

void db_set_alias(struct SelvaTypeEntry *type, node_id_t dest, const char *name)
{
    size_t name_len = strlen(name);
    struct SelvaAlias *new_alias = selva_malloc(sizeof(struct SelvaAlias) + name_len + 1);
    struct SelvaAlias *old_alias;

    new_alias->prev = NULL;
    new_alias->next = NULL;
    new_alias->dest = dest;
    memcpy(new_alias->name, name, name_len);
    new_alias->name[name_len] = '\0';

retry:
    old_alias = RB_INSERT(SelvaAliasesByName, &type->aliases.alias_by_name, new_alias);
    if (old_alias) {
        (void)RB_REMOVE(SelvaAliasesByName, &type->aliases.alias_by_name, old_alias);
        selva_free(old_alias);
        old_alias = NULL;
        goto retry;
    }

    struct SelvaAlias *old_by_dest = RB_INSERT(SelvaAliasesByDest, &type->aliases.alias_by_dest, new_alias);
    if (old_by_dest) {
        new_alias->prev = old_by_dest;
        new_alias->next = old_by_dest->next;
        old_by_dest->next = new_alias;
    }
}

void db_del_alias_by_name(struct SelvaTypeEntry *type, const char *name)
{
    size_t name_len = strlen(name);
    struct SelvaAlias *find = alloca(sizeof(struct SelvaAlias) + name_len + 1);

    memset(find, 0, sizeof(*find));
    memcpy(find->name, name, name_len);
    find->name[name_len] = '\0';

    struct SelvaAlias *alias = RB_REMOVE(SelvaAliasesByName, &type->aliases.alias_by_name, find);
    if (alias) {
        if (alias->prev) {
            alias->prev->next = alias->next;
        } else {
            /*
             * `alias` must be the first in alias_by_dest with this destination.
             * We must make the `next` the first.
             */
            (void)RB_REMOVE(SelvaAliasesByDest, &type->aliases.alias_by_dest, alias);
            if (alias->next) {
                (void)RB_INSERT(SelvaAliasesByDest, &type->aliases.alias_by_dest, alias->next);
            }
        }
        if (alias->next) {
            /*
             * This either sets a new `prev` or nulls it if `alias` was the first.
             */
            alias->next->prev = alias->prev;
        }

        selva_free(alias);
    }
}

void db_del_alias_by_dest(struct SelvaTypeEntry *type, node_id_t dest)
{
    struct SelvaAlias find = {
        .dest = dest,
    };

    struct SelvaAlias *alias = RB_REMOVE(SelvaAliasesByDest, &type->aliases.alias_by_dest, &find);
    if (alias) {
        assert(!alias->prev); /* This must be the first one on the list of by_dest aliases. */

        /*
         * Remove this alias from by_name.
         */
        (void)RB_REMOVE(SelvaAliasesByName, &type->aliases.alias_by_name, alias);

        /*
         * Remove the rest of aliases by this dest from by_name.
         */
        struct SelvaAlias *next = alias->next;
        while (next) {
            struct SelvaAlias *tmp = next->next;

            assert(next->dest == alias->dest);
            (void)RB_REMOVE(SelvaAliasesByName, &type->aliases.alias_by_name, next);
            selva_free(next);

            next = tmp;
        }

        selva_free(alias);
    }
}

struct SelvaNode *db_get_alias(struct SelvaTypeEntry *type, const char *name)
{
    size_t name_len = strlen(name);
    struct SelvaAlias *find = alloca(sizeof(struct SelvaAlias) + name_len + 1);

    memset(find, 0, sizeof(*find));
    memcpy(find->name, name, name_len);
    find->name[name_len] = '\0';

    struct SelvaAlias *alias = RB_FIND(SelvaAliasesByName, &type->aliases.alias_by_name, find);
    if (!alias) {
        return NULL;
    }


    struct SelvaNode *node = db_find_node(type, alias->dest);
    if (!node) {
        /* Oopsie, no node found. */
        db_del_alias_by_dest(type, alias->dest);
        alias = NULL;
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
