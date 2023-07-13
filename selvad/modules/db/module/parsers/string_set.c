/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
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

/* These could be constexpr if clang would have full C23 support. */
#define EXCL_PREFIX     '!'
#define SET_SEPARATOR   '\n'
#define LIST_SEPARATOR  '|'
#define EOS             '\0'

int parse_string_set(
        struct finalizer *finalizer,
        const struct selva_string *raw_in,
        struct SelvaObject **list_out,
        struct selva_string **excluded_out)
{
    struct SelvaObject *obj = SelvaObject_New();
    struct selva_string *excl = NULL;
    const char *cur = selva_string_to_str(raw_in, NULL);
    size_t n = 0;
    size_t nr_excl = 0;

    if (excluded_out) {
        excl = selva_string_create("", 0, SELVA_STRING_MUTABLE);
    }

    if (cur[0] != EOS) {
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
            while (*next != EOS && *next != SET_SEPARATOR) {
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
                while (*next_el != EOS && *next_el != LIST_SEPARATOR && *next_el != SET_SEPARATOR) {
                    next_el++;
                }
                el_len = (size_t)((ptrdiff_t)next_el - (ptrdiff_t)cur_el);

                if (el_len > 0) { /* Skip empty elements. */
                    if (excl && cur_el[0] == EXCL_PREFIX) {
                        if (el_len > 1) {
                            const char sep[] = { SET_SEPARATOR };
                            const char *name_str = cur_el + 1;
                            const size_t name_len = el_len - 1;

                            /* Ignore id field silently. */
                            if (!(name_len == (sizeof(SELVA_ID_FIELD) - 1) && !memcmp(SELVA_ID_FIELD, name_str, name_len))) {
                                if (selva_string_append(excl, name_str, name_len) ||
                                    selva_string_append(excl, sep, 1)) {
                                    goto fail;
                                }
                                nr_excl++;
                            }
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

                if (*next_el == EOS || *next_el == SET_SEPARATOR) {
                    break;
                }
                cur_el = next_el + 1;
            } while (*cur_el != EOS);

            /*
             * Increment the set index only if elements were inserted at the
             * index.
             */
            if (nr_el > 0) {
                n++;
            }

            if (*next == EOS) {
                break;
            }
            cur = next + 1;
        } while (*cur != EOS);
    }

    *list_out = obj;
    if (excluded_out && nr_excl > 0) {
        *excluded_out = excl;
        selva_string_auto_finalize(finalizer, excl);
    } else if (excluded_out) {
        *excluded_out = NULL;
        selva_string_free(excl);
    }
    return 0;
fail:
    if (obj) {
        SelvaObject_Destroy(obj);
    }
    if (excl) {
        selva_string_free(excl);
    }
    return SELVA_ENOMEM;
}
