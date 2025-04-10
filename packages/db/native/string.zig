const c = @import("./c.zig");
const napi = @import("./napi.zig");
const std = @import("std");
const selva = @import("./selva.zig");
const writeInt = @import("./utils.zig").writeInt;
const copy = @import("./utils.zig").copy;

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
    copy(buf, @as([*]const u8, @ptrCast(&hash))[0..16]);
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

fn compressor_finalize(_: c.napi_env, compressor: ?*anyopaque, _: ?*anyopaque) callconv(.C) void {
    selva.libdeflate_free_compressor(@ptrCast(compressor));
}

// return queryId
pub fn createCompressor(napi_env: c.napi_env, _: c.napi_callback_info) callconv(.C) c.napi_value {
    const compressor: *selva.libdeflate_compressor = selva.libdeflate_alloc_compressor(3).?;
    var externalNapi: c.napi_value = undefined;
    _ = c.napi_create_external(napi_env, compressor, compressor_finalize, null, &externalNapi);
    return externalNapi;
}

fn decompressor_finalize(_: c.napi_env, decompressor: ?*anyopaque, _: ?*anyopaque) callconv(.C) void {
    selva.libdeflate_free_decompressor(@ptrCast(decompressor));
}

// var decompressor: ?*selva.libdeflate_decompressor = null;
pub fn createDecompressor(napi_env: c.napi_env, _: c.napi_callback_info) callconv(.C) c.napi_value {
    const decompressor: *selva.libdeflate_decompressor = selva.libdeflate_alloc_decompressor().?;
    var externalNapi: c.napi_value = undefined;
    _ = c.napi_create_external(napi_env, decompressor, decompressor_finalize, null, &externalNapi);
    return externalNapi;
}

pub fn compress(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(4, env, info) catch {
        return null;
    };

    // const dbCtx = try napi.get(*db.DbCtx, env, args[0]);

    const compressor = napi.get(?*selva.libdeflate_compressor, env, args[0]) catch {
        return null;
    };

    const output = napi.get([]u8, env, args[1]) catch {
        return null;
    };
    const offset = napi.get(u32, env, args[2]) catch {
        return null;
    };
    const stringSize = napi.get(u32, env, args[3]) catch {
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
    const args = napi.getArgs(5, env, info) catch {
        return null;
    };
    const decompressor = napi.get(?*selva.libdeflate_decompressor, env, args[0]) catch {
        return null;
    };
    const input = napi.get([]u8, env, args[1]) catch {
        return null;
    };
    const output = napi.get([]u8, env, args[2]) catch {
        return null;
    };
    const offset = napi.get(u32, env, args[3]) catch {
        return null;
    };
    const len = napi.get(u32, env, args[4]) catch {
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

pub fn xxHash64(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(3, env, info) catch return null;
    const buf = napi.get([]u8, env, args[0]) catch return null;
    const target = napi.get([]u8, env, args[1]) catch return null;
    const offset = napi.get(u32, env, args[2]) catch return null;
    const hash = selva.xxHash64(buf.ptr, buf.len);
    writeInt(usize, target, offset, hash);
    return null;
}

inline fn calcTypedArraySize(arrayType: c.napi_typedarray_type, arrayLen: usize) usize {
    var size: usize = arrayLen;
    // TODO zig can't properly parse the enum c.napi_typedarray_type
    switch (arrayType) {
        //c.napi_typedarray_type.napi_int8_array, c.napi_typedarray_type.napi_uint8_array, c.napi_typedarray_type.napi_uint8_clamped_array => {
        0, 1, 2 => {
            // NOP
        },
        //c.napi_typedarray_type.napi_int16_array, c.napi_typedarray_type.napi_uint16_array => {
        3, 4 => {
            size *= 2;
        },
        //c.napi_typedarray_type.napi_int32_array, c.napi_typedarray_type.napi_uint32_array, c.napi_typedarray_type.napi_float32_array => {
        5, 6, 7 => {
            size *= 4;
        },
        //c.napi_typedarray_type.napi_float64_array, c.napi_typedarray_type.napi_bigint64_array, c.napi_typedarray_type.napi_biguint64_array => {
        8, 9, 10 => {
            size *= 8;
        },
        else => {
            // never
        },
    }

    return size;
}

pub fn equals(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(2, env, info) catch return null;
    const a = napi.get([]u8, env, args[0]) catch return null;
    const b = napi.get([]u8, env, args[1]) catch return null;
    if (selva.fast_memcmp(a.ptr, b.ptr, a.len) == true) {
        return args[1];
    } else {
        return null;
    }
}

pub fn base64encode(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    const args = napi.getArgs(3, env, info) catch return null;
    const dst = napi.get([]u8, env, args[0]) catch return null;
    const src = napi.get([]u8, env, args[1]) catch return null;
    const lineMax = napi.get(u32, env, args[2]) catch return null;
    _ = selva.base64_encode_s(dst.ptr, src.ptr, src.len, lineMax);
    return args[0];
}
