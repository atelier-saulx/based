const Db = @import("../selva/db.zig");
const Schema = @import("../selva/schema.zig");
const Node = @import("../selva/node.zig");
const References = @import("../selva/references.zig");
const read = @import("../utils.zig").read;
const Modify = @import("common.zig");
const errors = @import("../errors.zig");
const std = @import("std");
const ModifyCtx = Modify.ModifyCtx;
const edge = @import("edges.zig");
const RefEdgeOp = @import("../types.zig").RefEdgeOp;

pub fn updateReference(ctx: *ModifyCtx, data: []u8) !usize {
    const op: RefEdgeOp = @enumFromInt(data[0]);
    const hasEdges = RefEdgeOp.hasEdges(op);
    const isTmpId = RefEdgeOp.isTmpId(op);
    const refTypeId = Schema.getRefTypeIdFromFieldSchema(ctx.fieldSchema.?);
    const refTypeEntry = try Node.getType(ctx.db, refTypeId);
    var id = read(u32, data, 1);

    if (isTmpId) {
        id = Modify.resolveTmpId(ctx, id);
    }

    if (ctx.id == id and ctx.typeId == refTypeId) {
        // don't ref yourself
        return 5;
    }

    var ref: ?References.ReferenceLarge = null;

    const oldRefDst = References.getSingleReference(ctx.node.?, ctx.fieldSchema.?);
    const dstType = try Node.getRefDstType(ctx.db, ctx.fieldSchema.?);
    const dstNode = Node.getNodeFromReference(dstType, oldRefDst);

    if (dstNode) |d| {
        if (Node.getNodeId(d) == id) {
            ref = oldRefDst;
        }
    }

    if (ref == null) {
        if (Node.getNode(refTypeEntry, id)) |dst| {
            ref = try References.writeReference(ctx, ctx.node.?, ctx.fieldSchema.?, dst);
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
