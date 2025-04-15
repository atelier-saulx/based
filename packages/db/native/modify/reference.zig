const db = @import("../db/db.zig");
const read = @import("../utils.zig").read;
const Modify = @import("./ctx.zig");
const selva = @import("../selva.zig");
const errors = @import("../errors.zig");
const std = @import("std");
const ModifyCtx = Modify.ModifyCtx;
const edge = @import("./edges.zig");
const RefEdgeOp = @import("../types.zig").RefEdgeOp;

pub fn updateReference(ctx: *ModifyCtx, data: []u8) !usize {
    const op: RefEdgeOp = @enumFromInt(data[0]);
    const hasEdges = RefEdgeOp.hasEdges(op);
    const isTmpId = RefEdgeOp.isTmpId(op);
    const refTypeId = db.getRefTypeIdFromFieldSchema(ctx.fieldSchema.?);
    const refTypeEntry = try db.getType(ctx.db, refTypeId);
    var id = read(u32, data, 1);

    if (isTmpId) {
        id = id + Modify.getIdOffset(ctx, refTypeId);
    }

    var ref: ?*selva.SelvaNodeReference = null;
    var node: db.Node = undefined;

    const oldRefDst = db.getSingleReference(ctx.db, ctx.node.?, ctx.fieldSchema.?);
    const dstNode = db.getNodeFromReference(oldRefDst);

    if (dstNode) |d| {
        if (db.getNodeId(d) == id) {
            ref = oldRefDst;
            if (hasEdges) {
                Modify.markDirtyRange(ctx, selva.selva_get_node_type(d), selva.selva_get_node_id(d));
            }
        } else {
            Modify.markDirtyRange(ctx, selva.selva_get_node_type(d), selva.selva_get_node_id(d));
        }
    }

    if (ref == null) {
        node = try db.upsertNode(id, refTypeEntry);
        ref = try db.writeReference(ctx, node, ctx.node.?, ctx.fieldSchema.?);
    }

    if (hasEdges) {
        const totalEdgesLen = read(u32, data, 5);
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
