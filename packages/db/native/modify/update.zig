const std = @import("std");
const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const Modify = @import("./ctx.zig");
const readInt = @import("../utils.zig").readInt;

const ModifyCtx = Modify.ModifyCtx;
const getSortIndex = Modify.getSortIndex;

pub fn updateField(ctx: *ModifyCtx, batch: []u8) !usize {
    const operationSize = readInt(u32, batch, 0);
    const size = operationSize + 4;
    const data = batch[4..size];

    if (ctx.field == 0) {
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
    } else if (ctx.currentSortIndex != null) {
        const currentData = db.getField(ctx.node.?, ctx.fieldSchema.?);
        try sort.deleteField(ctx.id, currentData, ctx.currentSortIndex.?);
        try sort.writeField(ctx.id, data, ctx.currentSortIndex.?);
    }

    try db.writeField(data, ctx.node.?, ctx.fieldSchema.?);

    return size;
}

pub fn updatePartialField(ctx: *ModifyCtx, batch: []u8) !usize {
    const operationSize = readInt(u32, batch, 0);
    const size = operationSize + 4;
    const data = batch[4..size];

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
                    try sort.writeField(ctx.id, data, sortIndex.?);
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

    return size;
}
