const assert = std.debug.assert;
const db = @import("../db/db.zig");
const read = @import("../utils.zig").read;
const Modify = @import("./ctx.zig");
const selva = @import("../selva.zig").c;
const errors = @import("../errors.zig");
const std = @import("std");
const ModifyCtx = Modify.ModifyCtx;
const edge = @import("./edges.zig");
const RefEdgeOp = @import("../types.zig").RefEdgeOp;
const move = @import("../utils.zig").move;

pub fn updateReferences(ctx: *ModifyCtx, data: []u8) !usize {
    const len: usize = read(u32, data, 0);
    if (ctx.node == null) {
        std.log.err("References update id: {d} node does not exist \n", .{ctx.id});
        return len;
    }

    const refTypeId = db.getRefTypeIdFromFieldSchema(ctx.fieldSchema.?);
    const refTypeEntry = try db.getType(ctx.db, refTypeId);
    const refsLen: usize = read(u32, data, 5);
    var i: usize = 9;

    db.preallocReferences(ctx, refsLen);

    while (i < len) : (i += 5) {
        const op: RefEdgeOp = @enumFromInt(data[i]);
        const hasEdgeData = RefEdgeOp.hasEdges(op);
        const hasIndex = RefEdgeOp.hasIndex(op);
        const isTmpId = RefEdgeOp.isTmpId(op);

        var id = read(u32, data, i + 1);

        if (isTmpId) {
            id = Modify.resolveTmpId(ctx, id);
        }

        if (ctx.id == id and ctx.typeId == refTypeId) {
            // don't ref yourself
            if (hasEdgeData) {
                const sizepos = if (hasIndex) i + 9 else i + 5;
                const edgelen = read(u32, data, sizepos);
                const edgepos = sizepos + 4;
                const edges = data[edgepos .. edgepos + edgelen];
                i += edges.len + 4;
            }
            i += 4;
            continue;
        }

        const index: i32 = if (hasIndex) read(i32, data, i + 5) else -1;

        var ref: db.ReferenceAny = undefined;
        if (db.getNode(refTypeEntry, id)) |node| {
            ref = try db.insertReference(ctx, node, ctx.node.?, ctx.fieldSchema.?, index, hasIndex);
        } else {
            if (hasEdgeData) {
                const sizepos = if (hasIndex) i + 9 else i + 5;
                const edgelen = read(u32, data, sizepos);
                const edgepos = sizepos + 4;
                const edges = data[edgepos .. edgepos + edgelen];
                i += edges.len + 4;
            }
            i += 4;
            // TODO WARN errors.SelvaError.SELVA_ENOENT
            continue;
        }

        if (hasEdgeData) {
            const sizepos = if (hasIndex) i + 9 else i + 5;
            const edgelen = read(u32, data, sizepos);
            const edgepos = sizepos + 4;
            const edges = data[edgepos .. edgepos + edgelen];
            if (ref.type == selva.SELVA_NODE_REFERENCE_LARGE) {
                try edge.writeEdges(ctx, ref.p.large, edges);
            }
            i += edges.len + 4;
        }
        if (hasIndex) {
            i += 4;
        }
    }

    return len;
}

pub fn clearReferences(ctx: *ModifyCtx) void {
    const refs = db.getReferences(ctx.node.?, ctx.fieldSchema.?);
    if (refs) |r| {
        if (r.nr_refs == 0) {
            // Is empty already
            return;
        } else {
            const refsIndex = r.index[0..r.nr_refs];
            const edgeConstraint = db.getEdgeFieldConstraint(ctx.fieldSchema.?);
            Modify.markReferencesDirty(ctx, edgeConstraint.*.dst_node_type, refsIndex);
        }
        db.clearReferences(ctx, ctx.node.?, ctx.fieldSchema.?);
    }
}

pub fn deleteReferences(ctx: *ModifyCtx, data: []u8) !usize {
    const len: usize = read(u32, data, 0);

    if (ctx.node == null) {
        std.log.err("References delete id: {d} node does not exist \n", .{ctx.id});
        return len;
    }

    var i: usize = 1;

    while (i < len) : (i += 4) {
        const id = read(u32, data, i + 4);
        try db.deleteReference(
            ctx,
            ctx.node.?,
            ctx.fieldSchema.?,
            id,
        );
    }

    return len;
}

pub fn putReferences(ctx: *ModifyCtx, data: []u8) !usize {
    const len: usize = read(u32, data, 0);

    if (ctx.node == null) {
        std.log.err("References delete id: {d} node does not exist \n", .{ctx.id});
        return len;
    }

    const idsUnAligned = data[5 .. len + 4];
    const address = @intFromPtr(idsUnAligned.ptr);
    const offset: u8 = @truncate(address % 4);
    const aligned = data[5 - offset .. len - offset + 4];

    if (offset != 0) {
        move(aligned, idsUnAligned);
    }

    const u32ids = read([]u32, aligned, 0);

    try db.putReferences(
        ctx,
        u32ids,
        ctx.node.?,
        ctx.fieldSchema.?,
    );

    return len;
}
