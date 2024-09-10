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

pub fn createField(ctx: *ModifyCtx, data: []u8) !usize {
    if (ctx.fieldType == 14) {
        const refTypeId = db.getTypeIdFromFieldSchema(ctx.fieldSchema.?);
        const refTypeEntry = try db.getType(refTypeId);
        const len = @divTrunc(data.len, 4);
        var i: u32 = 0;
        // stack allocate per 4?

        while (i < len) : (i += 1) {
            const id = readInt(u32, data, i);
            var nodes: [1]db.Node = undefined;
            nodes[0] = try db.upsertNode(id, refTypeEntry);

            // TODO It would be better to at least do this in chunks
            // use max chunks
            try db.writeReferences(&nodes, ctx.node.?, ctx.fieldSchema.?);
        }
    } else if (ctx.fieldType == 13) {
        const id = readInt(u32, data, 0);
        const refTypeId = db.getTypeIdFromFieldSchema(ctx.fieldSchema.?);
        const refTypeEntry = try db.getType(refTypeId);
        const node = db.getNode(id, refTypeEntry);
        if (node == null) {
            std.log.err("Cannot find reference to {d} \n", .{id});
        } else {
            try db.writeReference(node.?, ctx.node.?, ctx.fieldSchema.?);
        }
    } else {
        try db.writeField(data, ctx.node.?, ctx.fieldSchema.?);
    }

    if (ctx.field == 0) {
        if (sort.hasMainSortIndexes(ctx.typeId)) {
            var it = db.ctx.mainSortIndexes.get(sort.getPrefix(ctx.typeId)).?.*.keyIterator();
            while (it.next()) |start| {
                const sortIndex = try getSortIndex(ctx, start.*);
                try sort.writeField(ctx.id, data, sortIndex.?);
            }
        }
    } else if (ctx.currentSortIndex != null) {
        try sort.writeField(ctx.id, data, ctx.currentSortIndex.?);
    }

    return data.len;
}
