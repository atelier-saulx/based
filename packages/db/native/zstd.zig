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
    const total_size = 100;

    const args = try napi.getArgs(1, env, info);

    const str = try napi.getBuffer("string", env, args[0]);

    std.debug.print("hello {any}", .{str});

    var data: ?*anyopaque = undefined;

    var result: c.napi_value = undefined;
    if (c.napi_create_buffer(env, total_size, &data, &result) != c.napi_ok) {
        return null;
    }
    return result;
}
