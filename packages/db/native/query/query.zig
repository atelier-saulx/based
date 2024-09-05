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
const QuerySort = @import("./types/sort.zig");
const Query = @import("./types/query.zig");

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

pub fn getQueryIdsSortAscLarge(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getQueryInternal(7, env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

pub fn getQueryIdsSortDescLarge(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getQueryInternal(8, env, info) catch |err| {
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
        .id = db.getQueryId(), // maybe unnecessary
        .size = 0,
        .totalResults = 0,
        .allocator = allocator,
    };

    if (queryType == 0) {
        // query no sort
        const args = try napi.getArgs(6, env, info);
        const conditions = try napi.get([]u8, env, args[0]);
        const typeId = try napi.get(u16, env, args[1]);
        const offset = try napi.get(u32, env, args[2]);
        const limit = try napi.get(u32, env, args[3]);
        const include = try napi.get([]u8, env, args[4]);
        try Query.query(&ctx, offset, limit, typeId, conditions, include);
    } else if (queryType == 1) {
        // single id
        const args = try napi.getArgs(4, env, info);
        const conditions = try napi.get([]u8, env, args[0]);
        const typeId = try napi.get(u16, env, args[1]);
        const id = try napi.get(u32, env, args[2]);
        const include = try napi.get([]u8, env, args[3]);
        try Query.queryId(id, &ctx, typeId, conditions, include);
    } else if (queryType == 2) {
        // ids list
        const args = try napi.getArgs(4, env, info);
        const conditions = try napi.get([]u8, env, args[0]);
        const typeId = try napi.get(u16, env, args[1]);
        const ids = try napi.get([]u8, env, args[2]);
        const include = try napi.get([]u8, env, args[3]);
        try Query.queryIds(ids, &ctx, typeId, conditions, include);
    } else if (queryType == 3 or queryType == 4) {
        // query sorted
        const args = try napi.getArgs(7, env, info);
        const conditions = try napi.get([]u8, env, args[0]);
        const typeId = try napi.get(u16, env, args[1]);
        const offset = try napi.get(u32, env, args[2]);
        const limit = try napi.get(u32, env, args[3]);
        const include = try napi.get([]u8, env, args[4]);
        const sortBuffer = try napi.get([]u8, env, args[5]);
        try QuerySort.querySort(queryType, &ctx, offset, limit, typeId, conditions, include, sortBuffer);
    } else if (queryType == 5 or queryType == 6) {
        // query ids sorted
        const args = try napi.getArgs(10, env, info);
        const conditions = try napi.get([]u8, env, args[0]);
        const typeId = try napi.get(u16, env, args[1]);
        const offset = try napi.get(u32, env, args[2]);
        const limit = try napi.get(u32, env, args[3]);
        const ids = try napi.get([]u32, env, args[4]);
        const include = try napi.get([]u8, env, args[5]);
        const sortBuffer = try napi.get([]u8, env, args[6]);
        const low = try napi.get(u32, env, args[7]);
        const high = try napi.get(u32, env, args[8]);
        try QuerySort.queryIdsSort(
            queryType,
            ids,
            &ctx,
            typeId,
            conditions,
            include,
            sortBuffer,
            offset,
            limit,
            low,
            high,
        );
    } else if (queryType == 7 or queryType == 8) {
        // query ids sorted > 512
        const args = try napi.getArgs(8, env, info);
        const conditions = try napi.get([]u8, env, args[0]);
        const typeId = try napi.get(u16, env, args[1]);
        const offset = try napi.get(u32, env, args[2]);
        const limit = try napi.get(u32, env, args[3]);
        const ids = try napi.get([]u32, env, args[4]);
        const include = try napi.get([]u8, env, args[5]);
        const sortBuffer = try napi.get([]u8, env, args[6]);
        try QuerySort.queryIdsSortBig(
            queryType,
            ids,
            &ctx,
            typeId,
            conditions,
            include,
            sortBuffer,
            offset,
            limit,
        );
    }

    return results.createResultsBuffer(&ctx, env);
}
