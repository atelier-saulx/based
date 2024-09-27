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

pub fn updateReferences(ctx: *ModifyCtx, data: []u8) !void {
    const refTypeId = db.getTypeIdFromFieldSchema(ctx.fieldSchema.?);
    const refTypeEntry = try db.getType(refTypeId);
    const len = data.len;
    var i: usize = 1;
    while (i < len) : (i += 5) {
        const hasEdgeData = data[i] == 1;
        const id = readInt(u32, data, i + 1);
        const node = try db.upsertNode(id, refTypeEntry);
        const ref = try db.insertReference(
            node,
            ctx.node.?,
            ctx.fieldSchema.?,
            -1,
        );
        if (hasEdgeData) {
            const totalEdgesLen = readInt(u32, data, i + 5);
            const edges = data[i + 9 .. i + totalEdgesLen + 9];
            try edge.writeEdges(ctx, ref, edges, 4);
            i += edges.len + 4;
        }
    }
}

pub fn deleteReferences(ctx: *ModifyCtx, data: []u8) !void {
    const len = data.len;
    var i: usize = 1;
    while (i < len) : (i += 5) {
        // TODO check with olli if this also clean up edges
        const id = readInt(u32, data, i + 1);
        try db.deleteReference(ctx.node.?, ctx.fieldSchema.?, id);
    }
}
