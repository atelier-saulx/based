/*
 * Copyright (c) 2024 SAULX
 * SPDX-License-Identifier: MIT
 */
#include <assert.h>
#include <node_api.h>
#include <stdint.h>
#include <stdlib.h>
#include "libdeflate.h"

static napi_value voidp2npointer(napi_env env, void *p)
{
    napi_value np;
    napi_status status;

    status = napi_create_bigint_uint64(env, (uint64_t)p, &np);
    assert(status == napi_ok);

    return np;
}

static void *npointer2voidp(napi_env env, napi_value np)
{
    uint64_t result;
    bool lossless;
    napi_status status;

    status = napi_get_value_bigint_uint64(env,
            np,
            &result,
            &lossless);
    assert(status == napi_ok);
    assert(lossless);

    return (void *)result;
}

static int get_args(napi_env env, napi_callback_info cbinfo, size_t *argc, napi_value *argv, bool vargs)
{
    const size_t rargc = *argc;
    napi_status status;

    status = napi_get_cb_info(env, cbinfo, argc, argv, NULL, NULL);
    if (status != napi_ok) {
        return -1;
    }

    if (!vargs && *argc != rargc) {
        return -1;
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

// newCompressor(compression_level): compressor
static napi_value new_compressor(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 1;
    napi_value argv[1];
    napi_status status;

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        napi_value result;
        napi_get_null(env, &result);
        return result;
    }

    int compression_level;

    status = napi_get_value_int32(env, argv[0], &compression_level);
    assert(status == napi_ok);

    return voidp2npointer(env, libdeflate_alloc_compressor(compression_level));
}

// newDecompressor(): decompressor
static napi_value new_decompressor(napi_env env, napi_callback_info)
{
    return voidp2npointer(env, libdeflate_alloc_decompressor());
}

// destroyCompressor(compressor)
static napi_value destroy_compressor(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 1;
    napi_value argv[1];
    napi_value result;

    napi_get_undefined(env, &result);

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return result;
    }

    libdeflate_free_compressor(npointer2voidp(env, argv[0]));
    return result;
}

// destroyDecompressor(decompressor)
static napi_value destroy_decompressor(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 1;
    napi_value argv[1];
    napi_value result;

    napi_get_undefined(env, &result);

    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return result;
    }

    libdeflate_free_decompressor(npointer2voidp(env, argv[0]));
    return result;
}

static size_t get_in(napi_env env, napi_value in, void **out, bool *must_free)
{
    napi_status status;
    bool result;
    char *buf;
    size_t len;

    status = napi_is_buffer(env, in, &result);
    assert(status == napi_ok);
    if (result) {
        status = napi_get_buffer_info(env, in, out, &len);
        assert(status == napi_ok);
        *must_free = false;
        goto out;
    }

    status = napi_get_value_string_utf8(env, in, NULL, 0, &len);
    buf = malloc(len + 1);
    status = napi_get_value_string_utf8(env, in, buf, len + 1, NULL);
    *out = buf;
    *must_free = true;

out:
    return len;
}

// compress(compressor, in, out: Buffer, off?: number): out
static napi_value compress(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 4;
    napi_value argv[4];
    napi_status status;
    napi_value null_p;

    napi_get_null(env, &null_p);
    err = get_args(env, info, &argc, argv, true);
    if (err || argc < 3) {
        return null_p;
    }

    void *in_buf;
    size_t in_len;
    bool must_free_in_buf = false;
    void *out_buf;
    size_t out_len;
    uint32_t off = 0;

    in_len = get_in(env, argv[1], &in_buf, &must_free_in_buf);
    status = napi_get_buffer_info(env, argv[2], &out_buf, &out_len);
    assert(status == napi_ok);
    if (argc >= 4) {
        status = napi_get_value_uint32(env, argv[3], &off);
        assert(status == napi_ok);
    }

    const size_t act_out_len = libdeflate_compress(npointer2voidp(env, argv[0]), in_buf, in_len, (char *)out_buf + (size_t)off, out_len - (size_t)off);

    if (must_free_in_buf) {
        free(in_buf);
    }

    return res2napi(env, act_out_len < in_len ? act_out_len : 0);
}

// decompress(decompressor, in: Buffer, out: Buffer): number
static napi_value decompress(napi_env env, napi_callback_info info)
{
    int err;
    size_t argc = 3;
    napi_value argv[3];
    napi_status status;
    napi_value null_p;

    napi_get_null(env, &null_p);
    err = get_args(env, info, &argc, argv, false);
    if (err) {
        return null_p;
    }

    void *in_buf;
    size_t in_len;
    void *out_buf;
    size_t out_len;

    status = napi_get_buffer_info(env, argv[1], &in_buf, &in_len);
    assert(status == napi_ok);
    status = napi_get_buffer_info(env, argv[2], &out_buf, &out_len);
    assert(status == napi_ok);

    const enum libdeflate_result dresult = libdeflate_decompress(
            npointer2voidp(env, argv[0]),
            in_buf, in_len,
            out_buf, out_len,
            NULL);
    return res2napi(env, dresult);
}

#define DECLARE_NAPI_METHOD(name, func){ name, 0, func, 0, 0, 0, napi_default, 0 }

static napi_value Init(napi_env env, napi_value exports) {
  napi_property_descriptor desc[] = {
      DECLARE_NAPI_METHOD("newCompressor", new_compressor),
      DECLARE_NAPI_METHOD("newDecompressor", new_decompressor),
      DECLARE_NAPI_METHOD("destroyCompressor", destroy_compressor),
      DECLARE_NAPI_METHOD("destroyDecompressor", destroy_decompressor),
      DECLARE_NAPI_METHOD("compress", compress),
      DECLARE_NAPI_METHOD("decompress", decompress),
  };
  napi_status status;

  status = napi_define_properties(env, exports, num_elem(desc), desc);
  assert(status == napi_ok);

  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
