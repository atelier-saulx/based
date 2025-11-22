const db = @import("../db/db.zig");
const read = @import("../utils.zig").read;
const Modify = @import("./common.zig");
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
        id = Modify.resolveTmpId(ctx, id);
    }

    if (ctx.id == id and ctx.typeId == refTypeId) {
        // don't ref yourself
        return 5;
    }

    var ref: ?db.ReferenceLarge = null;

    const oldRefDst = db.getSingleReference(ctx.node.?, ctx.fieldSchema.?);
    const dstType = try db.getRefDstType(ctx.db, ctx.fieldSchema.?);
    const dstNode = db.getNodeFromReference(dstType, oldRefDst);

    if (dstNode) |d| {
        if (db.getNodeId(d) == id) {
            ref = oldRefDst;
        }
    }

    if (ref == null) {
        if (db.getNode(refTypeEntry, id)) |dst| {
            ref = try db.writeReference(ctx, ctx.node.?, ctx.fieldSchema.?, dst);
        } else {
            return 5; //TODO WARN errors.SelvaError.SELVA_ENOENT
        }
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
