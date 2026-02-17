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

pub inline fn aggregateRefsProps(
    ctx: *Query.QueryCtx,
    q: []u8,
    from: Node.Node,
    fromType: Selva.Type,
    i: *usize,
) !void {
    const header = utils.readNext(t.AggRefsHeader, q, i);
    // utils.debugPrint("aggregateRefsProps header: {any}\n", .{header});

    const accumulatorProp = try ctx.db.allocator.alloc(u8, header.accumulatorSize);
    @memset(accumulatorProp, 0);
    defer ctx.db.allocator.free(accumulatorProp);

    // filter

    var it = try References.iterator(false, false, ctx.db, from, header.targetProp, fromType);

    var aggCtx = Aggregates.AggCtx{
        .queryCtx = ctx,
        .typeEntry = it.dstType,
        .limit = 1000, // MV: check it
        .isSamplingSet = header.isSamplingSet,
        .accumulatorSize = header.accumulatorSize,
        .resultsSize = header.resultsSize,
    };

    if (header.hasGroupBy) {
        var groupByHashMap = GroupByHashMap.init(ctx.db.allocator);
        defer groupByHashMap.deinit();

        _ = GroupBy.iterator(&aggCtx, &groupByHashMap, &it, false, undefined, q[i.*..]); // TODO: hllAcc

        try ctx.thread.query.append(@intFromEnum(t.ReadOp.aggregation));
        try ctx.thread.query.append(header.targetProp);
        try ctx.thread.query.append(@as(u32, @intCast(aggCtx.totalResultsSize)));
        try GroupBy.finalizeRefsGroupResults(&aggCtx, &groupByHashMap, q[i.*..]);
    } else {
        _ = try Aggregates.iterator(&aggCtx, &it, false, undefined, q[i.*..], accumulatorProp); // TODO: hllAcc

        try ctx.thread.query.append(@intFromEnum(t.ReadOp.aggregation));
        try ctx.thread.query.append(header.targetProp);
        try ctx.thread.query.append(@as(u32, header.resultsSize)); // MV: recheck
        try Aggregates.finalizeResults(&aggCtx, q[i.*..], accumulatorProp, 0);
    }
}
