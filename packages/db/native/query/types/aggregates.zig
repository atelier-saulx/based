const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const AggFn = @import("../../types.zig").AggFn;
const filter = @import("../filter/filter.zig").filter;
const std = @import("std");
const utils = @import("../../utils.zig");
const t = @import("../../types.zig");

pub fn default(ctx: *QueryCtx, offset: u32, limit: u32, typeId: db.TypeId, conditions: []u8, aggFn: AggFn) !void {
    const typeEntry = try db.getType(ctx.db, typeId);
    var first = true;
    var node = db.getFirstNode(typeEntry);

    checkItem: while (ctx.totalResults < limit) { // instead of limit should stop in fields.len from def
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
        utils.debugPrint("aggregate > offset: {d}{any}\n", .{ offset, aggFn }); // just to keep for now
        // const size = try getFields(node.?, ctx, db.getNodeId(node.?), typeEntry, include, null, null, false);
        // if (size > 0) {
        //     ctx.size += size;
        //     ctx.totalResults += 1;
        // }
    }
}
