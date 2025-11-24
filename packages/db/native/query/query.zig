const std = @import("std");
const db = @import("../db/db.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const Sort = @import("../db/sort.zig");
const Query = @import("./common.zig");
const utils = @import("../utils.zig");
const results = @import("./results.zig");

const t = @import("../types.zig");

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
        .id = utils.readNext(u32, q, &index),
        .results = std.array_list.Managed(results.Result).init(allocator),
        .db = dbCtx,
        .size = 0,
        .totalResults = 0,
        .aggResult = null,
        .allocator = allocator,
        .threadCtx = threadCtx,
    };

    const op = utils.read(t.OpType, q, index);
    const len = q.len - 8;

    switch (op) {
        t.OpType.default => {
            const header = utils.readNext(t.QueryHeader, q, &index);

            std.debug.print("Query: {any}...\n", .{header});

            switch (header.subType) {
                t.QuerySubType.default => {
                    try QueryDefault.default(false, &ctx, &header, q[index..len], undefined);
                },
                // t.QuerySubType.filter => {
                //     const filterSlice = utils.sliceNext(header.filterSize, q, &index);
                //     try QueryDefault.default(true, &ctx, &header, q[index..len], filterSlice);
                // },
                // t.QuerySubType.sortAsc => {
                //     index += utils.sizeOf(t.SortHeader);
                //     try QuerySort.default(false, false, &ctx, sortIndex, &header, q[index..len], undefined);
                // },
                // t.QuerySubType.sortDesc => {
                //     index += utils.sizeOf(t.SortHeader);
                //     try QuerySort.default(true, false, &ctx, sortIndex, &header, q[index..len], undefined);
                // },
                // t.QuerySubType.sortAscFilter => {
                //     index += utils.sizeOf(t.SortHeader);
                //     const filterSlice = utils.sliceNext(header.filterSize, q, &index);
                //     try QuerySort.default(false, true, &ctx, sortIndex, &header, q[index..len], filterSlice);
                // },
                // t.QuerySubType.sortDescFilter => {
                //     index += utils.sizeOf(t.SortHeader);
                //     const filterSlice = utils.sliceNext(header.filterSize, q, &index);
                //     try QuerySort.default(true, true, &ctx, sortIndex, &header, q[index..len], filterSlice);
                // },
                // t.QuerySubType.sortIdDesc => {
                //     index += utils.sizeOf(t.SortHeader);
                //     try QuerySort.idDesc(false, &ctx, &header, q[index..len], undefined);
                // },
                // t.QuerySubType.sortIdDescFilter => {
                //     index += utils.sizeOf(t.SortHeader);
                //     const filterSlice = utils.sliceNext(header.filterSize, q, &index);
                //     try QuerySort.idDesc(true, &ctx, &header, q[index..len], filterSlice);
                // },
                // else => {
                //     std.debug.print("🤪 not handled yet {any}...\n", .{header.subType});
                // },
            }
        },
        t.OpType.ids => {},
        t.OpType.id => {
            // const id = read(u32, q, 3);
            // const filterSize = read(u16, q, 7);
            // const filterBuf = q[9 .. 9 + filterSize];
            // const include = q[9 + filterSize .. len];
            // try QueryId.default(id, &ctx, typeId, filterBuf, include);
        },
        t.OpType.alias => {},
        t.OpType.aggregates => {},
        t.OpType.aggregatesCountType => {},
        else => {
            return errors.DbError.INCORRECT_QUERY_TYPE;
        },
    }

    try results.createResultsBuffer(&ctx, op);
}
