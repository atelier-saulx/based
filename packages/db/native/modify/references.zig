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

// 0 overwrite, 1 add, 2 delete, 3 update, 4 put
pub fn updateReferences(ctx: *ModifyCtx, data: []u8) !usize {
    const refTypeId = db.getTypeIdFromFieldSchema(ctx.fieldSchema.?);
    const refTypeEntry = try db.getType(ctx.db, refTypeId);
    const len: usize = readInt(u32, data, 0);
    const refsLen: usize = readInt(u32, data, 5);
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
        const hasEdgeData = op == 1 or op == 2;
        const hasIndex = op == 2 or op == 3;
        const id = readInt(u32, data, i + 1);
        const index: i32 = if (hasIndex) readInt(i32, data, i + 5) else -1;
        const node = try db.upsertNode(id, refTypeEntry);
        const ref = try db.insertReference(
            ctx.db,
            node,
            ctx.node.?,
            ctx.fieldSchema.?,
            index,
        );

        if (hasEdgeData) {
            const totalEdgesLen = readInt(u32, data, i + 5);
            const edges = data[i + 9 .. i + totalEdgesLen + 9];
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
    const len: usize = readInt(u32, data, 0);
    var i: usize = 1;

    while (i < len) : (i += 4) {
        const id = readInt(u32, data, i + 4);
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
    const len: usize = readInt(u32, data, 0);
    const refTypeId = db.getTypeIdFromFieldSchema(ctx.fieldSchema.?);
    const refTypeEntry = try db.getType(ctx.db, refTypeId);
    const address = @intFromPtr(data.ptr);
    const offset = (4 - (address + 1)) & 3;
    const u32ids = std.mem.bytesAsSlice(u32, data[5 + offset .. len + 5 + offset]);

    try db.putReferences(
        ctx.db,
        @alignCast(u32ids),
        ctx.node.?,
        ctx.fieldSchema.?,
        refTypeEntry,
    );

    return len;
}
