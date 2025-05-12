const c = @import("../c.zig");
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

const QueryType = types.QueryType;
const QuerySort = @import("./queryTypes/sort.zig");
const QueryDefault = @import("./queryTypes/default.zig");
const QueryId = @import("./queryTypes/id.zig");
const QueryIds = @import("./queryTypes/ids.zig");
const QueryAlias = @import("./queryTypes/alias.zig");

const aggregateTypes = @import("./aggregate/types.zig");
const AggDefault = @import("./queryTypes/aggregate.zig");

const utils = @import("../utils.zig");
const read = utils.read;
const createSearchCtx = @import("./filter/search.zig").createSearchCtx;
const isVectorSearch = @import("./filter/search.zig").isVectorSearch;

const defaultProtocol = @import("./protocol/default.zig").defaultProtocol;

pub fn getQueryBuf(env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getQueryBufInternal(env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

pub fn getQueryBufInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(2, env, info);
    const dbCtx = try napi.get(*db.DbCtx, env, args[0]);

    var arena = std.heap.ArenaAllocator.init(std.heap.raw_c_allocator);

    defer arena.deinit();
    const allocator = arena.allocator();

    var q = try napi.get([]u8, env, args[1]);

    // len without the schema checksum space
    const len = q.len - 8;

    var ctx: QueryCtx = .{
        .results = std.ArrayList(results.Result).init(allocator),
        .db = dbCtx,
        // pass the real Qeury ID when we have it
        .id = db.getQueryId(),
        .size = 0,
        .totalResults = 0,
        .aggResult = null,
        .allocator = allocator,
    };

    var index: usize = 0;
    const queryType: QueryType = @enumFromInt(q[index]);
    index += 1;
    const typeId: db.TypeId = read(u16, q, index);
    index += 2;

    if (queryType == QueryType.default) {
        try defaultProtocol(&ctx, typeId, q, index, len);
    } else if (queryType == QueryType.id) {
        const id = read(u32, q, 3);
        const filterSize = read(u16, q, 7);
        const filterBuf = q[9 .. 9 + filterSize];
        const include = q[9 + filterSize .. len];
        try QueryId.default(id, &ctx, typeId, filterBuf, include);
    } else if (queryType == QueryType.ids) {
        const idsSize = read(u32, q, 3);
        const ids: []u8 = q[7 .. idsSize + 7];

        const offset = read(u32, q, idsSize + 7);
        const limit = read(u32, q, idsSize + 11);
        // add 1 extra byte for is single condition
        const filterSize = read(u16, q, idsSize + 15);
        const filterBuf = q[17 + idsSize .. 17 + filterSize + idsSize];
        const sortSize = read(u16, q, 17 + filterSize + idsSize);
        const sortBuf = q[19 + idsSize + filterSize .. 19 + filterSize + sortSize + idsSize];
        const searchIndex = 21 + idsSize + filterSize + sortSize;
        const searchSize = read(u16, q, 19 + idsSize + filterSize + sortSize);
        const include = q[searchIndex + searchSize .. len];
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
        const include = q[8 + filterSize + valueSize .. len];
        try QueryAlias.default(field, value, &ctx, typeId, filterBuf, include);
    } else if (queryType == QueryType.aggregates) {
        const limit = read(u32, q, 7);
        const filterSize = read(u16, q, 11);
        const filterBuf = q[13 .. 13 + filterSize]; // lost 1 byte when no filter

        const aggSize = read(u16, q, 14 + filterSize);
        const agg: []u8 = q[16 + filterSize .. 16 + filterSize + aggSize];
        // const include = q[16 + filterSize .. len];
        const groupBy: aggregateTypes.GroupedBy = @enumFromInt(agg[0]);
        if (groupBy == aggregateTypes.GroupedBy.hasGroup) {
            return try AggDefault.group(env, &ctx, limit, typeId, filterBuf, agg);
        } else {
            return try AggDefault.default(env, &ctx, limit, typeId, filterBuf, agg);
        }
    } else if (queryType == QueryType.aggregatesCountType) {
        return try AggDefault.countType(env, &ctx, typeId);
    } else {
        return errors.DbError.INCORRECT_QUERY_TYPE;
    }

    // result for js
    return results.createResultsBuffer(&ctx, env);
}
