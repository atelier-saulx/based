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
#include "selva_error.h"
#include "selva.h"
#include "db.h"
#include "update.h"
#include "fields.h"
#include "traverse.h"
#include "find.h"
#include "filter.h"
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
            char buf[1 + 20 + 2 + 20 + 1];

            napi_create_string_utf8(env, buf, snprintf(buf, sizeof(buf) - 1, "t%uid%u", any->reference->dst->type, any->reference->dst->node_id), &result);
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
                char buf[1 + 20 + 2 + 20 + 1];
                napi_value value;

                status = napi_create_string_utf8(env, buf, snprintf(buf, sizeof(buf) - 1, "t%uid%u", any->references->refs[i].dst->type, any->references->refs[i].dst->node_id), &value);
                assert(status == napi_ok);
                status = napi_set_element(env, result, i, value);
                assert(status == napi_ok);
            }
        } else {
            napi_get_null(env, &result);
        }
        break;
    case SELVA_FIELD_TYPE_WEAK_REFERENCE:
        /* TODO weak ref */
        napi_get_null(env, &result);
        break;
    case SELVA_FIELD_TYPE_WEAK_REFERENCES:
        /* TODO weak ref */
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

static napi_value selva_db_create(napi_env env, napi_callback_info)
{
    return db2npointer(env, db_create());
}

// selva_db_destroy(db): number
static napi_value selva_db_destroy(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 1;
    napi_value argv[1];

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return res2napi(env, err);
    }

    db_destroy(npointer2db(env, argv[0]));
    return res2napi(env, 0);
}

static napi_value selva_db_save(napi_env env, napi_callback_info info)
{
    /* TODO save */
    return res2napi(env, SELVA_ENOTSUP);
}

static napi_value selva_db_load(napi_env env, napi_callback_info info)
{
    /* TODO load */
    return res2napi(env, SELVA_ENOTSUP);
}

// selva_db_schema_update(db, type, schema): number
static napi_value selva_db_schema_create(napi_env env, napi_callback_info info)
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

    return res2napi(env, db_schema_create(npointer2db(env, argv[0]), type, schema_buf, schema_len));
}

// selva_db_update(db, type, node_id, buf): number
static napi_value selva_db_update(napi_env env, napi_callback_info info)
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

    te = db_get_type_by_index(db, type);
    assert(te->type == type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    node = db_upsert_node(te, node_id);
    assert(node);

    return res2napi(env, update(db, te, node, buf, len));
}

// selva_db_update_batch(db, type, buf): number
static napi_value selva_db_update_batch(napi_env env, napi_callback_info info)
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

    te = db_get_type_by_index(db, type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    napi_value r = res2napi(env, update_batch(db, te, buf, len));

    return r;
}

// selva_db_archive(db, type, buf): number
static napi_value selva_db_archive(napi_env env, napi_callback_info info)
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
    node_type_t type = selva_napi_get_node_type(env, argv[1]);

    struct SelvaTypeEntry *te;

    te = db_get_type_by_index(db, type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    db_archive(te);

    return res2napi(env, 0);
}

// selva_db_prefetch(db, type, buf): number
static napi_value selva_db_prefetch(napi_env env, napi_callback_info info)
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
    node_type_t type = selva_napi_get_node_type(env, argv[1]);

    struct SelvaTypeEntry *te;

    te = db_get_type_by_index(db, type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    db_prefetch(te);

    return res2napi(env, 0);
}

// selva_db_get_field(db, type, node_id, field_idx): number
static napi_value selva_db_get_field(napi_env env, napi_callback_info info)
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

    te = db_get_type_by_index(db, type);
    assert(te->type == type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    node = db_find_node(te, node_id);
    if (!node) {
        return res2napi(env, SELVA_HIERARCHY_ENOENT); /* TODO New error codes */
    }

    struct SelvaFieldsAny any;
    err = selva_fields_get(&node->fields, field_idx, &any);
    if (err) {
        return res2napi(env, err);
    }

    return any2napi(env, &any);
}

// selva_db_get_field_p(db, node, field_idx): number
static napi_value selva_db_get_field_p(napi_env env, napi_callback_info info)
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

    struct SelvaFieldsAny any;
    err = selva_fields_get(&node->fields, field_idx, &any);
    if (err) {
        return res2napi(env, err);
    }

    return any2napi(env, &any);
}

// selva_db_set_alias(db, type_id, node_id, alias): number
static napi_value selva_db_set_alias(napi_env env, napi_callback_info info)
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

    struct SelvaTypeEntry *te = db_get_type_by_index(db, type);
    assert(te->type == type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    db_set_alias(te, node_id, alias_str);

    return res2napi(env, 0);
}

// selva_db_del_alias(db, type_id, alias): number
static napi_value selva_db_del_alias(napi_env env, napi_callback_info info)
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

    struct SelvaTypeEntry *te = db_get_type_by_index(db, type);
    assert(te->type == type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    db_del_alias_by_name(te, alias_str);

    return res2napi(env, 0);
}

// selva_db_get_alias(db, type_id, alias): number
static napi_value selva_db_get_alias(napi_env env, napi_callback_info info)
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

    struct SelvaTypeEntry *te = db_get_type_by_index(db, type);
    assert(te->type == type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    const struct SelvaNode *node = db_get_alias(te, alias_str);

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

// selva_traverse_field_bfs(db, type, node_id, cb: (type, nodeId, node) => number | null | undefined): number
static napi_value selva_traverse_field_bfs(napi_env env, napi_callback_info info)
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
    te = db_get_type_by_index(db, type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    struct SelvaNode *node;
    node = db_find_node(te, node_id);
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

    err = traverse_field_bfs(db, node, &cb_wrap);
    return res2napi(env, err);
}

struct selva_find_cb {
    napi_env env;
    napi_value result;
    size_t i;
};

static int selva_find_cb(struct SelvaDb *, const struct SelvaTraversalMetadata *, struct SelvaNode *node, void *arg)
{
    struct selva_find_cb *args = (struct selva_find_cb *)arg;
    napi_value value;

    //napi_create_uint32(args->env, node->node_id, &value);
    //napi_set_element(args->env, args->result, args->i++, value);
    args->i++;

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

        if (buf && len > 0 && len >= *((uint8_t *)buf) * sizeof(typeof(fields->data[0]))) {
            fields = buf;
        }
    }

    return fields;
}

// selva_find(db, type, node_id, fields, adj_filter | null, node_filter | null, limits): number
static napi_value selva_find(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 7;
    napi_value argv[7];
    napi_status status;

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return res2napi(env, err);
    }

    struct SelvaDb *db = npointer2db(env, argv[0]);
    node_type_t type = selva_napi_get_node_type(env, argv[1]);
    node_id_t node_id = selva_napi_get_node_id(env, argv[2]);

    const struct FindFields *fields = get_find_fields(env, argv[3]);
    size_t adj_filter_len;
    const uint8_t *adj_filter_buf = get_filter(env, argv[4], &adj_filter_len);
    size_t node_filter_len;
    const uint8_t *node_filter_buf = get_filter(env, argv[5], &node_filter_len);

    struct {
        ssize_t skip;
        ssize_t offset;
        ssize_t limit;
    } __packed limits;
    void *limits_buf;
    size_t limits_len;
    status = napi_get_buffer_info(env, argv[6], &limits_buf, &limits_len);
    assert(status == napi_ok);
    if (limits_len != sizeof(limits)) {
        return res2napi(env, SELVA_EINVAL);
    }
    memcpy(&limits, limits_buf, sizeof(limits));

    if (!fields) {
        return res2napi(env, SELVA_EINVAL);
    }

    struct SelvaTypeEntry *te;
    te = db_get_type_by_index(db, type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    struct SelvaNode *node;
    node = db_find_node(te, node_id);
    if (!node) {
        return res2napi(env, SELVA_HIERARCHY_ENOENT); /* TODO New error codes */
    }

    struct FindParam cb_wrap = {
        .adjacent_filter = adj_filter_buf,
        .adjacent_filter_len = adj_filter_len,
        .node_filter = node_filter_buf,
        .node_filter_len = node_filter_len,
        .node_cb = selva_find_cb,
        .node_arg = &(struct selva_find_cb){
            .env = env,
            //.result = ({ napi_value res; napi_create_array(env, &res); res; }),
        },
        .fields = fields,
        .skip = limits.skip,
        .offset = limits.offset,
        .limit = limits.limit,
    };

    err = find(db, node, &cb_wrap);
    //return (err) ? res2napi(env, err) : ((struct selva_find_cb *)cb_wrap.node_arg)->result;
    return (err) ? res2napi(env, err) : ({ napi_value res; napi_create_int32(env, ((struct selva_find_cb *)cb_wrap.node_arg)->i, &res); res; });
}

// selva_save(db, type, node_id, fields, adj_filter | null, node_filter | null): number
static napi_value selva_save(napi_env env, napi_callback_info info)
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

#define DECLARE_NAPI_METHOD(name, func){ name, 0, func, 0, 0, 0, napi_default, 0 }

static napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor desc[] = {
      DECLARE_NAPI_METHOD("db_create", selva_db_create),
      DECLARE_NAPI_METHOD("db_destroy", selva_db_destroy),
      DECLARE_NAPI_METHOD("db_save", selva_db_save),
      DECLARE_NAPI_METHOD("db_load", selva_db_load),
      DECLARE_NAPI_METHOD("db_schema_create", selva_db_schema_create),
      DECLARE_NAPI_METHOD("db_update", selva_db_update),
      DECLARE_NAPI_METHOD("db_update_batch", selva_db_update_batch),
      DECLARE_NAPI_METHOD("db_archive", selva_db_archive),
      DECLARE_NAPI_METHOD("db_prefetch", selva_db_prefetch),
      DECLARE_NAPI_METHOD("db_get_field", selva_db_get_field),
      DECLARE_NAPI_METHOD("db_get_field_p", selva_db_get_field_p),
      DECLARE_NAPI_METHOD("db_set_alias", selva_db_set_alias),
      DECLARE_NAPI_METHOD("db_del_alias", selva_db_del_alias),
      DECLARE_NAPI_METHOD("db_get_alias", selva_db_get_alias),
      DECLARE_NAPI_METHOD("traverse_field_bfs", selva_traverse_field_bfs),
      DECLARE_NAPI_METHOD("find", selva_find),
      DECLARE_NAPI_METHOD("save", selva_save),
  };
  napi_status status;

  status = napi_define_properties(env, exports, num_elem(desc), desc);
  assert(status == napi_ok);

  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
#pragma GCC diagnostic pop
