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

fn prealloc_refs(ctx: *ModifyCtx, data: []u8) void {
    const len = data.len;
    var i: usize = 1;
    var nr_refs: usize = 0;

    while (i < len) : (i += 5) {
        const op = data[i];
        const hasEdgeData = op == 1 or op == 2;
        const hasIndex = op == 2 or op == 3;

        if (hasEdgeData) {
            const totalEdgesLen = readInt(u32, data, i + 5);
            const edges = data[i + 9 .. i + totalEdgesLen + 9];

            i += edges.len;
        }
        if (hasIndex) {
            i += 4;
        }

        nr_refs += 1;
    }

    if (nr_refs > 0) {
        selva.selva_fields_prealloc_refs(ctx.node.?, ctx.fieldSchema.?, nr_refs);
    }
}

pub fn updateReferences(ctx: *ModifyCtx, data: []u8) !void {
    const refTypeId = db.getTypeIdFromFieldSchema(ctx.fieldSchema.?);
    const refTypeEntry = try db.getType(ctx.db, refTypeId);
    const len = data.len;
    var i: usize = 1;

    prealloc_refs(ctx, data);

    while (i < len) : (i += 5) {
        const op = data[i];
        const hasEdgeData = op == 1 or op == 2;
        const hasIndex = op == 2 or op == 3;
        const id = readInt(u32, data, i + 1);
        const index: i32 = if (hasIndex) readInt(i32, data, i + 5) else -1;

        // std.debug.print("update/insert reference {d} at index {d}\n", .{ id, index });

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
    while (i < len) : (i += 5) {
        // TODO check with olli if this also clean up edges
        const id = readInt(u32, data, i + 1);
        try db.deleteReference(ctx.db, ctx.node.?, ctx.fieldSchema.?, id);
    }
}
