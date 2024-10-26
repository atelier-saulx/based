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
pub fn updateReferences(ctx: *ModifyCtx, data: []u8) !void {
    const refTypeId = db.getTypeIdFromFieldSchema(ctx.fieldSchema.?);
    const refTypeEntry = try db.getType(ctx.db, refTypeId);
    const len = data.len;
    const refsLen: usize = readInt(u32, data, 1);
    var i: usize = 5;

    selva.selva_fields_prealloc_refs(ctx.node.?, ctx.fieldSchema.?, refsLen);
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
}

pub fn deleteReferences(ctx: *ModifyCtx, data: []u8) !void {
    const len = data.len;
    var i: usize = 1;

    while (i < len) : (i += 4) {
        const id = readInt(u32, data, i);
        try db.deleteReference(
            ctx.db,
            ctx.node.?,
            ctx.fieldSchema.?,
            id,
        );
    }
}

pub fn putReferences(ctx: *ModifyCtx, data: []u8) !void {
    const u32ids = std.mem.bytesAsSlice(u32, data[1..]);
    try db.putReferences(
        ctx.db,
        @alignCast(u32ids),
        ctx.node.?,
        ctx.fieldSchema.?,
        ctx.typeEntry.?,
    );
}
