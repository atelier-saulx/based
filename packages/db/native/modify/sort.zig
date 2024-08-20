const std = @import("std");
const c = @import("../c.zig");
const errors = @import("../errors.zig");
const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const readInt = @import("../utils.zig").readInt;
const Modify = @import("./ctx.zig");

const ModifyCtx = Modify.ModifyCtx;
const getSortIndex = Modify.getSortIndex;

const SPACE_CHAR: [1]u8 = .{32};
const pointer = @constCast(&SPACE_CHAR);

pub fn addEmptyToSortIndex(ctx: *ModifyCtx, data: []u8) !usize {
    const len = readInt(u16, data, 0);

    var i: usize = 0;
    while (i < len) : (i += 1) {
        const field = data[i + 2];
        const sortIndexName = sort.getSortName(ctx.typeId, field, 0);

        // std.debug.print("DERP mep field: {d} id: {d} {any} \n", .{ field, ctx.id, sortIndexName });

        if (sort.hasReadSortIndex(sortIndexName)) {
            var sortIndex = ctx.sortIndexes.get(sortIndexName);
            if (sortIndex == null) {
                sortIndex = try sort.createWriteSortIndex(sortIndexName, ctx.txn);
                try ctx.sortIndexes.put(sortIndexName, sortIndex.?);
            }
            // std.debug.print("mep mep {any} {d} \n", .{ pointer, ctx.id });
            try sort.writeField(ctx.id, pointer, sortIndex.?);
        }
    }

    return len + 2;
}
