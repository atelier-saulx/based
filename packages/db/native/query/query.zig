const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const std = @import("std");
const db = @import("../db.zig");
const runCondition = @import("./conditions.zig").runConditions;

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

    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    var shards = std.AutoHashMap([3]u8, db.Shard).init(allocator);
    defer {
        var it = shards.iterator();
        while (it.next()) |shard| {
            db.closeShard(shard.value_ptr);
        }
    }
    const txn = try db.createTransaction(true);

    var results = std.ArrayList(u32).init(allocator);

    var i: u32 = offset + 1;
    var currentShard: u16 = 0;
    var total_results: usize = 0;

    checkItem: while (i <= last_id and total_results <= offset + limit) : (i += 1) {
        if (i > (@as(u32, currentShard + 1)) * 1_000_000) {
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
            const shardKey = db.getShardKey(field, @bitCast(currentShard));
            var shard = shards.get(shardKey);
            if (shard == null) {
                shard = db.openShard(true, type_prefix, shardKey, txn) catch null;
                if (shard != null) {
                    try shards.put(shardKey, shard.?);
                }
            }

            if (shard != null) {
                const query = queries[fieldIndex + 3 .. fieldIndex + 3 + querySize];

                var k: c.MDB_val = .{ .mv_size = 4, .mv_data = null };

                k.mv_data = &i;
                var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };

                errors.mdbCheck(c.mdb_cursor_get(shard.?.cursor, &k, &v, c.MDB_SET)) catch {
                    continue :checkItem;
                };

                // here put ASM
                if (runCondition(@as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size], query)) {} else {
                    continue :checkItem;
                }
            } else {
                continue :checkItem;
            }

            fieldIndex += querySize + 3;
        }

        total_results += 1;
        try results.append(i);
    }

    var data: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;

    if (c.napi_create_buffer(env, total_results * 4, &data, &result) != c.napi_ok) {
        return null;
    }

    var last_pos: usize = 0;
    for (results.items) |*key| {
        @memcpy(@as([*]u8, @ptrCast(data))[last_pos .. last_pos + 4], @as([*]u8, @ptrCast(key)));
        last_pos += 4;
    }

    // GET

    try errors.mdbCheck(c.mdb_txn_commit(txn));

    return result;
}
