/*
 * Copyright (c) 2022-2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "jemalloc.h"
#include "util/auto_free.h"
#include "util/cstrings.h"
#include "util/finalizer.h"
#include "util/selva_string.h"
#include "selva_error.h"
#include "selva_io.h"
#include "selva_log.h"
#include "selva_proto.h"
#include "selva_server.h"
#include "hierarchy.h"
#include "selva_db.h"
#include "selva_object.h"
#include "selva_onload.h"
#include "edge.h"

static void EdgeConstraint_Reply(struct selva_server_response_out *resp, void *p);
static void *so_load(struct selva_io *io, int encver, void *load_data);
static void so_save(struct selva_io *io, void *value, void *load_data);

#define DYN_CONSTRAINT_NAME_LEN(field_name_len) \
    (field_name_len)

static const struct SelvaObjectPointerOpts obj_opts = {
    .ptr_type_id = SELVA_OBJECT_POINTER_EDGE_CONSTRAINTS,
    .ptr_reply = EdgeConstraint_Reply,
    .ptr_free = NULL, /* We don't allow freeing constraints. */
    .ptr_len = NULL,
    .ptr_save = so_save,
    .ptr_load = so_load,
};
SELVA_OBJECT_POINTER_OPTS(obj_opts);

static inline struct SelvaObject *get_dyn_constraints(const struct EdgeFieldConstraints *efc) {
    return (struct SelvaObject *)(efc->dyn_constraints);
}

void Edge_InitEdgeFieldConstraints(struct EdgeFieldConstraints *efc) {
    memset(efc, 0, sizeof(*efc));
    SelvaObject_Init(efc->dyn_constraints, sizeof(efc->edge_constraint_emb_fields));
}

void Edge_DeinitEdgeFieldConstraints(struct EdgeFieldConstraints *efc) {
    SelvaObject_Destroy(get_dyn_constraints(efc));
    memset(efc, 0, sizeof(*efc));
}

/**
 * Make a dynamic constraint object field name.
 * [`ma`, `my.field`] => `ma.my:field`
 * @param buf should be a buffer with size DYN_CONSTRAINT_NAME_LEN(field_name_len)
 * @param node_type is a node type
 * @param field_name_str is a edge field name
 * @param field_name_len is the length of field_name_str without the terminating character
 */
static char *make_dyn_constraint_name(char *buf, const char *field_name_str, size_t field_name_len) {
    memcpy(buf, field_name_str, field_name_len);
    ch_replace(buf + SELVA_NODE_TYPE_SIZE + 1, field_name_len, '.', ':');

    return buf;
}

static size_t calc_params_field_len(const typeof_field(struct EdgeFieldDynConstraintParams, fwd_field_name) field_name)
{
    if (field_name[sizeof(typeof_field(struct EdgeFieldDynConstraintParams, fwd_field_name)) - 1] == '\0') {
        return strlen(field_name);
    } else {
        return sizeof(typeof_field(struct EdgeFieldDynConstraintParams, fwd_field_name));
    }
}

static struct EdgeFieldConstraint *create_constraint(const struct EdgeFieldDynConstraintParams *params) {
    const int is_bidir = !!(params->flags & EDGE_FIELD_CONSTRAINT_FLAG_BIDIRECTIONAL);
    size_t fwd_field_name_len = calc_params_field_len(params->fwd_field_name);
    const char *fwd_field_name_str = params->fwd_field_name;
    size_t bck_field_name_len = 0;
    const char *bck_field_name_str = NULL;
    struct EdgeFieldConstraint *p;

    if (is_bidir) {
        bck_field_name_len = calc_params_field_len(params->fwd_field_name);
        bck_field_name_str = params->bck_field_name;
    }

    p = selva_calloc(1,
            sizeof(*p) +
            fwd_field_name_len + bck_field_name_len + 2);
    if (!p) {
        return NULL;
    }

    /*
     * Set the string pointers.
     */
    p->field_name_str = (char *)p + sizeof(*p);
    p->bck_field_name_str = p->field_name_str + fwd_field_name_len + 1;

    p->flags = params->flags;
    memcpy(p->src_node_type, params->src_node_type, SELVA_NODE_TYPE_SIZE);

    p->field_name_len = fwd_field_name_len;
    memcpy(p->field_name_str, fwd_field_name_str, fwd_field_name_len);
    p->field_name_str[fwd_field_name_len] = '\0';

    /*
     * Copy the bck_field_name if the field is bidirectional.
     */
    if (is_bidir) {
        p->bck_field_name_len = bck_field_name_len;
        memcpy(p->bck_field_name_str, bck_field_name_str, bck_field_name_len);
        p->bck_field_name_str[bck_field_name_len] = '\0';
    }

    return p;
}

int Edge_NewDynConstraint(struct EdgeFieldConstraints *efc, const struct EdgeFieldDynConstraintParams *params) {
    size_t fwd_field_name_len = sizeof(params->fwd_field_name);
    const char *fwd_field_name_str = params->fwd_field_name;
    const size_t constraint_name_len = DYN_CONSTRAINT_NAME_LEN(fwd_field_name_len);
    char constraint_name_str[constraint_name_len];
    struct EdgeFieldConstraint *p;
    int err;

    make_dyn_constraint_name(constraint_name_str, fwd_field_name_str, fwd_field_name_len);

    err = SelvaObject_ExistsStr(get_dyn_constraints(efc), constraint_name_str, constraint_name_len);
    if (err != SELVA_ENOENT) {
        return err;
    }

    p = create_constraint(params);
    if (!p) {
        return SELVA_ENOMEM;
    }

    return SelvaObject_SetPointerStr(get_dyn_constraints(efc), constraint_name_str, constraint_name_len, p, &obj_opts);
}

const struct EdgeFieldConstraint *Edge_GetConstraint(
        const struct EdgeFieldConstraints *efc,
        const Selva_NodeType node_type,
        const char *field_name_str,
        size_t field_name_len) {
    const struct EdgeFieldConstraint *constraint = NULL;

    const size_t constraint_name_len = DYN_CONSTRAINT_NAME_LEN(field_name_len);
    char constraint_name_str[constraint_name_len];
    void *p = NULL;
    int err;

    make_dyn_constraint_name(constraint_name_str, field_name_str, field_name_len);
    err = SelvaObject_GetPointerStr(get_dyn_constraints(efc), constraint_name_str, constraint_name_len, &p);
    if (err) {
        SELVA_LOG(SELVA_LOGL_ERR,
                  "Failed to get a dynamic constraint. type: \"%.*s\" field_name: \"%.*s\" err: %s",
                  (int)SELVA_NODE_TYPE_SIZE, node_type,
                  (int)field_name_len, field_name_str,
                  selva_strerror(err));
    }

    constraint = p;

    return constraint;
}

static void EdgeConstraint_Reply(struct selva_server_response_out *resp, void *p) {
    const struct EdgeFieldConstraint *constraint = (struct EdgeFieldConstraint *)p;
    enum EdgeFieldConstraintFlag cflags = constraint->flags;
    const char cflags_str[] = {
        (cflags & EDGE_FIELD_CONSTRAINT_FLAG_SINGLE_REF)    ? 'S' : '-',
        (cflags & EDGE_FIELD_CONSTRAINT_FLAG_BIDIRECTIONAL) ? 'B' : '-',
        (cflags & EDGE_FIELD_CONSTRAINT_FLAG_ARRAY)         ? 'A' : '-',
    };

    selva_send_array(resp, 6);

    selva_send_str(resp, "flags", 5);
    selva_send_str(resp, cflags_str, sizeof(cflags_str));

    selva_send_str(resp, "field_name", 10);
    selva_send_str(resp, constraint->field_name_str, constraint->field_name_len);

    selva_send_str(resp, "bck_field_name", 14);
    selva_send_str(resp, constraint->bck_field_name_str, constraint->bck_field_name_len);
}

static void load_src_node_type(struct selva_io *io, Selva_NodeType type) {
    __selva_autofree const char *s;
    size_t len;

    s = selva_io_load_str(io, &len);
    if (len == SELVA_NODE_TYPE_SIZE) {
        memcpy(type, s, SELVA_NODE_TYPE_SIZE);
    } else {
        memset(type, '\0', SELVA_NODE_TYPE_SIZE);
    }
}

static void save_src_node_type(struct selva_io *io, const Selva_NodeType type) {
    selva_io_save_str(io, type, SELVA_NODE_TYPE_SIZE);
}

/**
 * Deserializer for SelvaObject ptr value.
 */
static void *so_load(struct selva_io *io, int encver __unused, void *load_data __unused) {
    struct EdgeFieldDynConstraintParams params = { 0 };
    struct EdgeFieldConstraint *constraint;
    struct selva_string *fwd_field;
    struct selva_string *bck_field;

    params.flags = selva_io_load_unsigned(io);
    load_src_node_type(io, params.src_node_type);

    fwd_field = selva_io_load_string(io);
    strncpy(params.fwd_field_name, selva_string_to_str(fwd_field, NULL), sizeof(params.fwd_field_name));
    selva_string_free(fwd_field);

    if (params.flags & EDGE_FIELD_CONSTRAINT_FLAG_BIDIRECTIONAL) {
        bck_field = selva_io_load_string(io);
        strncpy(params.bck_field_name, selva_string_to_str(bck_field, NULL), sizeof(params.bck_field_name));
        selva_string_free(bck_field);
    }

    constraint = create_constraint(&params);

    return constraint;
}

/**
 * Serializer for SelvaObject ptr value.
 */
static void so_save(struct selva_io *io, void *value, void *save_data __unused) {
    const struct EdgeFieldConstraint *constraint = (struct EdgeFieldConstraint *)value;

    selva_io_save_unsigned(io, constraint->flags);
    save_src_node_type(io, constraint->src_node_type);
    selva_io_save_str(io, constraint->field_name_str, constraint->field_name_len);
    if (constraint->flags & EDGE_FIELD_CONSTRAINT_FLAG_BIDIRECTIONAL) {
        selva_io_save_str(io, constraint->bck_field_name_str, constraint->bck_field_name_len);
    }
}

int EdgeConstraint_Load(struct selva_io *io, int encver, struct EdgeFieldConstraints *data) {
    if (!SelvaObjectTypeLoadTo(io, encver, get_dyn_constraints(data), NULL)) {
        return SELVA_ENOENT;
    }

    return 0;
}

void EdgeConstraint_Save(struct selva_io *io, const struct EdgeFieldConstraints *data) {
    SelvaObjectTypeSave(io, get_dyn_constraints(data), NULL);
}
