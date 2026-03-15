const utils = @import("../../utils.zig");
const Query = @import("../common.zig");
const t = @import("../../types.zig");
const Node = @import("../../selva/node.zig");
const Iterate = @import("./iterate.zig");
const Schema = @import("../../selva/schema.zig");
const Sort = @import("../../sort/sort.zig");
const Selva = @import("../../selva/selva.zig");
const Filter = @import("../filter/filter.zig");
const GroupByHashMap = @import("../aggregates/hashMap.zig").GroupByHashMap;
const GroupBy = @import("../aggregates/group.zig");
const Aggregates = @import("../aggregates/aggregates.zig");

pub fn aggregates(
    ctx: *Query.QueryCtx,
    q: []u8,
) !void {
    var i: usize = 0;
    var nodeCnt: u32 = 0;

    const header = utils.read(t.AggHeader, q, i);

    i += utils.sizeOf(t.AggHeader);
    const typeId = header.typeId;
    const typeEntry = try Node.getType(ctx.db, typeId);

    const accumulatorProp = try ctx.db.allocator.alloc(u8, header.accumulatorSize);
    @memset(accumulatorProp, 0);
    defer ctx.db.allocator.free(accumulatorProp);
    const hllAccumulator = Selva.c.selva_string_create(null, Selva.c.HLL_INIT_SIZE, Selva.c.SELVA_STRING_MUTABLE);
    defer Selva.c.selva_string_free(hllAccumulator);

    var aggCtx = Aggregates.AggCtx{
        .queryCtx = ctx,
        .typeEntry = typeEntry,
        .limit = header.limit,
        .isSamplingSet = header.isSamplingSet,
        .hllAccumulator = hllAccumulator,
        .accumulatorSize = header.accumulatorSize,
        .resultsSize = header.resultsSize,
        .totalResultsSize = 0,
    };

    var it = Node.iterator(.asc, typeEntry);
    switch (header.iteratorType) {
        .aggregate => {
            nodeCnt = try Aggregates.iterator(&aggCtx, &it, false, undefined, q[i..], accumulatorProp);
            try Aggregates.finalizeResults(&aggCtx, q[i..], accumulatorProp, 0);
        },
        .aggregateFilter => {
            const filter = try Filter.readFilter(.noEdge, ctx, &i, header.filterSize, q, typeEntry, undefined);
            nodeCnt = try Aggregates.iterator(&aggCtx, &it, true, filter, q[i..], accumulatorProp);
            try Aggregates.finalizeResults(&aggCtx, q[i..], accumulatorProp, 0);
        },
        .groupBy => {
            var groupByHashMap = GroupByHashMap.init(ctx.db.allocator);
            defer groupByHashMap.deinit();
            nodeCnt = @intCast(GroupBy.iterator(&aggCtx, &groupByHashMap, &it, false, undefined, q[i..]));
            try GroupBy.finalizeGroupResults(&aggCtx, &groupByHashMap, q[i..]);
        },
        .groupByFilter => {
            const filterBuf = try Filter.readFilter(.noEdge, ctx, &i, header.filterSize, q, typeEntry, undefined);
            var groupByHashMap = GroupByHashMap.init(ctx.db.allocator);
            defer groupByHashMap.deinit();
            nodeCnt = @intCast(GroupBy.iterator(&aggCtx, &groupByHashMap, &it, true, filterBuf, q[i..]));
            try GroupBy.finalizeGroupResults(&aggCtx, &groupByHashMap, q[i..]);
        },
        .aggregateEdge => {
            const fieldSchema = try Schema.getFieldSchema(typeEntry, header.edgePropId);
            aggCtx.edgeTypeEntry = try Node.getEdgeType(ctx.db, fieldSchema);
            nodeCnt = try Aggregates.iteratorEdge(&aggCtx, &it, false, undefined, q[i..], accumulatorProp, header.edgePropId);
            try Aggregates.finalizeResults(&aggCtx, q[i..], accumulatorProp, 0);
        },
        .aggregateEdgeFilter => {
            const filterBuf = try Filter.readFilter(.noEdge, ctx, &i, header.filterSize, q, typeEntry, undefined);
            const fieldSchema = try Schema.getFieldSchema(typeEntry, header.edgePropId);
            aggCtx.edgeTypeEntry = try Node.getEdgeType(ctx.db, fieldSchema);
            nodeCnt = try Aggregates.iteratorEdge(&aggCtx, &it, true, filterBuf, q[i..], accumulatorProp, header.edgePropId);
            try Aggregates.finalizeResults(&aggCtx, q[i..], accumulatorProp, 0);
        },
        .groupByEdge => {
            var groupByHashMap = GroupByHashMap.init(ctx.db.allocator);
            defer groupByHashMap.deinit();
            const fieldSchema = try Schema.getFieldSchema(typeEntry, header.edgePropId);
            aggCtx.edgeTypeEntry = try Node.getEdgeType(ctx.db, fieldSchema);
            nodeCnt = @intCast(try GroupBy.iteratorEdge(&aggCtx, &groupByHashMap, &it, false, undefined, q[i..], header.edgePropId));
            try GroupBy.finalizeGroupResults(&aggCtx, &groupByHashMap, q[i..]);
        },
        .groupByEdgeFilter => {
            const filterBuf = try Filter.readFilter(.noEdge, ctx, &i, header.filterSize, q, typeEntry, undefined);
            var groupByHashMap = GroupByHashMap.init(ctx.db.allocator);
            defer groupByHashMap.deinit();
            const fieldSchema = try Schema.getFieldSchema(typeEntry, header.edgePropId);
            aggCtx.edgeTypeEntry = try Node.getEdgeType(ctx.db, fieldSchema);
            nodeCnt = @intCast(try GroupBy.iteratorEdge(&aggCtx, &groupByHashMap, &it, true, filterBuf, q[i..], header.edgePropId));
            try GroupBy.finalizeGroupResults(&aggCtx, &groupByHashMap, q[i..]);
        },
        else => {},
    }
}

pub fn aggregatesCount(
    ctx: *Query.QueryCtx,
    q: []u8,
) !void {
    var i: usize = 0;
    const header = utils.read(t.AggHeader, q, i);
    i += utils.sizeOf(t.AggHeader);
    const typeId = header.typeId;
    const typeEntry = try Node.getType(ctx.db, typeId);
    const count: u32 = @truncate(Node.getNodeCount(typeEntry));
    try ctx.thread.query.append(count);
}
