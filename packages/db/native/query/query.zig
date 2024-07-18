const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const std = @import("std");
const db = @import("../db.zig");
const runCondition = @import("./conditions.zig").runConditions;
const fields = @import("./getFields.zig");
const results = @import("./results.zig");
const QueryCtx = @import("./ctx.zig").QueryCtx;

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
    const args = try napi.getArgs(8, env, info);
    const conditions = try napi.getBuffer("conditions", env, args[0]);
    const type_prefix = try napi.getStringFixedLength("type", 2, env, args[1]);
    const last_id = try napi.getInt32("last_id", env, args[2]);
    const offset = try napi.getInt32("offset", env, args[3]);
    const limit = try napi.getInt32("limit", env, args[4]);
    const include = try napi.getBuffer("include", env, args[5]);
    const includeMain = try napi.getBuffer("includeMain", env, args[6]);
    const includeSingleRefs = try napi.getBuffer("includeSingleRefs", env, args[7]);

    var i: u32 = offset + 1;
    var total_results: usize = 0;
    var total_size: usize = 0;

    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();

    const allocator = arena.allocator();

    var shards = std.AutoHashMap([5]u8, db.Shard).init(allocator);

    defer {
        var it = shards.iterator();
        while (it.next()) |shard| {
            db.closeShard(shard.value_ptr);
        }
    }

    var resultsList = std.ArrayList(results.Result).init(allocator);

    var ctx: QueryCtx = .{ .include = include, .includeSingleRefs = includeSingleRefs, .includeMain = includeMain, .type_prefix = type_prefix, .currentShard = 0, .shards = &shards, .txn = try db.createTransaction(true), .results = &resultsList };

    checkItem: while (i <= last_id and total_results < offset + limit) : (i += 1) {
        if (i > (@as(u32, ctx.currentShard + 1)) * 1_000_000) {
            ctx.currentShard += 1;
        }
        var fieldIndex: usize = 0;

        // fn for conditions
        while (fieldIndex < conditions.len) {
            const querySize: u16 = std.mem.readInt(
                u16,
                conditions[fieldIndex + 1 ..][0..2],
                .little,
            );
            const field = conditions[fieldIndex];
            const dbiName = db.createDbiName(type_prefix, field, @bitCast(ctx.currentShard));
            var shard = ctx.shards.get(dbiName);
            if (shard == null) {
                shard = db.openShard(true, dbiName, ctx.txn) catch null;
                if (shard != null) {
                    try ctx.shards.put(dbiName, shard.?);
                }
            }
            if (shard != null) {
                const query = conditions[fieldIndex + 3 .. fieldIndex + 3 + querySize];
                var k: c.MDB_val = .{ .mv_size = 4, .mv_data = null };
                k.mv_data = &i;
                var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
                errors.mdbCheck(c.mdb_cursor_get(shard.?.cursor, &k, &v, c.MDB_SET)) catch {
                    continue :checkItem;
                };
                if (!runCondition(@as([*]u8, @ptrCast(v.mv_data))[0..v.mv_size], query)) {
                    continue :checkItem;
                }
            } else {
                continue :checkItem;
            }
            fieldIndex += querySize + 3;
        }

        total_size += try fields.getFields(ctx, i, null);
        total_results += 1;
    }

    try errors.mdbCheck(c.mdb_txn_commit(ctx.txn));

    return results.createResultsBuffer(ctx, env, total_size, total_results);
}
