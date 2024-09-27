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

pub fn updateReference(ctx: *ModifyCtx, data: []u8) !void {
    const hasEdges = data[0] == 1;
    const id = readInt(u32, data, 1);
    const refTypeId = db.getTypeIdFromFieldSchema(ctx.fieldSchema.?);
    const refTypeEntry = try db.getType(refTypeId);
    const node = db.getNode(id, refTypeEntry);
    if (node == null) {
        std.log.err("Cannot find reference to {d} \n", .{id});
    } else {
        try db.writeReference(node.?, ctx.node.?, ctx.fieldSchema.?);
    }

    //const ref = try db.insertReference(node, ctx.node.?, ctx.fieldSchema.?, -1);

    if (hasEdges) {
        std.debug.print("YO EDGE FOR REF {any} \n", .{data});
    }
}
