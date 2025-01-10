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
const QueryDefault = @import("./types/default.zig");
const QueryId = @import("./types/id.zig");
const QueryIds = @import("./types/ids.zig");

const readInt = @import("../utils.zig").readInt;
const createSearchCtx = @import("./filter/search.zig").createSearchCtx;

pub fn getQueryBuf(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getQueryBufInternal(env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

const QueryType = enum(u8) {
    id = 0,
    ids = 1,
    default = 2,
};

pub fn getQueryBufInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();

    const args = try napi.getArgs(2, env, info);
    const dbCtx = try napi.get(*db.DbCtx, env, args[0]);

    var ctx: QueryCtx = .{
        .results = std.ArrayList(results.Result).init(allocator),
        .db = dbCtx,
        // pass the real Qeury ID when we have it
        .id = db.getQueryId(),
        .size = 0,
        .totalResults = 0,
        .allocator = allocator,
    };

    const q = try napi.get([]u8, env, args[1]);
    const queryType: QueryType = @enumFromInt(q[0]);
    const typeId: db.TypeId = readInt(u16, q, 1);

    if (queryType == QueryType.default) {
        const offset = readInt(u32, q, 3);
        const limit = readInt(u32, q, 7);
        const filterSize = readInt(u16, q, 11);
        const filterBuf = q[13 .. 13 + filterSize];
        const sortSize = readInt(u16, q, 13 + filterSize);
        const sortBuf = q[15 + filterSize .. 15 + filterSize + sortSize];
        const searchSize = readInt(u16, q, 15 + filterSize + sortSize);
        const include = q[17 + filterSize + sortSize + searchSize .. q.len];
        if (sortSize == 0) {
            if (searchSize > 0) {
                const search = q[17 + filterSize + sortSize .. 17 + filterSize + sortSize + searchSize];
                const searchCtx = &createSearchCtx(search);
                try QueryDefault.search(&ctx, offset, limit, typeId, filterBuf, include, searchCtx);
            } else {
                try QueryDefault.default(&ctx, offset, limit, typeId, filterBuf, include);
            }
        } else {
            const s = sortBuf[1..sortBuf.len];
            const isAsc = sortBuf[0] == 0;
            if (searchSize > 0) {
                // const search = q[17 + filterSize + sortSize .. 17 + filterSize + sortSize + searchSize];
                // const searchCtx = &createSearchCtx(search);
                // if (isAsc) {
                //     try QuerySort.search(3, &ctx, offset, limit, typeId, filterBuf, include, s, searchCtx);
                // } else {
                //     try QuerySort.search(4, &ctx, offset, limit, typeId, filterBuf, include, s, searchCtx);
                // }
            } else if (isAsc) {
                try QuerySort.default(3, &ctx, offset, limit, typeId, filterBuf, include, s);
            } else {
                try QuerySort.default(4, &ctx, offset, limit, typeId, filterBuf, include, s);
            }
        }
    } else if (queryType == QueryType.id) {
        const id = readInt(u32, q, 3);
        const filterSize = readInt(u16, q, 7);
        const filterBuf = q[9 .. 9 + filterSize];
        const include = q[9 + filterSize .. q.len];
        try QueryId.default(id, &ctx, typeId, filterBuf, include);
    } else if (queryType == QueryType.ids) {
        const idsSize = readInt(u32, q, 3);
        const ids: []u8 = q[7 .. idsSize + 7];
        const offset = readInt(u32, q, idsSize + 7);
        const limit = readInt(u32, q, idsSize + 11);
        const filterSize = readInt(u16, q, idsSize + 15);
        const filterBuf = q[17 + idsSize .. 17 + filterSize + idsSize];
        const sortSize = readInt(u16, q, 17 + filterSize + idsSize);
        const sortBuf = q[19 + idsSize + filterSize .. 19 + filterSize + sortSize + idsSize];
        const searchSize = readInt(u16, q, 19 + idsSize + filterSize + sortSize);

        const include = q[21 + idsSize + filterSize + sortSize + searchSize .. q.len];
        if (sortSize == 0) {
            // const searchBuf = q[21 + idsSize + filterSize + sortSize .. 21 + idsSize + filterSize + sortSize];
            // const searchCtx = createSearchCtx(search);
            // if ()

            // if (searchSize)

            try QueryIds.default(ids, &ctx, typeId, filterBuf, include);
        } else if (sortBuf[0] == 0) {
            try QueryIds.sort(9, ids, &ctx, typeId, filterBuf, include, sortBuf[1..sortBuf.len], offset, limit);
        } else {
            try QueryIds.sort(10, ids, &ctx, typeId, filterBuf, include, sortBuf[1..sortBuf.len], offset, limit);
        }
    } else {
        return errors.DbError.INCORRECT_QUERY_TYPE;
    }

    return results.createResultsBuffer(&ctx, env);
}
