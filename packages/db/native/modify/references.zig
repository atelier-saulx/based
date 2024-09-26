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

fn writeEdges(ctx: *ModifyCtx, data: []u8) !void {
    // struct
    var i: usize = 0;
    while (i < data.len) {
        const prop = data[i];
        const edgeLen = readInt(u16, data, i + 1);
        const edgeData = data[i + 3 .. i + 3 + edgeLen];
        std.debug.print(
            "WRITE EDGE prop: {d} len {d} nodeId: {d} edgeData: {any} \n",
            .{ prop, edgeLen, ctx.id, edgeData },
        );
        i += edgeLen + 3;
    }
}

pub fn updateReferences(ctx: *ModifyCtx, data: []u8) !void {
    const refTypeId = db.getTypeIdFromFieldSchema(ctx.fieldSchema.?);
    const refTypeEntry = try db.getType(refTypeId);
    const len = data.len;
    var i: usize = 0;
    while (i < len) : (i += 5) {
        const hasEdgeData = data[i] == 1;
        const id = readInt(u32, data, i + 1);
        // TODO Optmize using multi nodes
        var nodes: [1]db.Node = undefined;
        nodes[0] = try db.upsertNode(id, refTypeEntry);
        try db.writeReferences(nodes, ctx.node.?, ctx.fieldSchema.?);
        if (hasEdgeData) {
            const totalEdgesLen = readInt(u32, data, i + 5);
            const edges = data[i + 9 .. i + totalEdgesLen + 9];
            try writeEdges(ctx, edges);
            i += edges.len + 4;
        }
    }
}
