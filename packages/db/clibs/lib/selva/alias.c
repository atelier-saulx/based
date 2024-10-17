/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stdio.h>
#include <assert.h>
#include <string.h>
#include "jemalloc.h"
#include "selva_error.h"
#include "db.h"

void selva_init_aliases(struct SelvaTypeEntry *type)
{
    const struct SelvaFieldsSchema *fields_schema = &type->ns.fields_schema;
    size_t nr_aliases = 0;

    for (size_t i = 0; i < fields_schema->nr_fields; i++) {
        const struct SelvaFieldSchema *fs = &fields_schema->field_schemas[i];

        if (fs->type == SELVA_FIELD_TYPE_ALIAS ||
            fs->type == SELVA_FIELD_TYPE_ALIASES) {
            nr_aliases++;
        }
    }

    type->aliases = selva_malloc(nr_aliases * sizeof(struct SelvaAliases));
    type->nr_aliases = nr_aliases;

    for (size_t i = 0; i < fields_schema->nr_fields; i++) {
        const struct SelvaFieldSchema *fs = &fields_schema->field_schemas[i];
        struct SelvaAliases *field_aliases = &type->aliases[fs->alias_index];

        switch (fs->type) {
        case SELVA_FIELD_TYPE_ALIAS:
            field_aliases->single = true;
            __attribute__((__fallthrough__));
        case SELVA_FIELD_TYPE_ALIASES:
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
    type->nr_aliases = 0;
    type->aliases = NULL;
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
    RB_REMOVE(SelvaAliasesByName, &aliases->alias_by_name, alias);
    aliases->nr_aliases--;
}

static int del_alias(struct SelvaAliases *aliases, struct SelvaAlias *alias)
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

    return 0;
}

size_t selva_alias_count(const struct SelvaAliases *aliases)
{
    return aliases->nr_aliases;
}

void selva_set_alias_p(struct SelvaAliases *aliases, struct SelvaAlias *new_alias)
{
    struct SelvaAlias *old_alias;

    new_alias->prev = NULL;
    new_alias->next = NULL;

retry:
    old_alias = insert_alias_by_name(aliases, new_alias);
    if (old_alias) {
        (void)del_alias(aliases, old_alias);
        goto retry;
    }

    struct SelvaAlias *prev_by_dest = RB_INSERT(SelvaAliasesByDest, &aliases->alias_by_dest, new_alias);
    if (prev_by_dest) {
        if (aliases->single) {
            /*
             * Restrict this field to a single alias, i.e. this is SELVA_FIELD_TYPE_ALIAS.
             */
            (void)del_alias(aliases, prev_by_dest);
        } else {
            /*
             * SELVA_FIELD_TYPE_ALIASES
             */
            new_alias->prev = prev_by_dest;
            new_alias->next = prev_by_dest->next;
            prev_by_dest->next = new_alias;
        }
    }
}

void selva_set_alias(struct SelvaAliases *aliases, node_id_t dest, const char *name_str, size_t name_len)
{
    struct SelvaAlias *new_alias = selva_malloc(sizeof(struct SelvaAlias) + name_len + 1);

    new_alias->dest = dest;
    memcpy(new_alias->name, name_str, name_len);
    new_alias->name[name_len] = '\0';

    selva_set_alias_p(aliases, new_alias);
}

int selva_del_alias_by_name(struct SelvaAliases *aliases, const char *name_str, size_t name_len)
{
    struct SelvaAlias *find = alloca(sizeof(struct SelvaAlias) + name_len + 1);
    struct SelvaAlias *alias;

    memset(find, 0, sizeof(*find));
    memcpy(find->name, name_str, name_len);
    find->name[name_len] = '\0';

    alias = RB_FIND(SelvaAliasesByDest, &aliases->alias_by_dest, find);
    if (!alias) {
        return SELVA_ENOENT;
    }

    return (alias) ? del_alias(aliases, alias) : SELVA_ENOENT;
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

struct SelvaNode *selva_get_alias(struct SelvaTypeEntry *type, struct SelvaAliases *aliases, const char *name_str, size_t name_len)
{
    struct SelvaAlias *find = alloca(sizeof(struct SelvaAlias) + name_len + 1);

    memset(find, 0, sizeof(*find));
    memcpy(find->name, name_str, name_len);
    find->name[name_len] = '\0';

    struct SelvaAlias *alias = RB_FIND(SelvaAliasesByName, &aliases->alias_by_name, find);
    if (!alias) {
        return NULL;
    }


    struct SelvaNode *node = selva_find_node(type, alias->dest);
    if (!node) {
        /* Oopsie, no node found. */
        selva_del_alias_by_dest(aliases, alias->dest);
        alias = NULL;
    }

    return node;
}

struct SelvaAliases *selva_get_aliases(struct SelvaTypeEntry *type, field_t field)
{
    size_t nr_aliases = type->nr_aliases;

    for (size_t i = 0; i < nr_aliases; i++) {
        if (type->aliases[i].field == field) {
            return &type->aliases[i];
        }
    }

    return NULL;
}

void selva_remove_all_aliases(struct SelvaTypeEntry *type, node_id_t node_id)
{
    for (size_t i = 0; i < type->nr_aliases; i++) {
        selva_del_alias_by_dest(&type->aliases[i], node_id);
    }
}
