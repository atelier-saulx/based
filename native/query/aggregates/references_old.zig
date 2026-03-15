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

    const hasFilter = header.filterSize > 0;
    const isEdge = header.iteratorType == .aggregateEdge or header.iteratorType == .aggregateEdgeFilter or header.iteratorType == .groupByEdge or header.iteratorType == .groupByEdgeFilter;

    if (isEdge) {
        var it = try References.iterator(false, true, ctx.db, from, header.targetProp, fromType);
        if (hasFilter) {
            filter = utils.sliceNext(header.filterSize, q, i);
            try Filter.prepare(filter, ctx, it.dstType);
        }
        var aggCtx = Aggregates.AggCtx{
            .queryCtx = ctx,
            .typeEntry = it.dstType,
            .edgeTypeEntry = it.edgeType,
            .limit = std.math.maxInt(u32),
            .hllAccumulator = hllAccumulator,
            .isSamplingSet = header.isSamplingSet,
            .accumulatorSize = header.accumulatorSize,
            .resultsSize = header.resultsSize,
        };

        try executeAggRefs(ctx, q, i, header, hasFilter, filter, &aggCtx, &it, accumulatorProp);
    } else {
        var it = try References.iterator(false, false, ctx.db, from, header.targetProp, fromType);
        if (hasFilter) {
            filter = utils.sliceNext(header.filterSize, q, i);
            try Filter.prepare(filter, ctx, it.dstType);
        }
        var aggCtx = Aggregates.AggCtx{
            .queryCtx = ctx,
            .typeEntry = it.dstType,
            .edgeTypeEntry = null,
            .limit = std.math.maxInt(u32), // unlimited in branched queries
            .hllAccumulator = hllAccumulator,
            .isSamplingSet = header.isSamplingSet,
            .accumulatorSize = header.accumulatorSize,
            .resultsSize = header.resultsSize,
        };

        try executeAggRefs(ctx, q, i, header, hasFilter, filter, &aggCtx, &it, accumulatorProp);
    }
}

inline fn executeAggRefs(
    ctx: *Query.QueryCtx,
    q: []u8,
    i: *usize,
    header: t.AggRefsHeader,
    hasFilter: bool,
    filter: []u8,
    aggCtx: *Aggregates.AggCtx,
    it: anytype,
    accumulatorProp: []u8,
) !void {
    if (header.hasGroupBy) {
        var groupByHashMap = GroupByHashMap.init(ctx.db.allocator);
        defer groupByHashMap.deinit();

        _ = GroupBy.iterator(aggCtx, &groupByHashMap, it, hasFilter, filter, q[i.* .. i.* + header.aggDefsSize]);

        try ctx.thread.query.append(@intFromEnum(t.ReadOp.aggregation));
        try ctx.thread.query.append(header.targetProp);
        try ctx.thread.query.append(@as(u32, @intCast(aggCtx.totalResultsSize)));
        try GroupBy.finalizeRefsGroupResults(aggCtx, &groupByHashMap, q[i.* .. i.* + header.aggDefsSize]);
        i.* += header.aggDefsSize;
    } else {
        _ = try Aggregates.iterator(aggCtx, it, hasFilter, filter, q[i.* .. i.* + header.aggDefsSize], accumulatorProp);

        try ctx.thread.query.append(@intFromEnum(t.ReadOp.aggregation));
        try ctx.thread.query.append(header.targetProp);
        try ctx.thread.query.append(@as(u32, header.resultsSize));
        try Aggregates.finalizeResults(aggCtx, q[i.* .. i.* + header.aggDefsSize], accumulatorProp, 0);
        i.* += header.aggDefsSize;
    }
}
