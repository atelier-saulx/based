const c = @import("../c.zig");
const errors = @import("../errors.zig");
const jsThrow = errors.jsThrow;
const napi = @import("../napi.zig");
const std = @import("std");

pub fn getQuery(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getQueryInternal(env, info) catch return null;
}

fn getQueryInternal(
    env: c.napi_env,
    info: c.napi_callback_info,
) !c.napi_value {
    const args = try napi.getArgs(5, env, info);
    const queries = try napi.getBuffer("queries", env, args[0]);
    const type_prefix = try napi.getStringFixedLength("type", 2, env, args[1]);
    const last_id = try napi.getInt32("last_id", env, args[2]);
    const offset = try napi.getInt32("offset", env, args[3]);
    const limit = try napi.getInt32("limit", env, args[4]);

    std.debug.print("\nflap {any}", .{queries});
    std.debug.print("\ntype_prefix {s}", .{type_prefix});
    std.debug.print("\numbers {d} {d} {d}", .{ last_id, offset, limit });

    return null;
}
