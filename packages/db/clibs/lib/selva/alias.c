/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <string.h>
#include "jemalloc.h"
#include "selva_error.h"
#include "db.h"

static struct SelvaAlias *insert_alias_by_name(struct SelvaTypeEntry *type, struct SelvaAlias *new_alias)
{
     struct SelvaAlias *old_alias;

     old_alias = RB_INSERT(SelvaAliasesByName, &type->aliases.alias_by_name, new_alias);
     if (!old_alias) {
         type->nr_aliases++;
     }

     return old_alias;
}

static struct SelvaAlias *remove_alias_by_name(struct SelvaTypeEntry *type, struct SelvaAlias *find)
{
    struct SelvaAlias *alias;

    alias = RB_REMOVE(SelvaAliasesByName, &type->aliases.alias_by_name, find);
    if (alias) {
        type->nr_aliases--;
    }

    return alias;
}

static int del_alias(struct SelvaTypeEntry *type, struct SelvaAlias *alias_or_find)
{
    struct SelvaAlias *alias = remove_alias_by_name(type, alias_or_find);

    if (!alias) {
        return SELVA_ENOENT;
    }

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
    type->nr_aliases--;

    return 0;
}

size_t selva_alias_count(const struct SelvaTypeEntry *type)
{
    return type->nr_aliases;
}

void selva_set_alias_p(struct SelvaTypeEntry *type, struct SelvaAlias *new_alias)
{
    struct SelvaAlias *old_alias;

    new_alias->prev = NULL;
    new_alias->next = NULL;

retry:
    old_alias = insert_alias_by_name(type, new_alias);
    if (old_alias) {
        (void)del_alias(type, old_alias);
        goto retry;
    }

    struct SelvaAlias *prev_by_dest = RB_INSERT(SelvaAliasesByDest, &type->aliases.alias_by_dest, new_alias);
    if (prev_by_dest) {
        new_alias->prev = prev_by_dest;
        new_alias->next = prev_by_dest->next;
        prev_by_dest->next = new_alias;
    }
}

void selva_set_alias(struct SelvaTypeEntry *type, node_id_t dest, const char *name_str, size_t name_len)
{
    struct SelvaAlias *new_alias = selva_malloc(sizeof(struct SelvaAlias) + name_len + 1);

    new_alias->dest = dest;
    memcpy(new_alias->name, name_str, name_len);
    new_alias->name[name_len] = '\0';

    selva_set_alias_p(type, new_alias);
}

int selva_del_alias_by_name(struct SelvaTypeEntry *type, const char *name_str, size_t name_len)
{
    struct SelvaAlias *find = alloca(sizeof(struct SelvaAlias) + name_len + 1);

    memset(find, 0, sizeof(*find));
    memcpy(find->name, name_str, name_len);
    find->name[name_len] = '\0';

    return del_alias(type, find);
}

void selva_del_alias_by_dest(struct SelvaTypeEntry *type, node_id_t dest)
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
        remove_alias_by_name(type, alias);

        /*
         * Remove the rest of aliases by this dest from by_name.
         */
        struct SelvaAlias *next = alias->next;
        while (next) {
            struct SelvaAlias *tmp = next->next;

            assert(next->dest == alias->dest);
            remove_alias_by_name(type, next);
            selva_free(next);

            next = tmp;
        }

        selva_free(alias);
    }
}

struct SelvaNode *selva_get_alias(struct SelvaTypeEntry *type, const char *name_str, size_t name_len)
{
    struct SelvaAlias *find = alloca(sizeof(struct SelvaAlias) + name_len + 1);

    memset(find, 0, sizeof(*find));
    memcpy(find->name, name_str, name_len);
    find->name[name_len] = '\0';

    struct SelvaAlias *alias = RB_FIND(SelvaAliasesByName, &type->aliases.alias_by_name, find);
    if (!alias) {
        return NULL;
    }


    struct SelvaNode *node = selva_find_node(type, alias->dest);
    if (!node) {
        /* Oopsie, no node found. */
        selva_del_alias_by_dest(type, alias->dest);
        alias = NULL;
    }

    return node;
}
