/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <string.h>
#include <sys/types.h>
#include "util/selva_string.h"
#include "util/svector.h"
#include "selva_object.h"
#include "parsers.h"
#include "traversal.h"
#include "../find.h"

int find_parse_fields(
        struct finalizer *fin,
        const struct selva_string *raw_in,
        struct SelvaObject **fields_out,
        struct selva_string **excluded_fields_out
) {
    int err;

    err = parse_string_set(fin, raw_in, fields_out,
            (char []){ STRING_SET_EXCL_PREFIX, '\0' },
            (struct selva_string **[]){ excluded_fields_out });
    if (err) {
        return err;
    }

    return 0;
}

int find_fields_contains(struct SelvaObject *fields, const char *field_name_str, size_t field_name_len)
{
    void *iterator;
    const SVector *vec;

    iterator = SelvaObject_ForeachBegin(fields);
    while ((vec = SelvaObject_ForeachValue(fields, &iterator, NULL, SELVA_OBJECT_ARRAY))) {
        struct SVectorIterator it;
        const struct selva_string *s;

        SVector_ForeachBegin(&it, vec);
        while ((s = SVector_Foreach(&it))) {
            TO_STR(s);

            if (s_len == field_name_len && !memcmp(s_str, field_name_str, s_len)) {
                return 1;
            }
        }
    }

    return 0;
}
