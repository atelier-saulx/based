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
#include "selva_proto.h"
#include "selva_server.h"
#include "selva_object.h"
#include "subscriptions.h"
#include "arg_parser.h"

int SelvaArgParser_IntOpt(ssize_t *value, const char *name, const struct selva_string *txt, const struct selva_string *num) {
    TO_STR(txt, num);
    char *end = NULL;

    if (strcmp(name, txt_str)) {
        return SELVA_ENOENT;
    }

    *value = strtoull(num_str, &end, 10);
    if (num_str == end) {
        return SELVA_EINVAL;
    }

    return 0;
}

int SelvaArgParser_StrOpt(const char **value, const char *name, const struct selva_string *arg_key, const struct selva_string *arg_val) {
    TO_STR(arg_key, arg_val);

    if (strcmp(name, arg_key_str)) {
        return SELVA_ENOENT;
    }

    if (value) {
        *value = arg_val_str;
    }

    return 0;
}

int SelvaArgsParser_StringList(
        struct finalizer *finalizer,
        selva_stringList *out,
        const char *name,
        const struct selva_string *arg_key,
        const struct selva_string *arg_val) {
    const char *cur;
    struct selva_string **list = NULL;
    size_t n = 1;
    int err;

    err = SelvaArgParser_StrOpt(&cur, name, arg_key, arg_val);
    if (err) {
        return err;
    }

    const size_t list_size = n * sizeof(struct selva_string *);
    list = selva_realloc(list, list_size);

    list[n - 1] = NULL;
    if (cur[0] != '\0') {
        do {
            struct selva_string *el;
            const char *next;
            size_t len;

            /*
             * Find the separator between the current and the next string.
             */
            next = cur;
            while (*next != '\0' && *next != '\n') {
                next++;
            }
            len = (size_t)((ptrdiff_t)next - (ptrdiff_t)cur);

            /*
             * Create a string.
             */
            el = selva_string_create(cur, len, 0);
            selva_string_auto_finalize(finalizer, el);

            /*
             * Set to the array.
             */
            list = selva_realloc(list, ++n * sizeof(struct selva_string *));
            list[n - 2] = el;
            list[n - 1] = NULL;

            if (*next == '\0') {
                break;
            }
            cur = next + 1;
        } while (*cur != '\0');
    }

    *out = list;
    return 0;
}

int SelvaArgParser_Enum(
        const struct SelvaArgParser_EnumType types[],
        const struct selva_string *arg) {
    size_t i = 0;
    TO_STR(arg);

    while (types[i].name) {
        if (!strcmp(types[i].name, arg_str)) {
            return types[i].id;
        }
        i++;
    }

    return SELVA_ENOENT;
}

int SelvaArgParser_NodeType(Selva_NodeType node_type, const struct selva_string *arg) {
    size_t len;
    const char *str = selva_string_to_str(arg, &len);

    if (len < SELVA_NODE_TYPE_SIZE) {
        return SELVA_EINVAL;
    }

    memcpy(node_type, str, sizeof(Selva_NodeType));
    return 0;
}

int SelvaArgParser_IndexHints(selva_stringList *out, struct selva_string **argv, int argc) {
    struct selva_string **list = NULL;
    int n = 0;

    for (int i = 0; i < argc; i += 2) {
        struct selva_string **new_list;

        if (n > FIND_INDICES_MAX_HINTS_FIND) {
            return SELVA_ENOBUFS;
        }

        if (i + 1 >= argc || strcmp("index", selva_string_to_str(argv[i], NULL))) {
            break;
        }

        const size_t list_size = ++n * sizeof(struct selva_string *);
        new_list = selva_realloc(list, list_size);

        list = new_list;
        list[n - 1] = argv[i + 1];
    }

    *out = list;
    return n;
}
