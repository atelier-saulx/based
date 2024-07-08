const std = @import("std");
const c = @import("./c.zig");
const napi = @import("./napi.zig");

pub fn compress(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return compressInner(env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

fn compressInner(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    // const total_size = 100;

    const args = try napi.getArgs(3, env, info);
    const src = try napi.getBuffer("src", env, args[0]);
    const target = try napi.getBuffer("target", env, args[1]);
    const offset = try napi.getInt32("offset", env, args[2]);

    std.debug.print("elem? {any} {any} {d}\n", .{ src, target, offset });

    // _ = c.ZSTD_compress(@ptrCast(target.ptr), target.len, @ptrCast(src.ptr), src.len, 4);

    // c.

    // c.zstd

    // for (str) |elem| {
    // std.debug.print("elem? {}\n", .{elem});
    // }

    // std.compress.flate.deflate();

    // std.compress.zstd.

    // var data: ?*anyopaque = undefined;

    // var result: c.napi_value = undefined;
    // if (c.napi_create_buffer(env, total_size, &data, &result) != c.napi_ok) {
    //     return null;
    // }
    return null;
}
