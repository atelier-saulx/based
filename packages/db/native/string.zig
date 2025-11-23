const napi = @import("./napi.zig");
const deflate = @import("./deflate.zig");
const utils = @import("./utils.zig");
const std = @import("std");
const selva = @import("./selva.zig").c;

const write = utils.write;
const copy = utils.copy;

pub fn napi_finalize_hash(_: napi.Env, finalize_data: ?*anyopaque, _: ?*anyopaque) callconv(.c) void {
    _ = selva.selva_hash_free_state(@ptrCast(finalize_data));
}

pub fn hashCreate(env: napi.Env, _: napi.Info) callconv(.c) napi.Value {
    const state = selva.selva_hash_create_state();
    var externalNapi: napi.Value = undefined;
    _ = selva.selva_hash_reset(state);
    _ = napi.c.napi_create_external(env, state, napi_finalize_hash, null, &externalNapi);
    return externalNapi;
}

pub fn hashReset(env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    const args = napi.getArgs(1, env, info) catch return null;
    const state = napi.get(*selva.selva_hash_state_t, env, args[0]) catch return null;
    _ = selva.selva_hash_reset(state);
    return null;
}

pub fn hashUpdate(env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    const args = napi.getArgs(2, env, info) catch return null;
    const state = napi.get(*selva.selva_hash_state_t, env, args[0]) catch return null;
    const buf = napi.get([]u8, env, args[1]) catch return null;
    _ = selva.selva_hash_update(state, buf.ptr, buf.len);
    return null;
}

pub fn hashDigest(env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    const args = napi.getArgs(2, env, info) catch return null;
    const state = napi.get(*selva.selva_hash_state_t, env, args[0]) catch return null;
    const buf = napi.get([]u8, env, args[1]) catch return null;
    const hash = selva.selva_hash_digest(state);
    copy(u8, buf, @as([*]const u8, @ptrCast(&hash))[0..16], 0);
    return null;
}

pub fn crc32(env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    const args = napi.getArgs(1, env, info) catch return null;
    const buf = napi.get([]u8, env, args[0]) catch return null;
    const value: u32 = selva.crc32c(0, buf.ptr, buf.len);
    var v: napi.Value = undefined;
    _ = napi.c.napi_create_uint32(env, value, &v);
    return v;
}

fn compressor_finalize(_: napi.Env, compressor: ?*anyopaque, _: ?*anyopaque) callconv(.c) void {
    deflate.destroyCompressor(@ptrCast(compressor));
}

// return queryId
pub fn createCompressor(napi_env: napi.Env, _: napi.Info) callconv(.c) napi.Value {
    const compressor = deflate.createCompressor(3) catch return null;
    var externalNapi: napi.Value = undefined;
    _ = napi.c.napi_create_external(napi_env, compressor, compressor_finalize, null, &externalNapi);
    return externalNapi;
}

fn decompressor_finalize(_: napi.Env, decompressor: ?*anyopaque, _: ?*anyopaque) callconv(.c) void {
    deflate.destroyDecompressor(@ptrCast(decompressor));
}

// var decompressor: ?*selva.libdeflate_decompressor = null;
pub fn createDecompressor(napi_env: napi.Env, _: napi.Info) callconv(.c) napi.Value {
    const decompressor = deflate.createDecompressor();
    var externalNapi: napi.Value = undefined;
    _ = napi.c.napi_create_external(napi_env, decompressor, decompressor_finalize, null, &externalNapi);
    return externalNapi;
}

pub fn compress(env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    const args = napi.getArgs(4, env, info) catch {
        return null;
    };
    const compressor = napi.get(?*deflate.Compressor, env, args[0]) catch {
        return null;
    };
    const output = napi.get([]u8, env, args[1]) catch return null;
    const offset = napi.get(u32, env, args[2]) catch return null;
    const stringSize = napi.get(u32, env, args[3]) catch return null;
    const input: []u8 = output[offset + stringSize .. offset + stringSize * 2];

    const o = deflate.compress(
        compressor.?,
        input,
        output[offset..output.len],
    );
    var result: napi.Value = null;
    _ = napi.c.napi_create_uint32(env, @intCast(o), &result);
    return result;
}

pub fn decompress(env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    const args = napi.getArgs(5, env, info) catch return null;
    const decompressor = napi.get(?*deflate.Decompressor, env, args[0]) catch return null;
    const input = napi.get([]u8, env, args[1]) catch return null;
    const output = napi.get([]u8, env, args[2]) catch return null;
    const offset = napi.get(u32, env, args[3]) catch return null;
    const len = napi.get(u32, env, args[4]) catch return null;
    deflate.decompress(decompressor.?, input[offset .. offset + len], output) catch return null;
    return null;
}

pub fn xxHash64(env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    const args = napi.getArgs(3, env, info) catch return null;
    const buf = napi.get([]u8, env, args[0]) catch return null;
    const target = napi.get([]u8, env, args[1]) catch return null;
    const offset = napi.get(u32, env, args[2]) catch return null;
    const hash = selva.XXH64(buf.ptr, buf.len, 0);
    write(usize, target, hash, offset);
    return null;
}

inline fn calcTypedArraySize(arrayType: napi.TypedArrayType, arrayLen: usize) usize {
    var size: usize = arrayLen;
    // TODO zig can't properly parse the enum napi.c.napi_typedarray_type
    switch (arrayType) {
        //c.napi_typedarray_type.napi_int8_array, napi.c.napi_typedarray_type.napi_uint8_array, napi.c.napi_typedarray_type.napi_uint8_clamped_array => {
        0, 1, 2 => {
            // NOP
        },
        //c.napi_typedarray_type.napi_int16_array, napi.c.napi_typedarray_type.napi_uint16_array => {
        3, 4 => {
            size *= 2;
        },
        //c.napi_typedarray_type.napi_int32_array, napi.c.napi_typedarray_type.napi_uint32_array, napi.c.napi_typedarray_type.napi_float32_array => {
        5, 6, 7 => {
            size *= 4;
        },
        //c.napi_typedarray_type.napi_float64_array, napi.c.napi_typedarray_type.napi_bigint64_array, napi.c.napi_typedarray_type.napi_biguint64_array => {
        8, 9, 10 => {
            size *= 8;
        },
        else => {
            // never
        },
    }

    return size;
}

pub fn equals(env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    const args = napi.getArgs(2, env, info) catch return null;
    const a = napi.get([]u8, env, args[0]) catch return null;
    const b = napi.get([]u8, env, args[1]) catch return null;
    if (selva.fast_memcmp(a.ptr, b.ptr, a.len) == true) {
        return args[1];
    } else {
        return null;
    }
}
