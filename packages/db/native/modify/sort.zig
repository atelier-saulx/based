const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const readInt = @import("../utils.zig").readInt;
const Modify = @import("./ctx.zig");
const std = @import("std");
const ModifyCtx = Modify.ModifyCtx;

pub fn addEmptyToSortIndex(ctx: *ModifyCtx, data: []u8) !usize {
    const len = readInt(u16, data, 0);
    var i: usize = 0;
    if (ctx.typeSortIndex == null) {
        return len + 2;
    }
    while (i < len) : (i += 1) {
        const field = data[i + 2];
        const sI = sort.getSortIndex(ctx.typeSortIndex, field, 0);
        if (sI != null) {
            sort.addToSortIndex(ctx.db, sI.?, sort.EMPTY_CHAR_SLICE, ctx.node.?);
        }
    }
    return len + 2;
}
