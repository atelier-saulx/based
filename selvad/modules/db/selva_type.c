/*
 * Copyright (c) 2022-2023 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "util/selva_string.h"
#include "selva_error.h"
#include "selva_db.h"

struct protected_field {
    const char * const name;
    size_t len;
    /**
     * Type of the protected field represented as a SelvaObject type.
     * This is only a "rough" typing as some fields are not even stored in
     * the node data SelvaObject and set fields have subtype too.
     */
    enum SelvaObjectType type;
    enum selva_field_prot_mode en_mode;
};

#define PROT_FIELD(fname, otype, mode) \
    { .name = (fname), .len = sizeof(fname) - 1, .type = (otype), .en_mode = (mode) }

static const struct protected_field protected_fields[] = {
    PROT_FIELD(SELVA_ID_FIELD, SELVA_OBJECT_STRING, 0),
    PROT_FIELD(SELVA_TYPE_FIELD, SELVA_OBJECT_STRING, 0),
    PROT_FIELD(SELVA_ALIASES_FIELD, SELVA_OBJECT_SET, SELVA_FIELD_PROT_WRITE | SELVA_FIELD_PROT_DEL),
    PROT_FIELD(SELVA_CREATED_AT_FIELD, SELVA_OBJECT_LONGLONG, SELVA_FIELD_PROT_WRITE),
    PROT_FIELD(SELVA_UPDATED_AT_FIELD, SELVA_OBJECT_LONGLONG, SELVA_FIELD_PROT_WRITE),
};
static __nonstring char prot_bloom[num_elem(protected_fields)];

int selva_field_prot_check(const struct selva_string *s, enum SelvaObjectType type, enum selva_field_prot_mode mode)
{
    TO_STR(s);

    return selva_field_prot_check_str(s_str, s_len, type, mode);
}

int selva_field_prot_check_str(const char *field_str, size_t field_len, enum SelvaObjectType type, enum selva_field_prot_mode mode)
{
    int res = 1;

    if (field_len > 0 && memchr(prot_bloom, field_str[0], num_elem(prot_bloom))) {
        for (size_t i = 0; i < num_elem(protected_fields); i++) {
            const struct protected_field *pf = &protected_fields[i];

            if (field_len == pf->len && !memcmp(field_str, pf->name, field_len)) {
                /* mode should be just one of the options but we don't verify it. */
                if (!(mode & pf->en_mode) ||
                    (!(mode & SELVA_FIELD_PROT_DEL) && type != pf->type)) {
                    res = 0;
                }
                break;
            }
        }
    }

    return res;
}

/*
 * Technically a nodeId is always 10 bytes but sometimes a printable
 * representation without padding zeroes is needed.
 */
size_t Selva_NodeIdLen(const Selva_NodeId nodeId)
{
    size_t len = SELVA_NODE_ID_SIZE;

    while (len >= 1 && nodeId[len - 1] == '\0') {
        len--;
    }

    return len;
}

int selva_string2node_id(Selva_NodeId nodeId, const struct selva_string *s)
{
    TO_STR(s);
    int err = 0;

    if (s_len < SELVA_NODE_TYPE_SIZE + 1 || s_len > SELVA_NODE_ID_SIZE) {
        return SELVA_EINVAL;
    }

    /*
     * This may look fancy but if there is no `return` inside the loop
     * then the compiler can unroll the loop.
     */
    for (int i = 0; i <= SELVA_NODE_TYPE_SIZE; i++) {
        if (s_str[i] == '\0') {
            err = SELVA_EINVAL;
        }
    }

    if (!err) {
        Selva_NodeIdCpy(nodeId, s_str);
    }

    return err;
}

__constructor static void init_selva_type(void)
{
    for (size_t i = 0; i < num_elem(protected_fields); i++) {
        prot_bloom[i] = protected_fields[i].name[0];
    }
}
