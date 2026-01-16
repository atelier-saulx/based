/*
 * Copyright (c) 2024-2025 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stdio.h>
#include <assert.h>
#include <string.h>
#include "jemalloc_selva.h"
#include "selva_error.h"
#include "db.h"

void selva_init_aliases(struct SelvaTypeEntry *type)
{
    const struct SelvaFieldsSchema *fields_schema = &type->ns.fields_schema;
    const size_t nr_fields = fields_schema->nr_fields;

    type->aliases = selva_malloc(type->ns.nr_aliases * sizeof(struct SelvaAliases));

    for (size_t i = 0; i < nr_fields; i++) {
        const struct SelvaFieldSchema *fs = &fields_schema->field_schemas[i];
        struct SelvaAliases *field_aliases = &type->aliases[fs->alias_index];

        switch (fs->type) {
        case SELVA_FIELD_TYPE_ALIAS:
            field_aliases->single = true;
            __attribute__((__fallthrough__));
        case SELVA_FIELD_TYPE_ALIASES:
#if 0
            assert(fs->alias_index < type->ns.nr_aliases);
#endif
            field_aliases->field = fs->field;
            RB_INIT(&field_aliases->alias_by_name);
            RB_INIT(&field_aliases->alias_by_dest);
            __attribute__((__fallthrough__));
        default:
        }
    }
}

void selva_destroy_aliases(struct SelvaTypeEntry *type)
{
    /* We assume that all the aliases in the aliases structs have been freed already. */
    selva_free(type->aliases);
    type->ns.nr_aliases = 0;
    type->aliases = nullptr;
}

static struct SelvaAlias *insert_alias_by_name(struct SelvaAliases *aliases, struct SelvaAlias *new_alias)
{
     struct SelvaAlias *old_alias;

     old_alias = RB_INSERT(SelvaAliasesByName, &aliases->alias_by_name, new_alias);
     if (!old_alias) {
         aliases->nr_aliases++;
     }

     return old_alias;
}

static void remove_alias_by_dest(struct SelvaAliases *aliases, struct SelvaAlias *alias)
{
    RB_REMOVE(SelvaAliasesByDest, &aliases->alias_by_dest, alias);
}

static void remove_alias_by_name(struct SelvaAliases *aliases, struct SelvaAlias *alias)
{
    struct SelvaAlias *removed = RB_REMOVE(SelvaAliasesByName, &aliases->alias_by_name, alias);
    assert(removed);
}

static void del_alias(struct SelvaAliases *aliases, struct SelvaAlias *alias)
{
    remove_alias_by_name(aliases, alias);

    if (alias->prev) {
        /*
         * `alias` is in the middle or the last in the chain for this dest.
         */
        alias->prev->next = alias->next;
    } else {
        /*
         * `alias` must be the first in alias_by_dest with this destination.
         * We must make the `next` the first.
         */
        remove_alias_by_dest(aliases, alias);
        if (alias->next) {
            (void)RB_INSERT(SelvaAliasesByDest, &aliases->alias_by_dest, alias->next);
        }
    }
    if (alias->next) {
        /*
         * This either sets a new `prev` or nulls it if `alias` was the first.
         */
        alias->next->prev = alias->prev;
    }

    selva_free(alias);
    aliases->nr_aliases--;
}

size_t selva_alias_count(const struct SelvaAliases *aliases)
{
    return aliases->nr_aliases;
}

node_id_t selva_set_alias_p(struct SelvaAliases *aliases, struct SelvaAlias *new_alias)
{
    struct SelvaAlias *old_alias;
    node_id_t old_dest = 0;

    new_alias->prev = nullptr;
    new_alias->next = nullptr;

retry:
    old_alias = insert_alias_by_name(aliases, new_alias);
    if (old_alias) {
        old_dest = old_alias->dest;
        del_alias(aliases, old_alias);
        goto retry;
    }

    struct SelvaAlias *prev_by_dest = RB_INSERT(SelvaAliasesByDest, &aliases->alias_by_dest, new_alias);
    if (prev_by_dest) {
        new_alias->prev = prev_by_dest;
        new_alias->next = prev_by_dest->next;
        prev_by_dest->next = new_alias;
        if (aliases->single) {
            /*
             * Restrict this field to a single alias, i.e. this is SELVA_FIELD_TYPE_ALIAS.
             */
            del_alias(aliases, prev_by_dest);
        }
    }

    return old_dest;
}

node_id_t selva_set_alias(struct SelvaAliases *aliases, node_id_t dest, const char *name_str, size_t name_len)
{
    struct SelvaAlias *new_alias = selva_malloc(sizeof_wflex(struct SelvaAlias, name, name_len));

    new_alias->dest = dest;
    new_alias->name_len = name_len;
    memcpy(new_alias->name, name_str, name_len);

    return selva_set_alias_p(aliases, new_alias);
}

node_id_t selva_del_alias_by_name(struct SelvaAliases *aliases, const char *name_str, size_t name_len)
{
    struct SelvaAlias *find = alloca(sizeof_wflex(struct SelvaAlias, name, name_len));
    struct SelvaAlias *alias;
    node_id_t old_dest = 0;

    memset(find, 0, sizeof(*find));
    find->name_len = name_len;
    memcpy(find->name, name_str, name_len);

    alias = RB_FIND(SelvaAliasesByDest, &aliases->alias_by_dest, find);
    if (alias) {
        old_dest = alias->dest;
        del_alias(aliases, alias);
    }

    return old_dest;
}

void selva_del_alias_by_dest(struct SelvaAliases *aliases, node_id_t dest)
{
    struct SelvaAlias find = {
        .dest = dest,
    };
    struct SelvaAlias *alias = RB_FIND(SelvaAliasesByDest, &aliases->alias_by_dest, &find);

    if (!alias) {
        return;
    }

    remove_alias_by_dest(aliases, alias);
    assert(!alias->prev); /* This must be the first one on the list of by_dest aliases. */

    /*
     * Remove this alias from by_name.
     */
    remove_alias_by_name(aliases, alias);

    /*
     * Remove the rest of aliases by this dest from by_name.
     */
    struct SelvaAlias *next = alias->next;
    while (next) {
        struct SelvaAlias *tmp = next->next;

        assert(next->dest == alias->dest);
        remove_alias_by_name(aliases, next);
        selva_free(next);

        next = tmp;
    }

    selva_free(alias);
}

struct SelvaNodeRes selva_get_alias(struct SelvaTypeEntry *type, struct SelvaAliases *aliases, const char *name_str, size_t name_len)
{
    struct SelvaNodeRes res = {};
    struct SelvaAlias *find = alloca(sizeof_wflex(struct SelvaAlias, name, name_len));

    memset(find, 0, sizeof(*find));
    find->name_len = name_len;
    memcpy(find->name, name_str, name_len);

    struct SelvaAlias *alias = RB_FIND(SelvaAliasesByName, &aliases->alias_by_name, find);
    if (!alias) {
        return res;
    }

    res = selva_find_node(type, alias->dest);
    if (!res.node) {
        if (res.block_status & SELVA_TYPE_BLOCK_STATUS_INMEM) {
            /* Oopsie, no node found. */
            selva_del_alias_by_dest(aliases, alias->dest);
            alias = nullptr;
        }
    }

    return res;
}

const struct SelvaAlias *selva_get_alias_by_dest(struct SelvaAliases *aliases, node_id_t dest)
{
    struct SelvaAlias find = {
        .dest = dest,
    };

    return RB_FIND(SelvaAliasesByDest, &aliases->alias_by_dest, &find);
}

const struct SelvaAlias *selva_get_next_alias(const struct SelvaAlias *alias)
{
    return (alias) ? alias->next : nullptr;
}

const char *selva_get_alias_name(const struct SelvaAlias *alias, size_t *len)
{
    *len = alias->name_len;
    return alias->name;
}

struct SelvaAliases *selva_get_aliases(struct SelvaTypeEntry *type, field_t field)
{
    size_t nr_aliases = type->ns.nr_aliases;

    for (size_t i = 0; i < nr_aliases; i++) {
        if (type->aliases[i].field == field) {
            return &type->aliases[i];
        }
    }

    return nullptr;
}

void selva_remove_all_aliases(struct SelvaTypeEntry *type, node_id_t node_id)
{
    size_t nr_aliases = type->ns.nr_aliases;

    for (size_t i = 0; i < nr_aliases; i++) {
        selva_del_alias_by_dest(&type->aliases[i], node_id);
    }
}
