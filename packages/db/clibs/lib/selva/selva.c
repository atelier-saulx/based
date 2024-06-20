/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <node_api.h>
#include "util/selva_string.h"
#include "selva_error.h"
#include "selva.h"
#include "db.h"
#include "update.h"
#include "fields.h"

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
        /* TODO */
    case SELVA_FIELD_TYPE_REFERENCE:
        /* TODO */
    case SELVA_FIELD_TYPE_REFERENCES:
        /* TODO */
        napi_get_undefined(env, &result);
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

    node_type_t type;
    void *p;
    const char *schema_buf;
    size_t schema_len;

    status = napi_get_value_uint32(env, argv[1], &type);
    assert(status == napi_ok);
    status = napi_get_buffer_info(env, argv[2], &p, &schema_len);
    schema_buf = p;
    assert(status == napi_ok);

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
    node_type_t type;
    node_id_t node_id;
    void *p;
    const char *buf;
    size_t len;

    status = napi_get_value_uint32(env, argv[1], &type);
    assert(status == napi_ok);
    status = napi_get_value_uint32(env, argv[2], &node_id);
    assert(status == napi_ok);
    static_assert(sizeof(node_id) == sizeof(uint32_t));
    status = napi_get_buffer_info(env, argv[3], &p, &len);
    buf = p;
    assert(status == napi_ok);

    struct SelvaTypeEntry *te;
    struct SelvaNode *node;

    te = db_get_type_by_index(db, type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    node = db_get_node(db, te, node_id, true);
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
    node_type_t type;
    void *p;
    const char *buf;
    size_t len;

    status = napi_get_value_uint32(env, argv[1], &type);
    assert(status == napi_ok);
    status = napi_get_buffer_info(env, argv[2], &p, &len);
    buf = p;
    assert(status == napi_ok);

    struct SelvaTypeEntry *te;

    te = db_get_type_by_index(db, type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    napi_value r = res2napi(env, update_batch(db, te, buf, len));

    return r;
}

// selva_db_get_field(db, type, node_id, field_idx): number
static napi_value selva_db_get_field(napi_env env, napi_callback_info info)
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
    node_type_t type;
    node_id_t node_id;
    uint32_t field_idx;

    status = napi_get_value_uint32(env, argv[1], &type);
    assert(status == napi_ok);
    status = napi_get_value_uint32(env, argv[2], &node_id);
    assert(status == napi_ok);
    static_assert(sizeof(node_id) == sizeof(uint32_t));
    status = napi_get_value_uint32(env, argv[3], &field_idx);
    assert(status == napi_ok);

    struct SelvaTypeEntry *te;
    struct SelvaNode *node;

    te = db_get_type_by_index(db, type);
    if (!te) {
        return res2napi(env, SELVA_EINTYPE);
    }

    node = db_get_node(db, te, node_id, false);
    if (!node) {
        return res2napi(env, SELVA_HIERARCHY_ENOENT); /* TODO New error codes */
    }

    struct SelvaFieldsAny any;
    err = selva_fields_get(node, field_idx, &any);
    if (err) {
        return res2napi(env, err);
    }

    return any2napi(env, &any);
}

#define DECLARE_NAPI_METHOD(name, func){ name, 0, func, 0, 0, 0, napi_default, 0 }

static napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor desc[] = {
      DECLARE_NAPI_METHOD("db_create", selva_db_create),
      DECLARE_NAPI_METHOD("db_destroy", selva_db_destroy),
      DECLARE_NAPI_METHOD("db_schema_create", selva_db_schema_create),
      DECLARE_NAPI_METHOD("db_update", selva_db_update),
      DECLARE_NAPI_METHOD("db_update_batch", selva_db_update_batch),
      DECLARE_NAPI_METHOD("db_get_field", selva_db_get_field),
  };
  napi_status status;

  status = napi_define_properties(env, exports, num_elem(desc), desc);
  assert(status == napi_ok);

  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
