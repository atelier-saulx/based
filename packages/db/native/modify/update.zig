const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("../env/env.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const Modify = @import("./ctx.zig");
const readInt = @import("../utils.zig").readInt;

const ModifyCtx = Modify.ModifyCtx;
const getShard = Modify.getShard;
const getSortIndex = Modify.getSortIndex;

pub fn updateField(ctx: ModifyCtx, batch: []u8) usize {
    // UPDATE WHOLE FIELD
    const operationSize = readInt(u32, batch, 0);
    const size = operationSize + 4;
    const shard = getShard(ctx).?;
    const data = batch[4..size];

    if (ctx.field == 0) {
        if (sort.hasMainSortIndexes(ctx.typeId)) {
            const currentData = db.readField(ctx.id, shard);
            var it = sort.mainSortIndexes.get(ctx.typeId).?.*.keyIterator();
            while (it.next()) |key| {
                const start = key.*;
                const sortIndex = getSortIndex(ctx, start).?;
                sort.deleteField(ctx.id, currentData, sortIndex);
                sort.writeField(ctx.id, data, sortIndex);
            }
        }
    } else if (ctx.currentSortIndex != null) {
        const currentData = db.readField(ctx.id, shard);
        sort.deleteField(ctx.id, currentData, ctx.currentSortIndex.?);
        sort.writeField(ctx.id, data, ctx.currentSortIndex.?);
    }
    db.writeField(ctx.id, data, shard) catch {};
    return size;
}

pub fn updatePartialField(ctx: ModifyCtx, batch: []u8) usize {
    const operationSize = readInt(u32, batch, 0);
    const size = operationSize + 4;
    const shard = getShard(ctx).?;
    const data = batch[4..size];

    var currentData = db.readField(ctx.id, shard);
    if (currentData.len != 0) {
        var j: usize = 0;
        const hasSortIndex: bool = (ctx.field == 0 and sort.hasMainSortIndexes(ctx.typeId));
        while (j < data.len) {
            const operation = data[j..];
            const start = readInt(u16, operation, 0);
            const len = readInt(u16, operation, 2);
            if (ctx.field == 0) {
                if (hasSortIndex) {
                    const key = sort.mainSortIndexes.get(ctx.typeId).?.*.get(start);
                    if (key != null) {
                        const sortIndex = getSortIndex(ctx, start).?;
                        sort.deleteField(ctx.id, currentData, sortIndex);
                        sort.writeField(ctx.id, data, sortIndex);
                    }
                }
                @memcpy(currentData[start .. start + len], operation[4 .. 4 + len]);
            } else if (ctx.currentSortIndex != null) {
                sort.deleteField(ctx.id, currentData, ctx.currentSortIndex.?);
                sort.writeField(ctx.id, currentData, ctx.currentSortIndex.?);
                @memcpy(currentData[start .. start + len], operation[4 .. 4 + len]);
            } else {
                @memcpy(currentData[start .. start + len], operation[4 .. 4 + len]);
            }
            j += 4 + len;
        }
    } else {
        // what to do now?
        std.log.err("Partial update id: {d} field: {d} does not exist \n", .{ ctx.id, ctx.field });
    }
    return size;
}
