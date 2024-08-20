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

pub fn deleteField(ctx: *ModifyCtx) !usize {
    const shard = try getOrCreateShard(ctx);
    const currentData = db.deleteField(ctx.id, shard) catch {
        return 0;
    };

    if (ctx.field == 0) {
        if (sort.hasMainSortIndexes(ctx.typeId)) {
            var it = sort.mainSortIndexes.get(ctx.typeId).?.*.keyIterator();
            while (it.next()) |key| {
                const start = key.*;
                const sortIndex = (try getSortIndex(ctx, start)).?;
                try sort.deleteField(ctx.id, currentData, sortIndex);
            }
        }
    } else if (ctx.currentSortIndex != null) {
        try sort.deleteField(ctx.id, currentData, ctx.currentSortIndex.?);
    }

    return 0;
}
