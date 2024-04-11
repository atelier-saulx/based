const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const std = @import("std");
const db = @import("../db.zig");
const runCondition = @import("./conditions.zig").runConditions;

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
    var shards = std.AutoHashMap([3]u8, db.Shard).init(allocator);
    const txn = try db.createTransaction(true);

    // this is only if oyu dont want to include the extra data
    // var results = std.ArrayList(u32).init(allocator);

    // const maxShards: u32 = @divFloor(last_id, 1_000_000);
    var i: u32 = 1;
    var currentShard: u8 = 0;

    while (i <= last_id) : (i += 1) {
        if (i > (@as(u32, currentShard + 1)) * 1_000_000) {
            var it = shards.iterator();
            while (it.next()) |shard| {
                std.debug.print("CLOSE SHARD {any}", .{shard.value_ptr});
                db.closeShard(shard.value_ptr);
            }
            currentShard += 1;
        }

        var fieldIndex: usize = 0;
        while (fieldIndex < queries.len) {
            const querySize: u16 = std.mem.readInt(
                u16,
                queries[fieldIndex + 1 ..][0..2],
                .little,
            );
            const field = queries[fieldIndex];
            const shardKey = db.getShardKey(field, currentShard);
            var shard = shards.get(shardKey);

            std.debug.print("SHARD {s} {d}", .{ type_prefix, shardKey });

            if (shard == null) {
                shard = db.openShard(type_prefix, shardKey, txn) catch null;
                if (shard != null) {
                    try shards.put(shardKey, shard.?);
                }
            }

            // if (runCondition(@as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size], queries[fieldIndex + 3 .. x + 3 + querySize].ptr, querySize)) {
            //     total_results += 1;
            //     keys.append(i) catch return jsThrow(env, "OOM");
            // }

            fieldIndex += querySize + 3;
        }

        // const sKey = db.getShardKey();

        // shards.get()

        // Loop trough queries
        // all conditions!
        // get shard from hashmap
        // if ! exsit create shard

        // shards.get();

        // and break when rdy ofc
    }

    return null;
}
