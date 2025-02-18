const db = @import("../db/db.zig");
const read = @import("../utils.zig").read;
const Modify = @import("./ctx.zig");
// const sort = @import("../db/sort.zig");
const selva = @import("../selva.zig");
const errors = @import("../errors.zig");
const std = @import("std");
const ModifyCtx = Modify.ModifyCtx;
// const getOrCreateShard = Modify.getOrCreateShard;
// const getSortIndex = Modify.getSortIndex;
const edge = @import("./edges.zig");

// 0 overwrite, 1 add, 2 delete, 3 update, 4 put
pub fn updateReferences(ctx: *ModifyCtx, data: []u8) !usize {
    const len: usize = read(u32, data, 0);
    if (ctx.node == null) {
        std.log.err("References update id: {d} node does not exist \n", .{ctx.id});
        return len;
    }

    const refTypeId = db.getTypeIdFromFieldSchema(ctx.fieldSchema.?);
    const refTypeEntry = try db.getType(ctx.db, refTypeId);
    const refsLen: usize = read(u32, data, 5);
    const idOffset = Modify.getIdOffset(ctx.*, refTypeId);
    var i: usize = 9;

    _ = selva.selva_fields_prealloc_refs(ctx.node.?, ctx.fieldSchema.?, refsLen);
    // prealloc_refs(ctx, data);

    // TODO if !edges use batch operation
    // set this whole thing
    // check if ref b has ref a
    // optional faster check of the id
    // BST
    // TODO if a node gets created optmize insert on the other
    // check in schema if ASS

    // 4 bytes buffer
    while (i < len) : (i += 5) {
        const op = data[i];
        // 0 no edge, no index, real id
        // 1 edge, no index, real id
        // 2 edge, index, real id
        // 3 no edge, index, real id

        // 4 no edge, no index, tmp id
        // 5 edge, no index, tmp id
        // 6 edge, index, tmp id
        // 7 no edge, index, tmp id

        const hasEdgeData = op == 1 or op == 2 or op == 5 or op == 6;
        const hasIndex = op == 2 or op == 3 or op == 6 or op == 7;
        const isTmpId: bool = op == 4 or op == 5 or op == 6 or op == 7;
        var id = read(u32, data, i + 1);

        if (isTmpId) {
            id = id + idOffset;
        }

        const index: i32 = if (hasIndex) read(i32, data, i + 5) else -1;
        const node = try db.upsertNode(id, refTypeEntry);
        const ref = try db.insertReference(ctx.db, node, ctx.node.?, ctx.fieldSchema.?, index, hasIndex);
        if (hasEdgeData) {
            const sizepos = if (hasIndex) i + 9 else i + 5;
            const edgelen = read(u32, data, sizepos);
            const edgepos = sizepos + 4;
            const edges = data[edgepos .. edgepos + edgelen];
            try edge.writeEdges(ctx, ref, edges);
            i += edges.len + 4;
        }
        if (hasIndex) {
            i += 4;
        }
    }

    return len;
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
            ctx.db,
            ctx.node.?,
            ctx.fieldSchema.?,
            id,
        );
    }

    return len;
}

pub fn putReferences(ctx: *ModifyCtx, data: []u8) !usize {
    const len: usize = read(u32, data, 0);
    const address = @intFromPtr(data.ptr);
    const delta = (address + 1) & 3;
    const offset = if (delta == 0) 0 else 4 - delta;

    if (ctx.node == null) {
        std.log.err("References delete id: {d} node does not exist \n", .{ctx.id});
        return len + offset;
    }

    const refTypeId = db.getTypeIdFromFieldSchema(ctx.fieldSchema.?);
    const refTypeEntry = try db.getType(ctx.db, refTypeId);
    const u32ids = std.mem.bytesAsSlice(u32, data[5 + offset .. len + 5 + offset]);

    try db.putReferences(
        ctx.db,
        @alignCast(u32ids),
        ctx.node.?,
        ctx.fieldSchema.?,
        refTypeEntry,
    );

    return len + offset;
}
