const c = @import("./c.zig");
const napi = @import("./napi.zig");
const std = @import("std");
const selva = @import("./selva.zig");

var compressor: ?*selva.libdeflate_compressor = null;
var decompressor: ?*selva.libdeflate_decompressor = null;

pub fn napi_finalize_hash(_: c.napi_env, finalize_data: ?*anyopaque, _: ?*anyopaque) callconv(.C) void {
    _ = selva.selva_hash_free_state(@ptrCast(finalize_data));
}

pub fn hashCreate(env: c.napi_env, _: c.napi_callback_info) callconv(.C) c.napi_value {
    const state = selva.selva_hash_create_state();
    var externalNapi: c.napi_value = undefined;

    _ = selva.selva_hash_reset(state);
    _ = c.napi_create_external(env, state, napi_finalize_hash, null, &externalNapi);

    return externalNapi;
}

pub fn hashReset(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(1, env, info) catch return null;
    const state = napi.get(*selva.selva_hash_state_t, env, args[0]) catch return null;

    _ = selva.selva_hash_reset(state);
    return null;
}

pub fn hashUpdate(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(2, env, info) catch return null;
    const state = napi.get(*selva.selva_hash_state_t, env, args[0]) catch return null;
    const buf = napi.get([]u8, env, args[1]) catch return null;

    _ = selva.selva_hash_update(state, buf.ptr, buf.len);
    return null;
}

pub fn hashDigest(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(2, env, info) catch return null;
    const state = napi.get(*selva.selva_hash_state_t, env, args[0]) catch return null;
    const buf = napi.get([]u8, env, args[1]) catch return null;

    const hash = selva.selva_hash_digest(state);
    @memcpy(buf, @as([*]const u8, @ptrCast(&hash))[0..16]);
    return null;
}

pub fn crc32(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(1, env, info) catch return null;
    const buf = napi.get([]u8, env, args[0]) catch return null;
    const value: u32 = selva.crc32c(0, buf.ptr, buf.len);
    var v: c.napi_value = undefined;
    _ = c.napi_create_uint32(env, value, &v);
    return v;
}

// TODO: compressor has to be per ctx else multi core unsafe
pub fn compress(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    if (compressor == null) {
        compressor = selva.libdeflate_alloc_compressor(3);
    }
    const args = napi.getArgs(3, env, info) catch {
        return null;
    };
    const output = napi.get([]u8, env, args[0]) catch {
        return null;
    };
    const offset = napi.get(u32, env, args[1]) catch {
        return null;
    };
    const stringSize = napi.get(u32, env, args[2]) catch {
        return null;
    };
    const input: []u8 = output[offset + stringSize .. offset + stringSize * 2];
    const o = selva.libdeflate_compress(
        compressor.?,
        @ptrCast(input.ptr),
        input.len,
        @ptrCast(output[offset..output.len].ptr),
        output.len,
    );
    var result: c.napi_value = null;
    _ = c.napi_create_uint32(env, @intCast(o), &result);
    return result;
}

// libdeflate_decompress(struct libdeflate_decompressor *decompressor,
// const void *in, size_t in_nbytes,
// void *out, size_t out_nbytes_avail,
// size_t *actual_out_nbytes_ret);

// compressor has to be per ctx else multi core unsafe
pub fn decompress(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    if (decompressor == null) {
        decompressor = selva.libdeflate_alloc_decompressor();
    }
    const args = napi.getArgs(4, env, info) catch {
        return null;
    };
    const input = napi.get([]u8, env, args[0]) catch {
        return null;
    };
    const output = napi.get([]u8, env, args[1]) catch {
        return null;
    };
    const offset = napi.get(u32, env, args[2]) catch {
        return null;
    };
    const len = napi.get(u32, env, args[3]) catch {
        return null;
    };
    _ = selva.libdeflate_decompress(
        decompressor,
        @ptrCast(input[offset .. offset + len].ptr),
        len,
        @ptrCast(output.ptr),
        output.len,
        null,
    );
    return null;
}
