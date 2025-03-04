const napi = @import("../napi.zig");
const db = @import("../db/db.zig");
const sort = @import("../db/sort.zig");
const read = @import("../utils.zig").read;
const Modify = @import("./ctx.zig");
const std = @import("std");
const ModifyCtx = Modify.ModifyCtx;
const types = @import("../types.zig");

pub fn addEmptyToSortIndex(ctx: *ModifyCtx, data: []u8) !usize {
    const len = read(u16, data, 0);
    var i: usize = 0;

    if (ctx.typeSortIndex == null) {
        return len + 2;
    }

    while (i < len) : (i += 1) {
        const field = data[i + 2];
        const sI = sort.getSortIndex(
            ctx.typeSortIndex,
            field,
            0,
            types.LangCode.NONE,
        );
        if (sI != null) {
            sort.insert(ctx.db, sI.?, sort.EMPTY_CHAR_SLICE, ctx.node.?);
        }
    }
    return len + 2;
}

pub fn addEmptyTextToSortIndex(ctx: *ModifyCtx, data: []u8) !usize {
    const len = read(u16, data, 0);
    if (ctx.typeSortIndex == null) {
        return len + 2;
    }
    var i: usize = 2;
    while (i < len) {
        const field = data[i];
        i += 1;
        const langs = data[i] + i + 1;
        i += 1;
        while (i < langs) {
            const lang: types.LangCode = @enumFromInt(data[i]);
            const sI = sort.getSortIndex(
                ctx.typeSortIndex,
                field,
                0,
                lang,
            );
            if (sI != null) {
                sort.insert(ctx.db, sI.?, sort.EMPTY_CHAR_SLICE, ctx.node.?);
            }
            i += 1;
        }
    }
    return len + 2;
}
