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

pub fn updateReferences(ctx: *ModifyCtx, data: []u8) !void {
    std.debug.print("SET references {any} \n", .{data});
    const refTypeId = db.getTypeIdFromFieldSchema(ctx.fieldSchema.?);
    const refTypeEntry = try db.getType(refTypeId);
    const len = data.len;
    var i: usize = 0;
    while (i < len) : (i += 4) {
        const id = readInt(u32, data, i);
        var nodes: [1]db.Node = undefined;
        // maybe this fails?
        nodes[0] = try db.upsertNode(id, refTypeEntry);
        try db.writeReferences(&nodes, ctx.node.?, ctx.fieldSchema.?);
    }
}
