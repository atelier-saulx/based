const Query = @import("../common.zig");
const Node = @import("../../selva/node.zig");
const Selva = @import("../../selva/selva.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const DbCtx = @import("../../db/ctx.zig").DbCtx;
const utils = @import("../../utils.zig");
const t = @import("../../types.zig");
const Aggregates = @import("./aggregates.zig");
const References = @import("../../selva/references.zig");
const GroupBy = @import("./group.zig");
const GroupByHashMap = @import("./hashMap.zig").GroupByHashMap;
const errors = @import("../../errors.zig");
const accumulate = Aggregates.accumulate;
const std = @import("std");
const Filter = @import("../filter/filter.zig");

pub inline fn aggregateRefsProps(
    ctx: *Query.QueryCtx,
    q: []u8,
    from: Node.Node,
    fromType: Selva.Type,
    i: *usize,
) !void {
    var filter: []u8 = undefined;

    const header = utils.readNext(t.AggRefsHeader, q, i);

    const accumulatorProp = try ctx.db.allocator.alloc(u8, header.accumulatorSize);
    @memset(accumulatorProp, 0);
    defer ctx.db.allocator.free(accumulatorProp);

    const hllAccumulator = Selva.c.selva_string_create(null, Selva.c.HLL_INIT_SIZE, Selva.c.SELVA_STRING_MUTABLE);
    defer Selva.c.selva_string_free(hllAccumulator);

    var groupByHashMap = GroupByHashMap.init(ctx.db.allocator);
    defer groupByHashMap.deinit();

    var aggCtx = Aggregates.AggCtx{
        .queryCtx = ctx,
        .typeEntry = undefined,
        .edgeTypeEntry = null,
        .limit = std.math.maxInt(u32), // unlimited in branched queries
        .hllAccumulator = hllAccumulator,
        .isSamplingSet = header.isSamplingSet,
        .accumulatorSize = header.accumulatorSize,
        .resultsSize = header.resultsSize,
    };

    try ctx.thread.query.append(@intFromEnum(t.ReadOp.aggregation));
    try ctx.thread.query.append(header.targetProp);
    switch (header.iteratorType) {
        .aggregate => {
            var it = try References.iterator(.asc, .noEdge, ctx.db, from, header.targetProp, fromType);
            aggCtx.typeEntry = it.dstType;
            _ = try Aggregates.iterator(&aggCtx, &it, false, undefined, q[i.* .. i.* + header.aggDefsSize], accumulatorProp);
            try ctx.thread.query.append(@as(u32, header.resultsSize));
            try Aggregates.finalizeResults(&aggCtx, q[i.* .. i.* + header.aggDefsSize], accumulatorProp, 0);
        },
        .aggregateFilter => {
            var it = try References.iterator(.asc, .noEdge, ctx.db, from, header.targetProp, fromType);
            filter = try Filter.readFilter(.noEdge, ctx, i, header.filterSize, q, fromType, undefined);
            aggCtx.typeEntry = it.dstType;
            _ = try Aggregates.iterator(&aggCtx, &it, true, filter, q[i.* .. i.* + header.aggDefsSize], accumulatorProp);
            try ctx.thread.query.append(@as(u32, header.resultsSize));
            try Aggregates.finalizeResults(&aggCtx, q[i.* .. i.* + header.aggDefsSize], accumulatorProp, 0);
        },
        .aggregateEdge => {
            var it = try References.iterator(.asc, .edge, ctx.db, from, header.targetProp, fromType);
            aggCtx.typeEntry = it.dstType;
            aggCtx.edgeTypeEntry = it.edgeType;
            _ = try Aggregates.iterator(&aggCtx, &it, false, undefined, q[i.* .. i.* + header.aggDefsSize], accumulatorProp);
            try ctx.thread.query.append(@as(u32, header.resultsSize));
            try Aggregates.finalizeResults(&aggCtx, q[i.* .. i.* + header.aggDefsSize], accumulatorProp, 0);
        },
        .aggregateEdgeFilter => {
            var it = try References.iterator(.asc, .edge, ctx.db, from, header.targetProp, fromType);
            filter = try Filter.readFilter(.edge, ctx, i, header.filterSize, q, it.dstType, undefined);
            aggCtx.typeEntry = it.dstType;
            aggCtx.edgeTypeEntry = it.edgeType;
            _ = try Aggregates.iterator(&aggCtx, &it, true, filter, q[i.* .. i.* + header.aggDefsSize], accumulatorProp);
            try ctx.thread.query.append(@as(u32, header.resultsSize));
            try Aggregates.finalizeResults(&aggCtx, q[i.* .. i.* + header.aggDefsSize], accumulatorProp, 0);
        },
        .groupBy => {
            var it = try References.iterator(.asc, .noEdge, ctx.db, from, header.targetProp, fromType);
            aggCtx.typeEntry = it.dstType;
            _ = GroupBy.iterator(&aggCtx, &groupByHashMap, &it, false, undefined, q[i.* .. i.* + header.aggDefsSize]);
            try ctx.thread.query.append(@as(u32, @intCast(aggCtx.totalResultsSize)));
            try GroupBy.finalizeRefsGroupResults(&aggCtx, &groupByHashMap, q[i.* .. i.* + header.aggDefsSize]);
        },
        .groupByFilter => {
            var it = try References.iterator(.asc, .noEdge, ctx.db, from, header.targetProp, fromType);
            filter = try Filter.readFilter(.noEdge, ctx, i, header.filterSize, q, it.dstType, undefined);
            aggCtx.typeEntry = it.dstType;
            _ = GroupBy.iterator(&aggCtx, &groupByHashMap, &it, true, filter, q[i.* .. i.* + header.aggDefsSize]);
            try ctx.thread.query.append(@as(u32, @intCast(aggCtx.totalResultsSize)));
            try GroupBy.finalizeRefsGroupResults(&aggCtx, &groupByHashMap, q[i.* .. i.* + header.aggDefsSize]);
        },
        .groupByEdge => {
            var it = try References.iterator(.asc, .edge, ctx.db, from, header.targetProp, fromType);
            aggCtx.typeEntry = it.dstType;
            aggCtx.edgeTypeEntry = it.edgeType;
            _ = GroupBy.iterator(&aggCtx, &groupByHashMap, &it, false, undefined, q[i.* .. i.* + header.aggDefsSize]);
            try ctx.thread.query.append(@as(u32, @intCast(aggCtx.totalResultsSize)));
            try GroupBy.finalizeRefsGroupResults(&aggCtx, &groupByHashMap, q[i.* .. i.* + header.aggDefsSize]);
        },
        .groupByEdgeFilter => {
            var it = try References.iterator(.asc, .edge, ctx.db, from, header.targetProp, fromType);
            filter = try Filter.readFilter(.noEdge, ctx, i, header.filterSize, q, it.dstType, undefined);
            aggCtx.typeEntry = it.dstType;
            aggCtx.edgeTypeEntry = it.edgeType;
            _ = GroupBy.iterator(&aggCtx, &groupByHashMap, &it, true, filter, q[i.* .. i.* + header.aggDefsSize]);
            try ctx.thread.query.append(@as(u32, @intCast(aggCtx.totalResultsSize)));
            try GroupBy.finalizeRefsGroupResults(&aggCtx, &groupByHashMap, q[i.* .. i.* + header.aggDefsSize]);
        },
        else => {
            // throw?
        },
    }
    i.* += header.aggDefsSize;
}
