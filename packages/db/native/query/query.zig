const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const std = @import("std");
const db = @import("../db/db.zig");
const getFields = @import("./include/include.zig").getFields;
const results = @import("./results.zig");
pub const Query = @import("./common.zig");

const OpType = @import("../types.zig").OpType;
const Sort = @import("../db/sort.zig");
const QuerySubType = Query.QuerySubType;

const QuerySort = @import("./queryTypes/sort.zig");
const QueryDefault = @import("./queryTypes/default.zig");
const QueryId = @import("./queryTypes/id.zig");
const QueryIds = @import("./queryTypes/ids.zig");
const QueryAlias = @import("./queryTypes/alias.zig");
const AggDefault = @import("./queryTypes/aggregate.zig");
const aggregateTypes = @import("./aggregate/types.zig");
const filter = @import("./filter/filter.zig").filter;
const createSearchCtx = @import("./filter/search.zig").createSearchCtx;
const isVectorSearch = @import("./filter/search.zig").isVectorSearch;
const defaultProtocol = @import("./protocol/default.zig").defaultProtocol;
const SortHeader = @import("../types.zig").SortHeader;
const readNext = @import("../utils.zig").readNext;
const sliceNext = @import("../utils.zig").sliceNext;

// -------- NAPI ---------- (put in js bridge maybe?)
pub fn getQueryBufThread(env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    return getQueryBufInternalThread(env, info) catch |err| {
        napi.jsThrow(env, @errorName(err));
        return null;
    };
}

pub fn getQueryBufInternalThread(env: napi.Env, info: napi.Info) !napi.Value {
    const args = try napi.getArgs(2, env, info);
    const dbCtx = try napi.get(*db.DbCtx, env, args[0]);
    const q = try napi.get([]u8, env, args[1]);
    try dbCtx.threads.query(q);
    return null;
}
// -------------------------

pub fn getQueryThreaded(
    dbCtx: *db.DbCtx,
    q: []u8,
    threadCtx: *db.DbThread,
    sortIndex: ?*Sort.SortIndexMeta,
) !void {
    var arena = std.heap.ArenaAllocator.init(std.heap.raw_c_allocator);
    defer arena.deinit();

    const allocator = arena.allocator();
    var index: usize = 0;

    var ctx: Query.QueryCtx = .{
        .id = readNext(u32, q, &index),
        .results = std.array_list.Managed(results.Result).init(allocator),
        .db = dbCtx,
        .size = 0,
        .totalResults = 0,
        .aggResult = null,
        .allocator = allocator,
        .threadCtx = threadCtx,
    };

    const op = readNext(OpType, q, &index);
    const len = q.len - 8;

    // const q = batch[4 .. batch.len - 8];

    switch (op) {
        OpType.default => {
            const header = readNext(Query.QueryDefaultHeader, q, &index);
            // sort allready handled higher up
            // index += header.sortSize;
            // const filterSlice = sliceNext(header.filterSize, q, &index);
            // const search = sliceNext(header.searchSize, q, &index);
            // const include = q[index..len];
            std.debug.print("SUB TYPE: {any}...", .{header.subType});

            switch (header.subType) {
                QuerySubType.default => {
                    try QueryDefault.default(false, &ctx, &header, q[index..len], undefined);
                },
                QuerySubType.filter => {
                    const filterSlice = sliceNext(header.filterSize, q, &index);
                    try QueryDefault.default(true, &ctx, &header, q[index..len], filterSlice);
                },
                QuerySubType.sortAsc => {
                    index += header.sortSize;
                },
                else => {
                    std.debug.print("not handled yet {any}...", .{header.subType});
                },
            }

            // if (header.sortSize == 0 and header.filterSize == 0 and header.searchSize == 0) {
            //     try QueryDefault.default(ctx, *header, include);
            // }

            // const sort = if (header.sortSize != 0) read(types.QuerySortHeader, q, &index) else null;

            // if (sort) |s| {
            // std.debug.print("HEADEr {any}  SORT {any} \n", .{ header, s });
            // }
            // [order] [prop] [propType] [start] [start] [len] [len] [lan]

            //

            // get sort filter, search
            // index += sortSize;

            // const filterSize = read(u16, q, index);
            // index += 2;
            // const isSimpleFilter = q[index] == 1;
            // index += 1;
            // const filterBuf = q[index .. index + filterSize];
            // index += filterSize;

            // const searchSize = read(u16, q, index);
            // index += 2;
            // const search = q[index .. index + searchSize];
            // index += searchSize;

            // const include = q[index..len];
            std.debug.print("derp header {any} {any} \n", .{ header, sortIndex });
            // try defaultProtocol(&ctx, q[1..len]);
        },
        OpType.id => {
            // const id = read(u32, q, 3);
            // const filterSize = read(u16, q, 7);
            // const filterBuf = q[9 .. 9 + filterSize];
            // const include = q[9 + filterSize .. len];
            // try QueryId.default(id, &ctx, typeId, filterBuf, include);
        },
        OpType.ids => {},
        OpType.alias => {},
        OpType.aggregates => {},
        OpType.aggregatesCountType => {},
        else => {
            return errors.DbError.INCORRECT_QUERY_TYPE;
        },
    }

    // if (op == OpType.default) {} else if (op == OpType.id) {} else if (op == OpType.ids) {
    //     const idsSize = read(u32, q, 3);
    //     const ids: []u8 = q[7 .. idsSize + 7];
    //     const offset = read(u32, q, idsSize + 7);
    //     const limit = read(u32, q, idsSize + 11);
    //     // add 1 extra byte for is single condition
    //     const filterSize = read(u16, q, idsSize + 15);
    //     const filterBuf = q[17 + idsSize .. 17 + filterSize + idsSize];
    //     const sortSize = read(u16, q, 17 + filterSize + idsSize);
    //     const sortBuf = q[19 + idsSize + filterSize .. 19 + filterSize + sortSize + idsSize];
    //     const searchIndex = 21 + idsSize + filterSize + sortSize;
    //     const searchSize = read(u16, q, 19 + idsSize + filterSize + sortSize);
    //     const include = q[searchIndex + searchSize .. len];
    //     if (sortSize == 0) {
    //         if (searchSize > 0) {
    //             const search = q[searchIndex .. searchIndex + searchSize];
    //             if (isVectorSearch(search)) {
    //                 const searchCtx = &createSearchCtx(true, search);
    //                 try QueryIds.search(true, ids, &ctx, typeId, filterBuf, include, searchCtx);
    //             } else {
    //                 const searchCtx = &createSearchCtx(false, search);
    //                 try QueryIds.search(false, ids, &ctx, typeId, filterBuf, include, searchCtx);
    //             }
    //         } else {
    //             try QueryIds.default(ids, &ctx, typeId, filterBuf, include);
    //         }
    //     } else {
    //         if (searchSize > 0) {
    //             const search = q[searchIndex .. searchIndex + searchSize];
    //             if (isVectorSearch(search)) {
    //                 const searchCtx = &createSearchCtx(true, search);
    //                 try QueryIds.search(true, ids, &ctx, typeId, filterBuf, include, searchCtx);
    //             } else {
    //                 const searchCtx = &createSearchCtx(false, search);
    //                 try QueryIds.search(false, ids, &ctx, typeId, filterBuf, include, searchCtx);
    //             }
    //         } else {
    //             const isAsc = sortBuf[0] == 0;
    //             if (isAsc) {
    //                 try QueryIds.sort(false, ids, &ctx, typeId, filterBuf, include, sortBuf[1..sortBuf.len], offset, limit);
    //             } else {
    //                 try QueryIds.sort(true, ids, &ctx, typeId, filterBuf, include, sortBuf[1..sortBuf.len], offset, limit);
    //             }
    //         }
    //     }
    // } else if (op == OpType.alias) {
    //     const field = q[3];
    //     const valueSize = read(u16, q, 4);
    //     const value = q[6 .. 6 + valueSize];
    //     const filterSize = read(u16, q, valueSize + 6);
    //     const filterBuf = q[8 + valueSize .. 8 + valueSize + filterSize];
    //     const include = q[8 + filterSize + valueSize .. len];
    //     try QueryAlias.default(field, value, &ctx, typeId, filterBuf, include);
    // } else if (op == OpType.aggregates) {
    //     // var i: usize = 7; // queryType + typeId + offset
    //     // const limit = read(u32, q, i);
    //     // i += 4;
    //     // const filterSize = read(u16, q, i);
    //     // i += 2;
    //     // const filterBuf = q[i .. i + filterSize];
    //     // i += 1 + filterSize; // isSimpleFilter + filterSize
    //     // const aggSize = read(u16, q, i);
    //     // i += 2;
    //     // const agg: []u8 = q[i .. i + aggSize];
    //     // const groupBy: aggregateTypes.GroupedBy = @enumFromInt(agg[0]);
    //     // if (groupBy == aggregateTypes.GroupedBy.hasGroup) {
    //     //     return try AggDefault.group(env, &ctx, limit, typeId, filterBuf, agg);
    //     // } else {
    //     //     return try AggDefault.default(env, &ctx, limit, typeId, filterBuf, agg);
    //     // }
    // } else if (op == OpType.aggregatesCountType) {
    //     // return try AggDefault.countType(env, &ctx, typeId);
    // } else {
    //     return errors.DbError.INCORRECT_QUERY_TYPE;
    // }

    try results.createResultsBuffer(&ctx, op);
}
