const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const types = @import("../../types.zig");
const AggFn = types.AggFn;
const filter = @import("../filter/filter.zig").filter;
const std = @import("std");
const utils = @import("../../utils.zig");
const getFields = @import("../aggregates/aggregates.zig").getFields;

pub fn default(ctx: *QueryCtx, limit: u32, typeId: db.TypeId, conditions: []u8, include: []u8, aggFn: AggFn) !void {
    const typeEntry = try db.getType(ctx.db, typeId);
    var first = true;
    var node = db.getFirstNode(typeEntry);

    checkItem: while (ctx.totalResults < limit) { // MV: nstead of limit should stop in fields.len from def
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
        const size = try getFields(node.?, ctx, db.getNodeId(node.?), typeEntry, include, aggFn);
        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
    }
}
