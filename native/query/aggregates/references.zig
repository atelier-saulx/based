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
const errors = @import("../../errors.zig");
const accumulate = Aggregates.accumulate;

pub inline fn aggregateRefsProps(
    ctx: *Query.QueryCtx,
    q: []u8,
    from: Node.Node,
    fromType: Selva.Type,
    i: *usize,
) !void {
    utils.debugPrint("i: {d}\n", .{i.*});
    const header = utils.readNext(t.AggRefsHeader, q, i);
    // utils.debugPrint("aggregateRefsProps header: {any}\n", .{header});

    const accumulatorProp = try ctx.db.allocator.alloc(u8, header.accumulatorSize);
    @memset(accumulatorProp, 0);
    defer ctx.db.allocator.free(accumulatorProp);

    var it = try References.iterator(false, false, ctx.db, from, header.targetProp, fromType);
    _ = try Aggregates.iterator(ctx, &it, 1000, false, undefined, q[i.*..], accumulatorProp, it.dstType, undefined); // TODO: hllAcc
    try ctx.thread.query.append(@intFromEnum(t.ReadOp.aggregation));
    try ctx.thread.query.append(header.targetProp);
    try ctx.thread.query.append(@as(u32, header.resultsSize));

    try Aggregates.finalizeResults(ctx, q[i.*..], accumulatorProp, header.isSamplingSet, 0);
}
