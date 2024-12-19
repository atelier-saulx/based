const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
// const sort = @import("../db/sort.zig");
const readInt = @import("../utils.zig").readInt;
const Modify = @import("./ctx.zig");
const std = @import("std");

const ModifyCtx = Modify.ModifyCtx;
// const getSortIndex = Modify.getSortIndex;

pub fn addEmptyToSortIndex(_: *ModifyCtx, data: []u8) !usize {
    const len = readInt(u16, data, 0);

    var i: usize = 0;
    while (i < len) : (i += 1) {
        // const field = data[i + 2];
        std.debug.print("hello add empty \n", .{});

        // const sortIndexName = sort.getSortName(ctx.typeId, field, 0);
        // if (sort.hasReadSortIndex(ctx.db, sortIndexName)) {
        //     var sortIndex = ctx.sortIndexes.get(sortIndexName);
        //     if (sortIndex == null) {
        //         sortIndex = try sort.createWriteSortIndex(ctx.db, sortIndexName, ctx.sortWriteTxn);
        //         try ctx.sortIndexes.put(sortIndexName, sortIndex.?);
        //     }
        //     try sort.writeField(ctx.id, sort.EMPTY_CHAR_SLICE, sortIndex.?);
        // }
    }
    return len + 2;
}
