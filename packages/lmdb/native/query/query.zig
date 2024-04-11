const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const std = @import("std");
const db = @import("../db.zig");

const mdbThrow = errors.mdbThrow;

pub fn getQuery(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getQueryInternal(env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
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

    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    const cursors = std.AutoHashMap([2]u8, ?*c.MDB_cursor).init(allocator);

    // const txn = try db.createTransaction();

    std.debug.print("\nCURSORS {any}", .{cursors});

    // loop trough the "main" dbi index including shards
    // prob want to make a function for this

    // var currentShard: u8 = 0;
    // const maxShards: u32 = @divFloor(last_id, 1_000_000);

    // this is only if oyu dont want to include the extra data
    // var results = std.ArrayList(u32).init(allocator);

    return null;
}
