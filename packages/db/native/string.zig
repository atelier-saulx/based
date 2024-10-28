const c = @import("./c.zig");
const napi = @import("./napi.zig");
const std = @import("std");
const selva = @import("./selva.zig");

var compressor: ?*selva.libdeflate_compressor = null;
var decompressor: ?*selva.libdeflate_decompressor = null;

// compressor has to be per ctx else multi core unsafe
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
