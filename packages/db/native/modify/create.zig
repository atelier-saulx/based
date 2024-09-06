const db = @import("../db/db.zig");
const readInt = @import("../utils.zig").readInt;
const Modify = @import("./ctx.zig");
const sort = @import("../db/sort.zig");
const selva = @import("../selva.zig");
const errors = @import("../errors.zig");
const utils = @import("../utils.zig");

const std = @import("std");

const ModifyCtx = Modify.ModifyCtx;
const getOrCreateShard = Modify.getOrCreateShard;
const getSortIndex = Modify.getSortIndex;

pub fn createField(ctx: *ModifyCtx, data: []u8) !void {

    // get type
    // std.debug.print("CREATE type {any} field {d} {d} {any}  {any} \n", .{ ctx.fieldSchema.?.*, ctx.typeId, ctx.field, ctx.id, data });

    // CTX.

    if (ctx.fieldSchema.?.*.type == 13) {
        const id = utils.readInt(u32, data, 0);
        const refTypeId = try db.getTypeIdFromFieldSchema(ctx.fieldSchema.?);
        const refTypeEntry = try db.getType(refTypeId);
        const node = db.getNode(id, refTypeEntry);
        if (node == null) {
            std.debug.print("Cannot find reference to {d} \n", .{id});
        } else {
            std.debug.print("Ref found {d} node: {any} currentNode: {any}  types ref: {any} target: {any} \n", .{ id, node, ctx.node, refTypeEntry, ctx.typeEntry });
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
}
