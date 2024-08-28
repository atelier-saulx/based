const db = @import("../db/db.zig");
const readInt = @import("../utils.zig").readInt;
const Modify = @import("./ctx.zig");
const sort = @import("../db/sort.zig");
const selva = @import("../selva.zig");

const std = @import("std");

const ModifyCtx = Modify.ModifyCtx;
const getOrCreateShard = Modify.getOrCreateShard;
const getSortIndex = Modify.getSortIndex;

// createNode(id, type)
// createField()
//

pub fn createField(ctx: *ModifyCtx, batch: []u8) !usize {
    const operationSize = readInt(u32, batch, 0);
    // const shard = try getOrCreateShard(ctx);
    const size = operationSize + 4;
    const data = batch[4..size];

    // bla

    // TODO: get rid of the field

    // std.log.err("CREATED AND GET PTR TO NODE {any} \n", .{ctx.selvaNode});

    if (selva.selva_fields_set(db.ctx.selva, ctx.selvaNode, ctx.selvaFieldSchema, data.ptr, data.len) != 0) {
        std.log.err("flapo", .{});
    }

    // try db.writeField(ctx.id, data, shard);

    if (ctx.field == 0) {
        if (sort.hasMainSortIndexes(ctx.typeId)) {
            var it = db.ctx.mainSortIndexes.get(ctx.typeId).?.*.keyIterator();
            while (it.next()) |start| {
                const sortIndex = try getSortIndex(ctx, start.*);
                try sort.writeField(ctx.id, data, sortIndex.?);
            }
        }
    } else if (ctx.currentSortIndex != null) {
        try sort.writeField(ctx.id, data, ctx.currentSortIndex.?);
    }

    return size;
}
