/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include "jemalloc.h"
#include "util/selva_string.h"
#include "selva_error.h"
#include "arg_parser.h"

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
