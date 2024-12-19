const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const Modify = @import("./ctx.zig");
const std = @import("std");

const ModifyCtx = Modify.ModifyCtx;
const getSortIndex = Modify.getSortIndex;

pub fn deleteField(ctx: *ModifyCtx) !usize {
    if (ctx.field == 0) {
        if (ctx.typeSortIndex != null) {
            var currentData: ?[]u8 = null;
            var it = ctx.typeSortIndex.?.main.iterator();
            while (it.next()) |entry| {
                if (currentData == null) {
                    currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?);
                }
                sort.removeFromSortIndex(entry.value_ptr.*, currentData.?, ctx.node.?);
            }
        }
        return 0;
    }
    if (ctx.currentSortIndex != null) {
        const currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?);
        sort.removeFromSortIndex(ctx.currentSortIndex.?, currentData, ctx.node.?);
    }
    return 0;
}

pub fn deleteFieldOnly(ctx: *ModifyCtx) !usize {
    if (ctx.currentSortIndex != null) {
        const currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?);
        sort.removeFromSortIndex(ctx.currentSortIndex.?, currentData, ctx.node.?);
    }
    return 0;
}

pub fn deleteFieldOnlyReal(ctx: *ModifyCtx) !usize {
    if (ctx.currentSortIndex != null) {
        const currentData = db.getField(ctx.typeEntry, ctx.id, ctx.node.?, ctx.fieldSchema.?);
        sort.removeFromSortIndex(ctx.currentSortIndex.?, currentData, ctx.node.?);
    }
    try db.deleteField(ctx.db, ctx.typeEntry.?, ctx.id, ctx.node.?, ctx.fieldSchema.?);
    return 0;
}
