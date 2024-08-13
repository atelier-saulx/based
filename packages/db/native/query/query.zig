const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const std = @import("std");
const db = @import("../db/db.zig");
const getFields = @import("./include/include.zig").getFields;
const results = @import("./results.zig");
const QueryCtx = @import("./ctx.zig").QueryCtx;
const filter = @import("./filter/filter.zig").filter;
const sort = @import("../db/sort.zig");
const QueryTypes = @import("./queryTypes.zig");

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

pub fn getQueryIdsSortAsc(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getQueryInternal(5, env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

pub fn getQueryIdsSortDesc(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getQueryInternal(6, env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

inline fn getQueryInternal(
    comptime queryType: comptime_int,
    env: c.napi_env,
    info: c.napi_callback_info,
) !c.napi_value {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();

    var ctx: QueryCtx = .{
        .results = std.ArrayList(results.Result).init(allocator),
        .id = db.getQueryId(),
        .size = 0,
        .totalResults = 0,
    };

    const readTxn = try db.initReadTxn();
    errors.mdb(c.mdb_txn_renew(readTxn)) catch {};

    if (queryType == 0) {
        // query no sort
        const args = try napi.getArgs(6, env, info);
        const conditions = try napi.getBuffer("conditions", env, args[0]);
        const typeId = try napi.getStringFixedLength("type", 2, env, args[1]);
        const lastId = try napi.getInt32("last_id", env, args[2]);
        const offset = try napi.getInt32("offset", env, args[3]);
        const limit = try napi.getInt32("limit", env, args[4]);
        const include = try napi.getBuffer("include", env, args[5]);
        try QueryTypes.queryNonSort(&ctx, lastId, offset, limit, typeId, conditions, include);
    } else if (queryType == 1) {
        // single id
        const args = try napi.getArgs(4, env, info);
        const conditions = try napi.getBuffer("conditions", env, args[0]);
        const typeId = try napi.getStringFixedLength("type", 2, env, args[1]);
        const id = try napi.getInt32("id", env, args[2]);
        const include = try napi.getBuffer("include", env, args[3]);
        try QueryTypes.queryId(id, &ctx, typeId, conditions, include);
    } else if (queryType == 2) {
        // ids list
        const args = try napi.getArgs(4, env, info);
        const conditions = try napi.getBuffer("conditions", env, args[0]);
        const typeId = try napi.getStringFixedLength("type", 2, env, args[1]);
        const ids = try napi.getBuffer("ids", env, args[2]);
        const include = try napi.getBuffer("include", env, args[3]);
        try QueryTypes.queryIds(ids, &ctx, typeId, conditions, include);
    } else if (queryType == 3 or queryType == 4) {
        // query sorted
        const args = try napi.getArgs(7, env, info);
        const conditions = try napi.getBuffer("conditions", env, args[0]);
        const typeId = try napi.getStringFixedLength("type", 2, env, args[1]);
        const lastId = try napi.getInt32("last_id", env, args[2]);
        const offset = try napi.getInt32("offset", env, args[3]);
        const limit = try napi.getInt32("limit", env, args[4]);
        const include = try napi.getBuffer("include", env, args[5]);
        const sortBuffer = try napi.getBuffer("sort", env, args[6]);
        try QueryTypes.querySort(queryType, &ctx, lastId, offset, limit, typeId, conditions, include, sortBuffer);
    } else if (queryType == 5 or queryType == 6) {
        // query ids sorted
        const args = try napi.getArgs(8, env, info);
        const conditions = try napi.getBuffer("conditions", env, args[0]);
        const typeId = try napi.getStringFixedLength("type", 2, env, args[1]);
        const lastId = try napi.getInt32("last_id", env, args[2]);
        const offset = try napi.getInt32("offset", env, args[3]);
        const limit = try napi.getInt32("limit", env, args[4]);
        const ids = try napi.getBufferU32("ids", env, args[5]);
        const include = try napi.getBuffer("include", env, args[6]);
        const sortBuffer = try napi.getBuffer("sort", env, args[7]);
        try QueryTypes.queryIdsSort(
            queryType,
            ids,
            &ctx,
            typeId,
            conditions,
            include,
            lastId,
            sortBuffer,
            offset,
            limit,
        );
    }

    db.resetTxn(readTxn);
    return results.createResultsBuffer(&ctx, env);
}
