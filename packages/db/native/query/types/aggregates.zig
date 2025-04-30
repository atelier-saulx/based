const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const types = @import("../../types.zig");
const AggFn = types.AggFn;
const filter = @import("../filter/filter.zig").filter;
const std = @import("std");
const utils = @import("../../utils.zig");
const getFields = @import("../aggregates/aggregates.zig").getFields;

pub fn default(ctx: *QueryCtx, limit: u32, typeId: db.TypeId, conditions: []u8, include: []u8, aggFn: AggFn, aggField: u16) !void {
    const typeEntry = try db.getType(ctx.db, typeId);
    var first = true;
    var node = db.getFirstNode(typeEntry);

    checkItem: while (ctx.totalResults < limit) {
        if (first) {
            first = false;
        } else {
            node = db.getNextNode(typeEntry, node.?);
        }
        if (node == null) {
            break :checkItem;
        }
        if (!filter(ctx.db, node.?, typeEntry, conditions, null, null, 0, false)) {
            continue :checkItem;
        }
        if (aggFn == AggFn.count) {
            ctx.aggResult = if (ctx.aggResult) |r| r + 1 else 1;
        } else {
            try getFields(node.?, ctx, db.getNodeId(node.?), typeEntry, include, aggFn, aggField);
        }
    }
    ctx.size = 0;
}
