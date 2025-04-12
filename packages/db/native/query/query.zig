const c = @import("../c.zig");
const selva = @import("../selva.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const std = @import("std");
const db = @import("../db/db.zig");
const getFields = @import("./include/include.zig").getFields;
const results = @import("./results.zig");
const QueryCtx = @import("./types.zig").QueryCtx;
const filter = @import("./filter/filter.zig").filter;
const sort = @import("../db/sort.zig");
const types = @import("../types.zig");

const QuerySort = @import("./types/sort.zig");
const QueryDefault = @import("./types/default.zig");
const QueryId = @import("./types/id.zig");
const QueryIds = @import("./types/ids.zig");
const QueryAlias = @import("./types/alias.zig");

const read = @import("../utils.zig").read;
const createSearchCtx = @import("./filter/search.zig").createSearchCtx;
const isVectorSearch = @import("./filter/search.zig").isVectorSearch;

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
    alias = 3,
};

pub fn getQueryBufInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(2, env, info);
    const dbCtx = try napi.get(*db.DbCtx, env, args[0]);

    var arena = std.heap.ArenaAllocator.init(std.heap.raw_c_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();

    var q = try napi.get([]u8, env, args[1]);

    var ctx: QueryCtx = .{
        .results = std.ArrayList(results.Result).init(allocator),
        .db = dbCtx,
        // pass the real Qeury ID when we have it
        .id = db.getQueryId(),
        .size = 0,
        .totalResults = 0,
        .allocator = allocator,
    };

    const queryType: QueryType = @enumFromInt(q[0]);
    const typeId: db.TypeId = read(u16, q, 1);

    if (queryType == QueryType.default) {
        const offset = read(u32, q, 3);
        const limit = read(u32, q, 7);
        const filterSize = read(u16, q, 11);
        const filterBuf = q[13 .. 13 + filterSize];
        const sortSize = read(u16, q, 13 + filterSize);
        const sortBuf = q[15 + filterSize .. 15 + filterSize + sortSize];
        const searchSize = read(u16, q, 15 + filterSize + sortSize);
        const aggregation: types.AggFn = @enumFromInt(read(u8, q, 17 + filterSize + sortSize + searchSize));
        const include = q[18 + filterSize + sortSize + searchSize .. q.len];
        if (sortSize == 0) {
            if (searchSize > 0) {
                const search = q[17 + filterSize + sortSize .. 17 + filterSize + sortSize + searchSize];
                if (isVectorSearch(search)) {
                    try QueryDefault.search(
                        true,
                        &ctx,
                        offset,
                        limit,
                        typeId,
                        filterBuf,
                        include,
                        &createSearchCtx(true, search),
                    );
                } else {
                    try QueryDefault.search(
                        false,
                        &ctx,
                        offset,
                        limit,
                        typeId,
                        filterBuf,
                        include,
                        &createSearchCtx(false, search),
                    );
                }
            } else {
                try QueryDefault.default(&ctx, offset, limit, typeId, filterBuf, include, aggregation);
            }
        } else {
            const s = sortBuf[1..sortBuf.len];
            const isAsc = sortBuf[0] == 0;
            if (searchSize > 0) {
                const search = q[17 + filterSize + sortSize .. 17 + filterSize + sortSize + searchSize];
                if (isVectorSearch(search)) {
                    const searchCtx = &createSearchCtx(true, search);
                    if (isAsc) {
                        try QuerySort.search(true, false, &ctx, offset, limit, typeId, filterBuf, include, s, searchCtx);
                    } else {
                        try QuerySort.search(true, true, &ctx, offset, limit, typeId, filterBuf, include, s, searchCtx);
                    }
                } else {
                    const searchCtx = &createSearchCtx(false, search);
                    if (isAsc) {
                        try QuerySort.search(false, false, &ctx, offset, limit, typeId, filterBuf, include, s, searchCtx);
                    } else {
                        try QuerySort.search(false, true, &ctx, offset, limit, typeId, filterBuf, include, s, searchCtx);
                    }
                }
            } else if (isAsc) {
                try QuerySort.default(false, &ctx, offset, limit, typeId, filterBuf, include, s);
            } else {
                try QuerySort.default(true, &ctx, offset, limit, typeId, filterBuf, include, s);
            }
        }
    } else if (queryType == QueryType.id) {
        const id = read(u32, q, 3);
        const filterSize = read(u16, q, 7);
        const filterBuf = q[9 .. 9 + filterSize];
        const include = q[9 + filterSize .. q.len];
        try QueryId.default(id, &ctx, typeId, filterBuf, include);
    } else if (queryType == QueryType.ids) {
        const idsSize = read(u32, q, 3);
        const ids: []u8 = q[7 .. idsSize + 7];
        const offset = read(u32, q, idsSize + 7);
        const limit = read(u32, q, idsSize + 11);
        const filterSize = read(u16, q, idsSize + 15);
        const filterBuf = q[17 + idsSize .. 17 + filterSize + idsSize];
        const sortSize = read(u16, q, 17 + filterSize + idsSize);
        const sortBuf = q[19 + idsSize + filterSize .. 19 + filterSize + sortSize + idsSize];
        const searchIndex = 21 + idsSize + filterSize + sortSize;
        const searchSize = read(u16, q, 19 + idsSize + filterSize + sortSize);
        const include = q[searchIndex + searchSize .. q.len];
        if (sortSize == 0) {
            if (searchSize > 0) {
                const search = q[searchIndex .. searchIndex + searchSize];
                if (isVectorSearch(search)) {
                    const searchCtx = &createSearchCtx(true, search);
                    try QueryIds.search(true, ids, &ctx, typeId, filterBuf, include, searchCtx);
                } else {
                    const searchCtx = &createSearchCtx(false, search);
                    try QueryIds.search(false, ids, &ctx, typeId, filterBuf, include, searchCtx);
                }
            } else {
                try QueryIds.default(ids, &ctx, typeId, filterBuf, include);
            }
        } else {
            if (searchSize > 0) {
                const search = q[searchIndex .. searchIndex + searchSize];
                if (isVectorSearch(search)) {
                    const searchCtx = &createSearchCtx(true, search);
                    try QueryIds.search(true, ids, &ctx, typeId, filterBuf, include, searchCtx);
                } else {
                    const searchCtx = &createSearchCtx(false, search);
                    try QueryIds.search(false, ids, &ctx, typeId, filterBuf, include, searchCtx);
                }
            } else {
                const isAsc = sortBuf[0] == 0;
                if (isAsc) {
                    try QueryIds.sort(false, ids, &ctx, typeId, filterBuf, include, sortBuf[1..sortBuf.len], offset, limit);
                } else {
                    try QueryIds.sort(true, ids, &ctx, typeId, filterBuf, include, sortBuf[1..sortBuf.len], offset, limit);
                }
            }
        }
    } else if (queryType == QueryType.alias) {
        const field = q[3];
        const valueSize = read(u16, q, 4);
        const value = q[6 .. 6 + valueSize];
        const filterSize = read(u16, q, valueSize + 6);
        const filterBuf = q[8 .. 8 + filterSize];
        const include = q[8 + filterSize + valueSize .. q.len];
        try QueryAlias.default(field, value, &ctx, typeId, filterBuf, include);
    } else {
        return errors.DbError.INCORRECT_QUERY_TYPE;
    }

    // result for js
    return results.createResultsBuffer(&ctx, env);
}
