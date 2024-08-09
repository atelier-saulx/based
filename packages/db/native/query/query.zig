const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const std = @import("std");
const db = @import("../lmdb/db.zig");
const getFields = @import("./include/include.zig").getFields;
const results = @import("./results.zig");
const QueryCtx = @import("./ctx.zig").QueryCtx;
const filter = @import("./filter/filter.zig").filter;
const dbSort = @import("../lmdb/sort.zig");

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

pub fn getQuerySortAsc(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getQueryInternal(3, env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

pub fn getQuerySortDesc(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getQueryInternal(4, env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

var queryId: u32 = 0;

fn getQueryInternal(
    comptime queryType: comptime_int,
    env: c.napi_env,
    info: c.napi_callback_info,
) !c.napi_value {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    var resultsList = std.ArrayList(results.Result).init(allocator);
    var currentShard: u16 = 0;

    queryId += 1;
    if (queryId > 4_000_000_000_000) {
        queryId = 0;
    }

    const ctx: QueryCtx = .{ .results = &resultsList, .id = queryId };

    _ = db.initReadTxn() catch |err| {
        std.log.err("Cannot init txn {any}", .{err});
    };

    _ = c.mdb_txn_renew(db.readTxn);

    var total_results: usize = 0;
    var total_size: usize = 0;

    if (queryType == 0) {
        // query no sort
        const args = try napi.getArgs(6, env, info);
        const conditions = try napi.getBuffer("conditions", env, args[0]);
        const typePrefix = try napi.getStringFixedLength("type", 2, env, args[1]);
        const last_id = try napi.getInt32("last_id", env, args[2]);
        const offset = try napi.getInt32("offset", env, args[3]);
        const limit = try napi.getInt32("limit", env, args[4]);
        const include = try napi.getBuffer("include", env, args[5]);
        var i: u32 = 1;
        // handle offset
        checkItem: while (i <= last_id and total_results < offset + limit) : (i += 1) {
            if (i > (@as(u32, currentShard + 1)) * 1_000_000) {
                currentShard += 1;
            }
            if (!filter(ctx, i, typePrefix, conditions, currentShard)) {
                continue :checkItem;
            }
            const size = try getFields(ctx, i, typePrefix, null, include, currentShard, 0);
            if (size > 0) {
                total_size += size;
                total_results += 1;
            }
        }
    } else if (queryType == 1) {
        // single id
        const args = try napi.getArgs(4, env, info);
        const conditions = try napi.getBuffer("conditions", env, args[0]);
        const typePrefix = try napi.getStringFixedLength("type", 2, env, args[1]);
        const id = try napi.getInt32("id", env, args[2]);
        const include = try napi.getBuffer("include", env, args[3]);
        currentShard = db.idToShard(id);
        if (filter(ctx, id, typePrefix, conditions, currentShard)) {
            const size = try getFields(ctx, id, typePrefix, null, include, currentShard, 0);
            if (size > 0) {
                total_size += size;
                total_results += 1;
            }
        }
    } else if (queryType == 2) {
        // ids list
        const args = try napi.getArgs(4, env, info);
        const conditions = try napi.getBuffer("conditions", env, args[0]);
        const typePrefix = try napi.getStringFixedLength("type", 2, env, args[1]);
        const ids = try napi.getBuffer("ids", env, args[2]);
        const include = try napi.getBuffer("include", env, args[3]);
        var i: u32 = 0;
        checkItem: while (i <= ids.len) : (i += 4) {
            const id = std.mem.readInt(u32, ids[i..][0..4], .little);
            currentShard = db.idToShard(id);
            if (!filter(ctx, id, typePrefix, conditions, currentShard)) {
                continue :checkItem;
            }
            const size = try getFields(ctx, id, typePrefix, null, include, currentShard, 0);
            if (size > 0) {
                total_size += size;
                total_results += 1;
            }
        }
    } else if (queryType == 3 or queryType == 4) {
        // query  sort
        const args = try napi.getArgs(7, env, info);
        const conditions = try napi.getBuffer("conditions", env, args[0]);
        const typePrefix = try napi.getStringFixedLength("type", 2, env, args[1]);
        // const last_id = try napi.getInt32("last_id", env, args[2]);
        _ = try napi.getInt32("last_id", env, args[2]);
        const offset = try napi.getInt32("offset", env, args[3]);
        const limit = try napi.getInt32("limit", env, args[4]);
        const include = try napi.getBuffer("include", env, args[5]);
        const sort = try napi.getBuffer("sort", env, args[6]);
        var sortIndex: ?dbSort.SortIndex = null;
        if (sort.len == 5) {
            const start = std.mem.readInt(u16, sort[2..][0..2], .little);
            const len = std.mem.readInt(u16, sort[2..][2..4], .little);
            sortIndex = dbSort.createOrGetSortIndex(
                typePrefix,
                sort[0],
                start,
                len,
                queryId,
            );
        } else {
            sortIndex = dbSort.createOrGetSortIndex(typePrefix, sort[0], 0, 0, queryId);
        }

        if (sortIndex != null) {
            var end: bool = false;
            var flag: c_uint = c.MDB_FIRST;
            if (queryType == 4) {
                flag = c.MDB_LAST;
            }
            var first: bool = true;

            checkItem: while (!end and total_results < offset + limit) {
                var k: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
                var v: c.MDB_val = .{ .mv_size = 0, .mv_data = null };
                errors.mdbCheck(c.mdb_cursor_get(sortIndex.?.cursor, &k, &v, flag)) catch {
                    end = true;
                    break;
                };
                if (first) {
                    first = false;
                    if (queryType == 4) {
                        flag = c.MDB_PREV;
                    } else {
                        flag = c.MDB_NEXT;
                    }
                }
                const id = std.mem.readInt(u32, @as([*]u8, @ptrCast(v.mv_data))[0..4], .little);
                currentShard = db.idToShard(id);
                if (!filter(ctx, id, typePrefix, conditions, currentShard)) {
                    continue :checkItem;
                }
                const size = try getFields(ctx, id, typePrefix, null, include, currentShard, 0);
                if (size > 0) {
                    total_size += size;
                    total_results += 1;
                }
            }
        }
    }

    _ = c.mdb_txn_reset(db.readTxn);

    return results.createResultsBuffer(ctx, env, total_size, total_results);
}
