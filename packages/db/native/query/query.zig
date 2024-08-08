const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const std = @import("std");
const db = @import("../db.zig");
const getFields = @import("./include/include.zig").getFields;
const results = @import("./results.zig");
const QueryCtx = @import("./ctx.zig").QueryCtx;
const filter = @import("./filter/filter.zig").filter;

pub fn getQuery(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getQueryInternal(0, env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

pub fn getQueryId(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getQueryInternal(1, env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

pub fn getQueryIds(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getQueryInternal(2, env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

var txnRead: ?*c.MDB_txn = null;

fn makeTxnOrGetTxn() ?*c.MDB_txn {
    if (txnRead != null) {
        errors.mdbCheck(c.mdb_txn_renew(txnRead)) catch {};
        return txnRead;
    }
    txnRead = db.createTransaction(true) catch null;
    return txnRead;
}

fn getQueryInternal(
    comptime idType: comptime_int,
    env: c.napi_env,
    info: c.napi_callback_info,
) !c.napi_value {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    var shards = std.AutoHashMap([5]u8, db.Shard).init(allocator);
    var resultsList = std.ArrayList(results.Result).init(allocator);
    var currentShard: u16 = 0;
    // const txn = try db.createTransaction(true);
    const ctx: QueryCtx = .{ .shards = &shards, .txn = makeTxnOrGetTxn(), .results = &resultsList };
    defer {
        var it = shards.iterator();
        while (it.next()) |shard| {
            db.closeShard(shard.value_ptr);
        }
        _ = c.mdb_txn_reset(ctx.txn);
    }

    // _ = c.mdb_txn_renew(ctx.txn);

    var total_results: usize = 0;
    var total_size: usize = 0;

    if (idType == 0) {
        const args = try napi.getArgs(6, env, info);
        const conditions = try napi.getBuffer("conditions", env, args[0]);
        const type_prefix = try napi.getStringFixedLength("type", 2, env, args[1]);
        const last_id = try napi.getInt32("last_id", env, args[2]);
        const offset = try napi.getInt32("offset", env, args[3]);
        const limit = try napi.getInt32("limit", env, args[4]);
        const include = try napi.getBuffer("include", env, args[5]);
        var i: u32 = offset + 1;
        checkItem: while (i <= last_id and total_results < offset + limit) : (i += 1) {
            if (i > (@as(u32, currentShard + 1)) * 1_000_000) {
                currentShard += 1;
            }
            if (!filter(ctx, i, type_prefix, conditions, currentShard)) {
                continue :checkItem;
            }
            const size = try getFields(ctx, i, type_prefix, null, include, currentShard, 0);
            if (size > 0) {
                total_size += size;
                total_results += 1;
            }
        }
    } else if (idType == 1) {
        // TODO: this is super slow!
        // for indivdual ids its best to combine multiple into 1
        const args = try napi.getArgs(4, env, info);
        const conditions = try napi.getBuffer("conditions", env, args[0]);
        const type_prefix = try napi.getStringFixedLength("type", 2, env, args[1]);
        const id = try napi.getInt32("id", env, args[2]);
        const include = try napi.getBuffer("include", env, args[3]);
        currentShard = db.idToShard(id);
        if (filter(ctx, id, type_prefix, conditions, currentShard)) {
            const size = try getFields(ctx, id, type_prefix, null, include, currentShard, 0);
            if (size > 0) {
                total_size += size;
                total_results += 1;
            }
        }
    } else if (idType == 2) {
        const args = try napi.getArgs(4, env, info);
        const conditions = try napi.getBuffer("conditions", env, args[0]);
        const type_prefix = try napi.getStringFixedLength("type", 2, env, args[1]);
        const ids = try napi.getBuffer("ids", env, args[2]);
        const include = try napi.getBuffer("include", env, args[3]);
        // ids
        var i: u32 = 0;
        checkItem: while (i <= ids.len) : (i += 4) {
            const id = std.mem.readInt(u32, ids[i..][0..4], .little);
            currentShard = db.idToShard(id);
            if (!filter(ctx, id, type_prefix, conditions, currentShard)) {
                continue :checkItem;
            }
            const size = try getFields(ctx, id, type_prefix, null, include, currentShard, 0);
            if (size > 0) {
                total_size += size;
                total_results += 1;
            }
        }
    }

    // try errors.mdbCheck(c.mdb_txn_commit(ctx.txn));

    return results.createResultsBuffer(ctx, env, total_size, total_results);
}
