/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <tgmath.h>
#include "jemalloc.h"
#include "util/finalizer.h"
#include "util/selva_string.h"
#include "selva_error.h"
#include "selva_object.h"
#include "parsers.h"

static size_t pick_side_list(const char *side_list_prefixes, const char *s)
{
    const char *pch = strchr(side_list_prefixes, s[0]);

    return pch ? pch - side_list_prefixes + 1 : 0;
}

static struct selva_string *ensure_side_list(struct selva_string *list[], size_t i)
{
    if (!list[i]) {
        list[i] = selva_string_create("", 0, SELVA_STRING_MUTABLE);
    }

    return list[i];
}

int string_set_list_add(struct selva_string *sl, const char *opt_ignore_str, size_t opt_ignore_len, const char *el_str, size_t el_len)
{
    const char sep[] = { STRING_SET_SEPARATOR_SET };
    const char *name_str = el_str + 1;
    const size_t name_len = el_len - 1;

    if (opt_ignore_str && name_len == opt_ignore_len && !memcmp(opt_ignore_str, name_str, name_len)) {
        return 0;
    }

    (void)selva_string_append(sl, name_str, name_len);
    return selva_string_append(sl, sep, 1);
}

/**
 * Add to the list with a numeric index.
 * `n` is converted into a base 10 string.
 */
static void so_add_n(struct SelvaObject *obj, size_t n, const char *str, size_t len)
{
    const size_t key_len = (size_t)(log10(n + 1)) + 1;
    char key_str[key_len + 1];
    struct selva_string *s;

    snprintf(key_str, key_len + 1, "%zu", n);
    s = selva_string_create(str, len, 0);

    SelvaObject_InsertArrayStr(obj, key_str, key_len, SELVA_OBJECT_STRING, s);
}

/**
 * Add to the list with an alias index.
 * `alias` is prefixed with STRING_SET_ALIAS.
 */
static void so_add_alias(struct SelvaObject *obj, const char *alias_str, size_t alias_len, const char *str, size_t len)
{
    const size_t key_len = alias_len + 1;
    char key_str[key_len];
    struct selva_string *s;

    key_str[0] = STRING_SET_ALIAS;
    memcpy(key_str + 1, alias_str, alias_len);
    s = selva_string_create(str, len, 0);

    SelvaObject_InsertArrayStr(obj, key_str, key_len, SELVA_OBJECT_STRING, s);
}

int parse_string_set(
        struct finalizer *finalizer,
        const struct selva_string *raw_in,
        struct SelvaObject **list_out,
        const char *side_list_prefixes,
        struct selva_string **side_list_out[])
{
    struct SelvaObject *obj = SelvaObject_New();
    const size_t nr_side_lists = strlen(side_list_prefixes);
    struct selva_string *side_list[nr_side_lists ?: 1];
    const char *cur = selva_string_to_str(raw_in, NULL);
    size_t n = 0;

#if 0
    struct selva_string *excl = NULL;
    size_t nr_excl = 0;
#endif

    assert(nr_side_lists == 0 || (nr_side_lists > 0 && side_list_out));

    for (size_t i  = 0; i < nr_side_lists; i++) {
        side_list[i] = NULL;
    }

    if (cur[0] != STRING_SET_EOS) {
        do {
            const char *next;

            /*
             * Find the separator between the current and the next field name list.
             */
            next = cur;
            while (*next != STRING_SET_EOS && *next != STRING_SET_SEPARATOR_SET) {
                next++;
            }

            const size_t cur_len = (size_t)((ptrdiff_t)next - (ptrdiff_t)cur);
            size_t side_list_i;
            if ((side_list_i = pick_side_list(side_list_prefixes, cur))) { /* Add to a side list */
                assert(side_list_i <= nr_side_lists);

                if (cur_len > 1) {
                    struct selva_string *sl;

                    sl = ensure_side_list(side_list, side_list_i - 1);
                    /*
                     * `id` field is never added here. That's stupid but
                     * we assume this is a some sort of excluded_fields
                     * list.
                     */
                    (void)string_set_list_add(sl, SELVA_ID_FIELD, sizeof(SELVA_ID_FIELD) - 1, cur, cur_len);
                }
                /* Otherwise we ignore the empty element. */
            } else { /* Add to the regular list */
                const char *alias_end = memchr(cur, STRING_SET_ALIAS, cur_len);
                const char *alias_str = NULL;
                size_t alias_len = 0;

                if (alias_end) {
                    alias_str = cur;
                    alias_len = alias_end - alias_str;
                    cur = alias_end + 1;
                }

                size_t nr_el = 0;
                const char *cur_el = cur;
                do {
                    const char *next_el = cur_el;

                    /*
                     * Find the separator between the current and the next field name.
                     */
                    while (*next_el != STRING_SET_EOS && *next_el != STRING_SET_SEPARATOR_LIST && *next_el != STRING_SET_SEPARATOR_SET) {
                        next_el++;
                    }

                    const size_t el_len = (size_t)((ptrdiff_t)next_el - (ptrdiff_t)cur_el);
                    if (el_len > 0) { /* Skip empty elements. */
                        if (alias_str && alias_len) {
                            so_add_alias(obj, alias_str, alias_len, cur_el, el_len);
                        } else {
                            so_add_n(obj, n, cur_el, el_len);
                        }
                        nr_el++;
                    }

                    if (*next_el == STRING_SET_EOS || *next_el == STRING_SET_SEPARATOR_SET) {
                        break;
                    }
                    cur_el = next_el + 1;
                } while (*cur_el != STRING_SET_EOS);

                n++;
            }

            if (*next == STRING_SET_EOS) {
                break;
            }
            cur = next + 1;
        } while (*cur != STRING_SET_EOS);
    }

    *list_out = obj;

    for (size_t i = 0; i < nr_side_lists; i++) {
        struct selva_string *sl = side_list[i];

        if (sl) {
            *side_list_out[i] = sl;
            selva_string_auto_finalize(finalizer, sl);
        } else {
            *side_list_out[i] = NULL;
            selva_string_free(sl);
        }
    }

    return 0;
}
