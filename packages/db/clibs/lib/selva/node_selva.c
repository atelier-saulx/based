/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wmissing-prototypes"

#include <assert.h>
#include <node_api.h>
#include <stdio.h>
#include <string.h>
#include "util/selva_string.h"
#include "selva/fields.h"
#include "selva/filter.h"
#include "selva/find.h"
#include "selva/traverse.h"
#include "selva/types.h"
#include "selva_error.h"
#include "db.h"
#include "update.h"
#include "io.h"

static napi_valuetype selva_napi_get_nvaluetype(napi_env env, napi_value value)
{
    napi_status status;
    napi_valuetype type;

    status = napi_typeof(env, value, &type);
    assert(status == napi_ok);

    return type;
}

static bool selva_napi_is_null(napi_env env, napi_value value)
{
    napi_valuetype type = selva_napi_get_nvaluetype(env, value);

    return type == napi_null ||
           type == napi_undefined;
}

static bool selva_napi_is_function(napi_env env, napi_value value)
{
    return selva_napi_get_nvaluetype(env, value) == napi_function;
}

static napi_value db2npointer(napi_env env, struct SelvaDb *db)
{
    napi_value pointer;
    napi_status status;

    status = napi_create_bigint_uint64(env, (uint64_t)db, &pointer);
    assert(status == napi_ok);

    return pointer;
}

static struct SelvaDb *npointer2db(napi_env env, napi_value pointer)
{
    uint64_t result;
    bool lossless;
    napi_status status;

    status = napi_get_value_bigint_uint64(env,
            pointer,
            &result,
            &lossless);
    assert(status == napi_ok);
    assert(lossless);

    return (struct SelvaDb *)result;
}

static node_type_t selva_napi_get_node_type(napi_env env, napi_value value)
{
    uint32_t type;
    napi_status status;

    status = napi_get_value_uint32(env, value, &type);
    static_assert(sizeof(type) >= sizeof(node_type_t));
    assert(status == napi_ok);

    return (node_type_t)type;
}

static node_id_t selva_napi_get_node_id(napi_env env, napi_value value)
{
    uint32_t id;
    napi_status status;

    status = napi_get_value_uint32(env, value, &id);
    static_assert(sizeof(id) >= sizeof(node_id_t));
    assert(status == napi_ok);

    return (node_id_t)id;
}

static field_t selva_napi_get_field(napi_env env, napi_value value)
{
    uint32_t field_idx;
    napi_status status;

    status = napi_get_value_uint32(env, value, &field_idx);
    static_assert(sizeof(field_idx) >= sizeof(field_t));
    assert(status == napi_ok);

    return (field_t)field_idx;
}

static napi_value any2napi(napi_env env, struct SelvaFieldsAny *any)
{
    char buf[20 + 1 + 20 + 1];
    napi_value result;

    switch (any->type) {
    case SELVA_FIELD_TYPE_NULL:
        napi_get_null(env, &result);
        break;
    case SELVA_FIELD_TYPE_TIMESTAMP:
    case SELVA_FIELD_TYPE_CREATED:
    case SELVA_FIELD_TYPE_UPDATED:
        napi_create_int64(env, any->uint64, &result);
        break;
    case SELVA_FIELD_TYPE_NUMBER:
        napi_create_double(env, any->number, &result);
        break;
    case SELVA_FIELD_TYPE_INTEGER:
        napi_create_int32(env, any->integer, &result);
        break;
    case SELVA_FIELD_TYPE_UINT8:
        napi_create_uint32(env, any->uint8, &result);
        break;
    case SELVA_FIELD_TYPE_UINT32:
        napi_create_uint32(env, any->uint32, &result);
        break;
    case SELVA_FIELD_TYPE_UINT64:
        napi_create_bigint_uint64(env, any->uint64, &result);
        break;
    case SELVA_FIELD_TYPE_BOOLEAN:
        napi_get_boolean(env, any->boolean, &result);
        break;
    case SELVA_FIELD_TYPE_ENUM:
        napi_create_int32(env, any->enu, &result);
        break;
    case SELVA_FIELD_TYPE_STRING:
        /* TODO what if compressed? */
        do {
            size_t len;
            const char *str = selva_string_to_str(any->string, &len);

            napi_create_string_utf8(env, str, len, &result);
        } while (0);
        break;
    case SELVA_FIELD_TYPE_TEXT:
        /* TODO text field */
        napi_get_undefined(env, &result);
        break;
    case SELVA_FIELD_TYPE_REFERENCE:
        if (any->reference && any->reference->dst) {
            napi_create_string_utf8(env, buf, snprintf(buf, sizeof(buf) - 1, "%u:%u", any->reference->dst->type, any->reference->dst->node_id), &result);
        } else {
            napi_get_null(env, &result);
        }
        break;
    case SELVA_FIELD_TYPE_REFERENCES:
        if (any->references && any->references->refs) {
            napi_status status;

            status = napi_create_array_with_length(env, any->references->nr_refs, &result);
            assert(status == napi_ok);
            for (size_t i = 0; i < any->references->nr_refs; i++) {
                napi_value value;

                status = napi_create_string_utf8(env, buf, snprintf(buf, sizeof(buf) - 1, "%u:%u", any->references->refs[i].dst->type, any->references->refs[i].dst->node_id), &value);
                assert(status == napi_ok);
                status = napi_set_element(env, result, i, value);
                assert(status == napi_ok);
            }
        } else {
            napi_get_null(env, &result);
        }
        break;
    case SELVA_FIELD_TYPE_WEAK_REFERENCE:
        napi_create_string_utf8(env, buf, snprintf(buf, sizeof(buf) - 1, "%u:%u", any->weak_reference.dst_type, any->weak_reference.dst_id), &result);
        break;
    case SELVA_FIELD_TYPE_WEAK_REFERENCES:
        /* TODO weak ref */
        napi_get_null(env, &result);
        break;
    case SELVA_FIELD_TYPE_MICRO_BUFFER:
        /* TODO pass buffer */
        napi_get_null(env, &result);
        break;
    }

    return result;
}

static int get_args(napi_env env, napi_callback_info cbinfo, size_t *argc, napi_value *argv, bool vargs)
{
    const size_t rargc = *argc;
    napi_status status;

    status = napi_get_cb_info(env, cbinfo, argc, argv, NULL, NULL);
    if (status != napi_ok) {
        return SELVA_EINVAL;
    }

    if (!vargs && *argc != rargc) {
        return SELVA_EINVAL;
    }

    return 0;
}

static napi_value res2napi(napi_env env, int err)
{
    napi_status status;
    napi_value result;

    status = napi_create_int32(env, err, &result);
    assert(status == napi_ok);

    return result;
}

static napi_value node_db_create(napi_env env, napi_callback_info)
{
    return db2npointer(env, selva_db_create());
}

// node_db_destroy(db): number
static napi_value node_db_destroy(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 1;
    napi_value argv[1];

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return res2napi(env, err);
    }

    selva_db_destroy(npointer2db(env, argv[0]));
    return res2napi(env, 0);
}

// node_save(db, filename): number
static napi_value node_save(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 2;
    napi_value argv[2];
    napi_status status;

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return res2napi(env, err);
    }

    struct SelvaDb *db = npointer2db(env, argv[0]);
    if (!db) {
        return res2napi(env, SELVA_EINVAL);
    }

    char filename[255];
    size_t filename_len;
    status = napi_get_value_string_utf8(env, argv[1], filename, sizeof(filename), &filename_len);
    if (status != napi_ok) {
        return res2napi(env, SELVA_EINVAL);
    }

    return res2napi(env, io_dump_save_async(db, filename));
}

// node_load(filename): db
static napi_value node_load(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 1;
    napi_value argv[1];
    napi_status status;

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return res2napi(env, err);
    }

    char filename[255];
    size_t filename_len;
    status = napi_get_value_string_utf8(env, argv[0], filename, sizeof(filename), &filename_len);
    if (status != napi_ok) {
        return res2napi(env, SELVA_EINVAL);
    }

    struct SelvaDb *db;
    err = io_dump_load(filename, &db);
    if (err) {
        (void)napi_throw_error(env, selva_strerror(err), "Failed to load the db");
        return NULL;
    }

    return db2npointer(env, db);
}

// selva_db_schema_update(db, type, schema): number
static napi_value node_db_schema_create(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 3;
    napi_value argv[3];
    napi_status status;

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return res2napi(env, err);
    }

    node_type_t type = selva_napi_get_node_type(env, argv[1]);
    void *p;
    const char *schema_buf;
    size_t schema_len;

    status = napi_get_buffer_info(env, argv[2], &p, &schema_len);
    assert(status == napi_ok);
    schema_buf = p;

    return res2napi(env, selva_db_schema_create(npointer2db(env, argv[0]), type, schema_buf, schema_len));
}

// node_db_update(db, type, node_id, buf): number
static napi_value node_db_update(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 4;
    napi_value argv[4];
    napi_status status;

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return res2napi(env, err);
    }

    struct SelvaDb *db = npointer2db(env, argv[0]);
    node_type_t type = selva_napi_get_node_type(env, argv[1]);
    node_id_t node_id = selva_napi_get_node_id(env, argv[2]);
    void *p;
    const char *buf;
    size_t len;

    status = napi_get_buffer_info(env, argv[3], &p, &len);
    assert(status == napi_ok);
    buf = p;

    struct SelvaTypeEntry *te;
    struct SelvaNode *node;

    te = selva_get_type_by_index(db, type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }
    assert(te->type == type);

    node = selva_upsert_node(te, node_id);
    assert(node);

    return res2napi(env, (len > 0) ? update(db, te, node, buf, len) : 0);
}

// node_db_update_batch(db, type, buf): number
static napi_value node_db_update_batch(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 3;
    napi_value argv[3];
    napi_status status;

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return res2napi(env, err);
    }

    struct SelvaDb *db = npointer2db(env, argv[0]);
    node_type_t type = selva_napi_get_node_type(env, argv[1]);
    void *p;
    const char *buf;
    size_t len;

    status = napi_get_buffer_info(env, argv[2], &p, &len);
    assert(status == napi_ok);
    buf = p;

    struct SelvaTypeEntry *te;

    te = selva_get_type_by_index(db, type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    napi_value r = res2napi(env, update_batch(db, te, buf, len));

    return r;
}

// node_db_archive(db, type, buf): number
static napi_value node_db_archive(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 2;
    napi_value argv[2];

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return res2napi(env, err);
    }

    struct SelvaDb *db = npointer2db(env, argv[0]);
    node_type_t type = selva_napi_get_node_type(env, argv[1]);

    struct SelvaTypeEntry *te;

    te = selva_get_type_by_index(db, type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    selva_archive_type(te);

    return res2napi(env, 0);
}

// node_db_prefetch(db, type, buf): number
static napi_value node_db_prefetch(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 2;
    napi_value argv[2];

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return res2napi(env, err);
    }

    struct SelvaDb *db = npointer2db(env, argv[0]);
    node_type_t type = selva_napi_get_node_type(env, argv[1]);

    struct SelvaTypeEntry *te;

    te = selva_get_type_by_index(db, type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    selva_prefetch_type(te);

    return res2napi(env, 0);
}

// node_db_exists(db, type, node_id): boolean
static napi_value node_db_exists(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 3;
    napi_value argv[3];

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return res2napi(env, err);
    }

    struct SelvaDb *db = npointer2db(env, argv[0]);
    node_type_t type = selva_napi_get_node_type(env, argv[1]);
    node_id_t node_id = selva_napi_get_node_id(env, argv[2]);

    struct SelvaTypeEntry *te;
    struct SelvaNode *node;

    te = selva_get_type_by_index(db, type);
    assert(te->type == type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    napi_value result;
    napi_status status;

    node = selva_find_node(te, node_id);
    status = napi_get_boolean(env, !!node, &result);
    assert(status == napi_ok);

    return result;
}

// node_db_del_node(db, type, node_id): boolean
static napi_value node_db_del_node(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 3;
    napi_value argv[3];

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return res2napi(env, err);
    }

    struct SelvaDb *db = npointer2db(env, argv[0]);
    node_type_t type = selva_napi_get_node_type(env, argv[1]);
    node_id_t node_id = selva_napi_get_node_id(env, argv[2]);

    struct SelvaTypeEntry *te;
    struct SelvaNode *node;

    te = selva_get_type_by_index(db, type);
    assert(te->type == type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    napi_value result;
    napi_status status;

    node = selva_find_node(te, node_id);
    if (node) {
        selva_del_node(db, te, node);
    }

    status = napi_get_boolean(env, !!node, &result);
    assert(status == napi_ok);

    return result;
}

// node_db_set_field(db, type, node_id, field_idx, value): number
static napi_value node_db_set_field(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 5;
    napi_value argv[5];

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return res2napi(env, err);
    }

    struct SelvaDb *db = npointer2db(env, argv[0]);
    node_type_t type = selva_napi_get_node_type(env, argv[1]);
    node_id_t node_id = selva_napi_get_node_id(env, argv[2]);
    field_t field_idx = selva_napi_get_field(env, argv[3]);

    struct SelvaTypeEntry *te;
    struct SelvaNode *node;
    struct SelvaFieldSchema *fs;

    te = selva_get_type_by_index(db, type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    node = selva_upsert_node(te, node_id);
    fs = selva_get_fs_by_ns_field(&te->ns, field_idx);
    if (!fs) {
        return res2napi(env, SELVA_ENOENT);
    }

    void *p;
    size_t len;
    napi_status status = napi_get_buffer_info(env, argv[4], &p, &len);
    if (status != napi_ok) {
        return res2napi(env, SELVA_EGENERAL);
    }

    return res2napi(env, selva_fields_set(db, node, fs, p, len));
}

// node_db_get_field(db, type, node_id, field_idx): number
static napi_value node_db_get_field(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 4;
    napi_value argv[4];

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return res2napi(env, err);
    }

    struct SelvaDb *db = npointer2db(env, argv[0]);
    node_type_t type = selva_napi_get_node_type(env, argv[1]);
    node_id_t node_id = selva_napi_get_node_id(env, argv[2]);
    field_t field_idx = selva_napi_get_field(env, argv[3]);

    struct SelvaTypeEntry *te;
    struct SelvaNode *node;

    te = selva_get_type_by_index(db, type);
    assert(te->type == type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    node = selva_find_node(te, node_id);
    if (!node) {
        return res2napi(env, SELVA_HIERARCHY_ENOENT); /* TODO New error codes */
    }

    struct SelvaFieldsAny any = selva_fields_get2(&node->fields, field_idx);
    return any2napi(env, &any);
}

// node_db_get_field_p(db, node, field_idx): number
static napi_value node_db_get_field_p(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 2;
    napi_value argv[2];

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return res2napi(env, err);
    }

    /* FIXME Better typing solution */
    struct SelvaNode *node = (struct SelvaNode *)npointer2db(env, argv[0]);
    field_t field_idx = selva_napi_get_field(env, argv[1]);

    struct SelvaFieldsAny any = selva_fields_get2(&node->fields, field_idx);
    return any2napi(env, &any);
}

// node_db_del_field(db, type, node_id, field_idx): number
static napi_value node_db_del_field(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 4;
    napi_value argv[4];

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return res2napi(env, err);
    }

    struct SelvaDb *db = npointer2db(env, argv[0]);
    node_type_t type = selva_napi_get_node_type(env, argv[1]);
    node_id_t node_id = selva_napi_get_node_id(env, argv[2]);
    field_t field = selva_napi_get_field(env, argv[3]);

    struct SelvaTypeEntry *te;
    struct SelvaNode *node;

    te = selva_get_type_by_index(db, type);
    assert(te->type == type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    node = selva_find_node(te, node_id);
    if (!node) {
        return res2napi(env, SELVA_HIERARCHY_ENOENT); /* TODO New error codes */
    }

    struct SelvaFieldSchema *fs = selva_get_fs_by_ns_field(&selva_get_type_by_node(db, node)->ns, field);
    if (!fs) {
        return res2napi(env, SELVA_ENOENT);
    }

    return res2napi(env, selva_fields_del(db, node, fs));
}

// node_db_set_alias(db, type_id, node_id, alias): number
static napi_value node_db_set_alias(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 4;
    napi_value argv[4];

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return res2napi(env, err);
    }

    struct SelvaDb *db = npointer2db(env, argv[0]);
    node_type_t type = selva_napi_get_node_type(env, argv[1]);
    node_id_t node_id = selva_napi_get_node_id(env, argv[2]);

    void *p;
    size_t alias_len;
    const char *alias_str;
    napi_status status = napi_get_buffer_info(env, argv[3], &p, &alias_len);
    assert(status == napi_ok);
    alias_str = p;

    if (alias_str[alias_len - 1] != '\0') {
        return res2napi(env, SELVA_EINVAL);
    }

    struct SelvaTypeEntry *te = selva_get_type_by_index(db, type);
    assert(te->type == type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    selva_set_alias(te, node_id, alias_str);

    return res2napi(env, 0);
}

// node_db_del_alias(db, type_id, alias): number
static napi_value node_db_del_alias(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 3;
    napi_value argv[3];

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return res2napi(env, err);
    }

    struct SelvaDb *db = npointer2db(env, argv[0]);
    node_type_t type = selva_napi_get_node_type(env, argv[1]);

    void *p;
    size_t alias_len;
    const char *alias_str;
    napi_status status = napi_get_buffer_info(env, argv[2], &p, &alias_len);
    assert(status == napi_ok);
    alias_str = p;

    if (alias_str[alias_len - 1] != '\0') {
        return res2napi(env, SELVA_EINVAL);
    }

    struct SelvaTypeEntry *te = selva_get_type_by_index(db, type);
    assert(te->type == type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    selva_del_alias_by_name(te, alias_str);

    return res2napi(env, 0);
}

// node_db_get_alias(db, type_id, alias): number
static napi_value node_db_get_alias(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 3;
    napi_value argv[3];

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return res2napi(env, err);
    }

    struct SelvaDb *db = npointer2db(env, argv[0]);
    node_type_t type = selva_napi_get_node_type(env, argv[1]);

    void *p;
    size_t alias_len;
    const char *alias_str;
    napi_status status = napi_get_buffer_info(env, argv[2], &p, &alias_len);
    assert(status == napi_ok);
    alias_str = p;

    if (alias_str[alias_len - 1] != '\0') {
        return res2napi(env, SELVA_EINVAL);
    }

    struct SelvaTypeEntry *te = selva_get_type_by_index(db, type);
    assert(te->type == type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    const struct SelvaNode *node = selva_get_alias(te, alias_str);

    return res2napi(env, node->node_id);
}

struct node_cb_js_trampoline {
    napi_env env;
    napi_value this; /*!< js object. */
    napi_value func; /*!< js function. */
};

static int node_cb_js_trampoline(struct SelvaDb *, const struct SelvaTraversalMetadata *, struct SelvaNode *node, void *arg)
{
    struct node_cb_js_trampoline *ctx = (struct node_cb_js_trampoline *)arg;
    napi_status status;
    int argc = 3;
    napi_value argv[3];
    napi_value result;

    napi_create_int32(ctx->env, node->type, &argv[0]);
    napi_create_int32(ctx->env, node->node_id, &argv[1]);
    napi_create_bigint_uint64(ctx->env, (uint64_t)node, &argv[2]);

    status = napi_call_function(ctx->env, ctx->this, ctx->func, argc, argv, &result);

    bool is_pending;
    napi_is_exception_pending(ctx->env, &is_pending);
    if (is_pending) {
        return -1;
    }

    if (status != napi_ok) {
        const char *code = NULL;

        status = napi_throw_error(ctx->env, code, "Traverse callback failed");
        assert(status == napi_ok);
        return -1;
    }

    napi_valuetype result_type;

    status = napi_typeof(ctx->env, result, &result_type);
    if (status != napi_ok) {
        const char *code = NULL;

        status = napi_throw_error(ctx->env, code, "Failed the read the return value");
        assert(status == napi_ok);
        return -1;
    }

    if (result_type == napi_number) {
        int32_t res;

        status = napi_get_value_int32(ctx->env, result, &res);
        assert(status == napi_ok);

        return res;
    } else if (result_type == napi_null || result_type == napi_undefined) {
        return -1;
    } else {
        const char *code = NULL;

        /* TODO throw type error? */
        status = napi_throw_error(ctx->env, code, "Invalid return value type");
        assert(status == napi_ok);
        return -2;
    }
}

// node_traverse_field_bfs(db, type, node_id, cb: (type, nodeId, node) => number | null | undefined): number
static napi_value node_traverse_field_bfs(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 4;
    napi_value argv[4];

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return res2napi(env, err);
    }

    struct SelvaDb *db = npointer2db(env, argv[0]);
    node_type_t type = selva_napi_get_node_type(env, argv[1]);
    node_id_t node_id = selva_napi_get_node_id(env, argv[2]);

    if (!selva_napi_is_function(env, argv[3])) {
        return res2napi(env, SELVA_EINVAL);
    }

    struct SelvaTypeEntry *te;
    te = selva_get_type_by_index(db, type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    struct SelvaNode *node;
    node = selva_find_node(te, node_id);
    if (!node) {
        return res2napi(env, SELVA_HIERARCHY_ENOENT); /* TODO New error codes */
    }

    struct SelvaTraversalParam cb_wrap = {
        .node_cb = node_cb_js_trampoline,
        .node_arg = &(struct node_cb_js_trampoline){
            .env = env,
            .this = ({ napi_value this; napi_get_global(env, &this); this; }),
            .func = argv[3], /*!< js function. */
        },
    };

    err = selva_traverse_field_bfs(db, node, &cb_wrap);
    return res2napi(env, err);
}

struct selva_find_cb {
    napi_env env;
    uint8_t *result_buf;
    const size_t result_size; /*!< Total size of result_buf. */
    size_t result_len; /*!< Data length in result_buf. */
    size_t nr_results; /*!< Number of results written to result_buf i.e. number of succesful calls to selva_find_cb(). */
};

static bool result_buf_fits(struct selva_find_cb *args, size_t len)
{
    return args->result_len + len < args->result_size;
}

static void cpy2res(struct selva_find_cb *args, const void *src, size_t n)
{
    /*
     * This is not needed as long as the called makes this check.
     */
#if 0
    assert(result_buf_fits(cb, n));
#endif
    memcpy(args->result_buf + args->result_len, src, n);
    args->result_len += n;
}

static int selva_find_cb(struct SelvaDb *, const struct SelvaTraversalMetadata *, struct SelvaNode *node, void *arg)
{
    struct selva_find_cb *args = (struct selva_find_cb *)arg;

    if (args->result_size > 0) {
        if (!result_buf_fits(args, sizeof(node_id_t))) {
            return SELVA_TRAVERSAL_ABORT;
        }

        cpy2res(args, &node->node_id, sizeof(node->node_id));
        /* TODO Return fields */
    }

    args->nr_results++;
    return 0;
}

static const uint8_t *get_filter(napi_env env, napi_value value, size_t *len_out)
{
    napi_status status;

    if (!selva_napi_is_null(env, value)) {
        void *buf;

        status = napi_get_buffer_info(env, value, &buf, len_out);
        assert(status == napi_ok);

        return buf;
    }

    *len_out = 0;
    return NULL;
}

static const struct FindFields *get_find_fields(napi_env env, napi_value value)
{
    napi_status status;
    struct FindFields *fields = NULL;

    if (!selva_napi_is_null(env, value)) {
        void *buf;
        size_t len;

        status = napi_get_buffer_info(env, value, &buf, &len);
        assert(status == napi_ok);

        if ((len - 1) % 3 != 0) {
            return NULL;
        }

        if (buf && len > 0 && len >= *((uint8_t *)buf) * sizeof(typeof(fields->data[0]))) {
            fields = buf;
        }
    }

    return fields;
}

// node_find(db, type, node_id, fields, adj_filter | null, node_filter | null, limits, result): number
static napi_value node_find(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 8;
    napi_value argv[8];
    napi_status status;

    err = get_args(env, info, &argc, argv, true);
    if (err) {
        return res2napi(env, err);
    } else if (argc < 7) {
        return res2napi(env, SELVA_EINVAL);
    }

    struct SelvaDb *db = npointer2db(env, argv[0]);
    node_type_t type = selva_napi_get_node_type(env, argv[1]);
    node_id_t node_id = selva_napi_get_node_id(env, argv[2]);

    const struct FindFields *fields = get_find_fields(env, argv[3]);
    if (!fields) {
        return res2napi(env, SELVA_EINVAL);
    }

    size_t adj_filter_len;
    const uint8_t *adj_filter_buf = get_filter(env, argv[4], &adj_filter_len);

    size_t node_filter_len;
    const uint8_t *node_filter_buf = get_filter(env, argv[5], &node_filter_len);

    struct {
        int32_t skip;
        int32_t offset;
        int32_t limit;
    } __packed limits;
    void *limits_buf;
    size_t limits_len;
    status = napi_get_buffer_info(env, argv[6], &limits_buf, &limits_len);
    assert(status == napi_ok);
    if (limits_len != sizeof(limits)) {
        return res2napi(env, SELVA_EINVAL);
    }
    memcpy(&limits, limits_buf, sizeof(limits));

    void *result_buf = NULL;
    size_t result_len = 0;
    if (argc == 8) {
        status = napi_get_buffer_info(env, argv[7], &result_buf, &result_len);
        assert(status == napi_ok);
    }

    struct SelvaTypeEntry *te;
    te = selva_get_type_by_index(db, type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    struct SelvaNode *node;
    node = selva_find_node(te, node_id);
    if (!node) {
        return res2napi(env, SELVA_HIERARCHY_ENOENT); /* TODO New error codes */
    }

    struct SelvaFindParam cb_wrap = {
        .adjacent_filter = adj_filter_buf,
        .adjacent_filter_len = adj_filter_len,
        .node_filter = node_filter_buf,
        .node_filter_len = node_filter_len,
        .node_cb = selva_find_cb,
        .node_arg = &(struct selva_find_cb){
            .env = env,
            .result_buf = result_buf,
            .result_size = result_len,
            .result_len = 0,
        },
        .fields = fields,
        .skip = limits.skip,
        .offset = limits.offset,
        .limit = limits.limit,
    };

    err = selva_find(db, node, &cb_wrap);
    return res2napi(env, err ?: ((struct selva_find_cb *)cb_wrap.node_arg)->nr_results);
}

#define DECLARE_NAPI_METHOD(name, func){ name, 0, func, 0, 0, 0, napi_default, 0 }

static napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor desc[] = {
      DECLARE_NAPI_METHOD("db_create", node_db_create),
      DECLARE_NAPI_METHOD("db_destroy", node_db_destroy),
      DECLARE_NAPI_METHOD("db_save", node_save),
      DECLARE_NAPI_METHOD("db_load", node_load),
      DECLARE_NAPI_METHOD("db_schema_create", node_db_schema_create),
      DECLARE_NAPI_METHOD("db_update", node_db_update),
      DECLARE_NAPI_METHOD("db_update_batch", node_db_update_batch),
      DECLARE_NAPI_METHOD("db_archive", node_db_archive),
      DECLARE_NAPI_METHOD("db_prefetch", node_db_prefetch),
      DECLARE_NAPI_METHOD("db_exists", node_db_exists),
      DECLARE_NAPI_METHOD("db_del_node", node_db_del_node),
      DECLARE_NAPI_METHOD("db_set_field", node_db_set_field),
      DECLARE_NAPI_METHOD("db_get_field", node_db_get_field),
      DECLARE_NAPI_METHOD("db_get_field_p", node_db_get_field_p),
      DECLARE_NAPI_METHOD("db_del_field", node_db_del_field),
      DECLARE_NAPI_METHOD("db_set_alias", node_db_set_alias),
      DECLARE_NAPI_METHOD("db_del_alias", node_db_del_alias),
      DECLARE_NAPI_METHOD("db_get_alias", node_db_get_alias),
      DECLARE_NAPI_METHOD("traverse_field_bfs", node_traverse_field_bfs),
      DECLARE_NAPI_METHOD("find", node_find),
  };
  napi_status status;

  status = napi_define_properties(env, exports, num_elem(desc), desc);
  assert(status == napi_ok);

  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
#pragma GCC diagnostic pop
