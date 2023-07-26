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

static void side_list_add(struct selva_string *sl, const char *el_str, size_t el_len)
{
    const char sep[] = { STRING_SET_SEPARATOR_SET };
    const char *name_str = el_str + 1;
    const size_t name_len = el_len - 1;

    /* Ignore id field silently. */
    if (!(name_len == (sizeof(SELVA_ID_FIELD) - 1) && !memcmp(SELVA_ID_FIELD, name_str, name_len))) {
        (void)selva_string_append(sl, name_str, name_len);
        (void)selva_string_append(sl, sep, 1);
    }
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
    size_t side_list_inuse = 0;
    const char *cur = selva_string_to_str(raw_in, NULL);
    size_t n = 0;

#if 0
    struct selva_string *excl = NULL;
    size_t nr_excl = 0;
#endif

    assert(nr_side_lists == 0 || (nr_side_lists > 0 && side_list_out));

    for (size_t i  = 0; i < nr_side_lists; i++) {
        side_list[i] = selva_string_create("", 0, SELVA_STRING_MUTABLE);
    }

    if (cur[0] != STRING_SET_EOS) {
        do {
            const size_t key_len = (size_t)(log10(n + 1)) + 1;
            char key_str[key_len + 1];
            const char *next;
#if 0
            size_t len;
#endif

            snprintf(key_str, key_len + 1, "%zu", n);

            /*
             * Find the separator between the current and the next field name list.
             */
            next = cur;
            while (*next != STRING_SET_EOS && *next != STRING_SET_SEPARATOR_SET) {
                next++;
            }
            /*
             * len could be used for splitting in the do..while loop
             * but we are currently looking for the separator chars
             * there.
             */
#if 0
            len = (size_t)((ptrdiff_t)next - (ptrdiff_t)cur);
#endif

            /*
             * Create the set elements.
             */
            size_t nr_el = 0;
            const char *cur_el = cur;
            do {
                const char *next_el;
                size_t el_len;

                /*
                 * Find the separator between the current and the next field name.
                 */
                next_el = cur_el;
                while (*next_el != STRING_SET_EOS && *next_el != STRING_SET_SEPARATOR_LIST && *next_el != STRING_SET_SEPARATOR_SET) {
                    next_el++;
                }
                el_len = (size_t)((ptrdiff_t)next_el - (ptrdiff_t)cur_el);

                if (el_len > 0) { /* Skip empty elements. */
                    const size_t side_list_i = pick_side_list(side_list_prefixes, cur_el);

                    if (side_list_i) {
                        if (el_len > 1) {
                            struct selva_string *sl = side_list[side_list_i - 1];

                            side_list_add(sl, cur_el, el_len);
                            side_list_inuse |= side_list_i;
                        }
                        /* Otherwise we ignore the empty element. */
                    } else {
                        struct selva_string *el;

                        el = selva_string_create(cur_el, el_len, 0);

                        /*
                         * Add to the list.
                         */
                        SelvaObject_InsertArrayStr(obj, key_str, key_len, SELVA_OBJECT_STRING, el);
                        nr_el++;
                    }
                }

                if (*next_el == STRING_SET_EOS || *next_el == STRING_SET_SEPARATOR_SET) {
                    break;
                }
                cur_el = next_el + 1;
            } while (*cur_el != STRING_SET_EOS);

            /*
             * Increment the set index only if elements were inserted at the
             * index.
             */
            if (nr_el > 0) {
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

        if (side_list_inuse & (1 << i)) {
            *side_list_out[i] = sl;
            selva_string_auto_finalize(finalizer, sl);
        } else {
            *side_list_out[i] = NULL;
            selva_string_free(sl);
        }
    }

    return 0;
}
