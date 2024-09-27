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

pub fn updateReference(ctx: *ModifyCtx, data: []u8) !void {
    const hasEdges = data[0] == 1;
    const id = readInt(u32, data, 1);
    const refTypeId = db.getTypeIdFromFieldSchema(ctx.fieldSchema.?);
    const refTypeEntry = try db.getType(refTypeId);
    const node = db.getNode(id, refTypeEntry);
    if (node == null) {
        std.log.err("Cannot find reference to {d} \n", .{id});
        return;
    }

    //const ref = try db.insertReference(node, ctx.node.?, ctx.fieldSchema.?, -1);

    if (hasEdges) {
        // TODO: replace with an insert type thing
        try db.writeReference(node.?, ctx.node.?, ctx.fieldSchema.?);
        const ref = db.getSingleReference(node.?, ctx.field);
        if (ref == null) {
            std.log.err("Cannot find select ref to {d} \n", .{id});
            return;
        }
        const totalEdgesLen = readInt(u32, data, 5);
        const edges = data[9 .. totalEdgesLen + 9];
        std.debug.print("YO EDGE FOR REF {any} {any} \n", .{ data, ref });

        try edge.writeEdges(ctx, ref.?, edges, 0);

        return;
    }

    try db.writeReference(node.?, ctx.node.?, ctx.fieldSchema.?);
}
