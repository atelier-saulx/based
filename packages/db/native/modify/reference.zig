const db = @import("../db/db.zig");
const readInt = @import("../utils.zig").readInt;
const Modify = @import("./ctx.zig");
const sort = @import("../db/sort.zig");
const selva = @import("../selva.zig");
const errors = @import("../errors.zig");
const std = @import("std");
const ModifyCtx = Modify.ModifyCtx;
const getOrCreateShard = Modify.getOrCreateShard;
const getSortIndex = Modify.getSortIndex;
const edge = @import("./edges.zig");

pub fn updateReference(ctx: *ModifyCtx, data: []u8) !usize {
    const hasEdges = data[0] == 1;
    const id = readInt(u32, data, 1);
    const refTypeId = db.getTypeIdFromFieldSchema(ctx.fieldSchema.?);
    const refTypeEntry = try db.getType(ctx.db, refTypeId);
    const node = try db.upsertNode(id, refTypeEntry);
    const ref = try db.writeReference(ctx.db, node, ctx.node.?, ctx.fieldSchema.?);
    if (hasEdges) {
        const totalEdgesLen = readInt(u32, data, 5);
        const len = 5 + totalEdgesLen;
        if (ref) |r| {
            const edges = data[9..len];
            try edge.writeEdges(ctx, r, edges);
        } else {
            std.log.err("EDGE MODIFY / Cannot find select ref to {d} \n", .{id});
        }
        return len;
    }

    return 5;
}
