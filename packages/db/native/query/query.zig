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
const readInt = @import("../utils.zig").readInt;

// ------------------------------------------------------------

pub fn getQueryBuf(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getQueryBufInternal(env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

pub fn getQueryBufInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();

    const args = try napi.getArgs(2, env, info);
    const dbCtx = try napi.get(*db.DbCtx, env, args[0]);

    var ctx: QueryCtx = .{
        .results = std.ArrayList(results.Result).init(allocator),
        .db = dbCtx,
        // maybe unnecessary might want to the real 8 byte Qid and add in response
        .id = db.getQueryId(),
        .size = 0,
        .totalResults = 0,
        .allocator = allocator,
    };

    const q = try napi.get([]u8, env, args[1]);
    const queryType = q[0];
    const typeId: db.TypeId = readInt(u16, q, 1);

    // TODO maybe make these into fns and then you can read from root in branches as well ?

    // default query
    if (queryType == 2) {
        const offset = readInt(u32, q, 3);
        const limit = readInt(u32, q, 7);
        const filterSize = readInt(u16, q, 11);
        const filterBuf = q[13 .. 13 + filterSize];
        const sortSize = readInt(u16, q, 13 + filterSize);
        const sortBuf = q[15 + filterSize .. 15 + filterSize + sortSize];
        const include = q[15 + filterSize + sortSize .. q.len];
        if (sortSize == 0) {
            try Query.query(&ctx, offset, limit, typeId, filterBuf, include);
        } else if (sortBuf[0] == 0) {
            // later change fn signature
            try QuerySort.querySort(3, &ctx, offset, limit, typeId, filterBuf, include, sortBuf[1..sortBuf.len]);
        } else {
            try QuerySort.querySort(4, &ctx, offset, limit, typeId, filterBuf, include, sortBuf[1..sortBuf.len]);
        }
    } else if (queryType == 0) {
        const id = readInt(u32, q, 3);
        const filterSize = readInt(u16, q, 7);
        const filterBuf = q[9 .. 9 + filterSize];
        const include = q[9 + filterSize .. q.len];
        try Query.queryId(id, &ctx, typeId, filterBuf, include);
    } else if (queryType == 1) {
        const idsSize = readInt(u32, q, 3);
        const ids: []u8 = q[7 .. idsSize + 7];
        const offset = readInt(u32, q, idsSize + 7);
        const limit = readInt(u32, q, idsSize + 11);
        const filterSize = readInt(u16, q, idsSize + 15);
        const filterBuf = q[17 + idsSize .. 17 + filterSize + idsSize];
        const sortSize = readInt(u16, q, 17 + filterSize + idsSize);
        const sortBuf = q[19 + idsSize + filterSize .. 19 + filterSize + sortSize + idsSize];
        const include = q[19 + idsSize + filterSize + sortSize .. q.len];
        if (sortSize == 0) {
            try Query.queryIds(ids, &ctx, typeId, filterBuf, include);
        } else if (sortBuf[0] == 0) {
            // later change fn signature
            try QuerySort.queryIds(9, ids, &ctx, typeId, filterBuf, include, sortBuf[1..sortBuf.len], offset, limit);
        } else {
            try QuerySort.queryIds(10, ids, &ctx, typeId, filterBuf, include, sortBuf[1..sortBuf.len], offset, limit);
        }
    } else {
        return errors.DbError.INCORRECT_QUERY_TYPE;
    }

    return results.createResultsBuffer(&ctx, env);
}
