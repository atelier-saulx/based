const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const Modify = @import("./ctx.zig");

const ModifyCtx = Modify.ModifyCtx;
const getOrCreateShard = Modify.getOrCreateShard;
const getSortIndex = Modify.getSortIndex;

const SPACE_CHAR: [1]u8 = .{32};
const SPACE_CHAR_SLICE = @constCast(&SPACE_CHAR)[0..1];

pub fn deleteField(ctx: *ModifyCtx) !usize {
    if (ctx.field == 0) {
        const shard = try getOrCreateShard(ctx);
        const currentData: []u8 = db.deleteField(ctx.id, shard) catch {
            return 0;
        };

        if (sort.hasMainSortIndexes(ctx.typeId)) {
            var it = sort.mainSortIndexes.get(ctx.typeId).?.*.keyIterator();
            while (it.next()) |key| {
                const start = key.*;
                const sortIndex = (try getSortIndex(ctx, start)).?;
                try sort.deleteField(ctx.id, currentData, sortIndex);
            }
        }

        return 0;
    }

    const shard = try getOrCreateShard(ctx);

    const currentData: []u8 = db.deleteField(ctx.id, shard) catch SPACE_CHAR_SLICE;

    if (ctx.currentSortIndex != null) {
        sort.deleteField(ctx.id, currentData, ctx.currentSortIndex.?) catch {
            return 0;
        };
    }

    return 0;
}

pub fn deleteFieldOnly(ctx: *ModifyCtx) !usize {
    const shard = try getOrCreateShard(ctx);

    const currentData: ?[]u8 = db.deleteField(ctx.id, shard) catch null;

    if (ctx.currentSortIndex != null and currentData != null) {
        try sort.deleteField(ctx.id, currentData.?, ctx.currentSortIndex.?);
        try sort.writeField(ctx.id, SPACE_CHAR_SLICE, ctx.currentSortIndex.?);
    }

    return 0;
}
