const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const Envs = @import("../env/env.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const readInt = @import("../utils.zig").readInt;
const Modify = @import("./ctx.zig");

const ModifyCtx = Modify.ModifyCtx;
const getShard = Modify.getShard;
const getSortIndex = Modify.getSortIndex;

pub fn createField(ctx: ModifyCtx, batch: []u8) usize {
    const operationSize = readInt(u32, batch, 0);
    const shard = getShard(ctx).?;
    const size = operationSize + 4;
    const data = batch[4..size];

    db.writeField(ctx.id, data, shard) catch {};
    if (ctx.field == 0) {
        if (sort.hasMainSortIndexes(ctx.typeId)) {
            var it = sort.mainSortIndexes.get(ctx.typeId).?.*.keyIterator();
            while (it.next()) |start| {
                const sortIndex = getSortIndex(ctx, start.*).?;
                sort.writeField(ctx.id, data, sortIndex);
            }
        }
    } else if (ctx.currentSortIndex != null) {
        sort.writeField(ctx.id, data, ctx.currentSortIndex.?);
    }

    return size;
}
