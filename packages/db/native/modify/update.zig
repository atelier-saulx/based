const std = @import("std");
const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const Modify = @import("./ctx.zig");
const readInt = @import("../utils.zig").readInt;
const ModifyCtx = Modify.ModifyCtx;
const getSortIndex = Modify.getSortIndex;
const references = @import("./references.zig");

// TODO: add multiple REFERENCES

pub fn updateField(ctx: *ModifyCtx, data: []u8) !usize {
    if (ctx.fieldType == 14) {
        try references.updateReferences(ctx, data);
    } else if (ctx.field == 0) {
        if (sort.hasMainSortIndexes(ctx.typeId)) {
            const currentData = db.getField(ctx.node.?, ctx.fieldSchema.?);
            var it = db.ctx.mainSortIndexes.get(sort.getPrefix(ctx.typeId)).?.*.keyIterator();
            while (it.next()) |key| {
                const start = key.*;
                const sortIndex = (try getSortIndex(ctx, start)).?;
                try sort.deleteField(ctx.id, currentData, sortIndex);
                try sort.writeField(ctx.id, data, sortIndex);
            }
        }
    } else if (ctx.fieldSchema.?.*.type == 13) {
        const id = readInt(u32, data, 0);
        const refTypeId = db.getTypeIdFromFieldSchema(ctx.fieldSchema.?);
        const refTypeEntry = try db.getType(refTypeId);
        const node = db.getNode(id, refTypeEntry);
        if (node == null) {
            std.debug.print("Cannot find reference to {d} \n", .{id});
        } else {
            std.debug.print("Ref found {d} node: {any} currentNode: {any}  types ref: {any} target: {any} \n", .{ id, node, ctx.node, refTypeEntry, ctx.typeEntry });
            try db.writeReference(node.?, ctx.node.?, ctx.fieldSchema.?);
        }
    } else if (ctx.currentSortIndex != null) {
        const currentData = db.getField(ctx.node.?, ctx.fieldSchema.?);
        try sort.deleteField(ctx.id, currentData, ctx.currentSortIndex.?);
        try sort.writeField(ctx.id, data, ctx.currentSortIndex.?);
    }

    try db.writeField(data, ctx.node.?, ctx.fieldSchema.?);

    return data.len;
}

pub fn updatePartialField(ctx: *ModifyCtx, data: []u8) !usize {
    var currentData = db.getField(ctx.node.?, ctx.fieldSchema.?);

    if (currentData.len != 0) {
        var j: usize = 0;
        const hasSortIndex: bool = (ctx.field == 0 and sort.hasMainSortIndexes(ctx.typeId));
        while (j < data.len) {
            const operation = data[j..];
            const start = readInt(u16, operation, 0);
            const len = readInt(u16, operation, 2);
            if (ctx.field == 0) {
                if (hasSortIndex and db.ctx.mainSortIndexes.get(sort.getPrefix(ctx.typeId)).?.*.contains(start)) {
                    const sortIndex = try getSortIndex(ctx, start);
                    try sort.deleteField(ctx.id, currentData, sortIndex.?);
                    try sort.writeField(ctx.id, operation[4 .. len + 4], sortIndex.?);
                }
                @memcpy(currentData[start .. start + len], operation[4 .. 4 + len]);
            } else if (ctx.currentSortIndex != null) {
                try sort.deleteField(ctx.id, currentData, ctx.currentSortIndex.?);
                try sort.writeField(ctx.id, currentData, ctx.currentSortIndex.?);
                @memcpy(currentData[start .. start + len], operation[4 .. 4 + len]);
            } else {
                @memcpy(currentData[start .. start + len], operation[4 .. 4 + len]);
            }
            j += 4 + len;
        }
    } else {
        std.log.err("Partial update id: {d} field: {d} does not exist \n", .{ ctx.id, ctx.field });
    }

    return data.len;
}
