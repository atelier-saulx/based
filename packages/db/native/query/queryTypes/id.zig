const db = @import("../../db/db.zig");
const getFields = @import("../include/include.zig").getFields;
const results = @import("../results.zig");
const QueryCtx = @import("../common.zig").QueryCtx;
const filter = @import("../filter/filter.zig").filter;

const std = @import("std");

pub fn default(
    id: u32,
    ctx: *QueryCtx,
    typeId: db.TypeId,
    _: []u8,
    include: []u8,
) !void {
    const typeEntry = try db.getType(ctx.db, typeId);
    if (db.getNode(typeEntry, id)) |node| {
        // std.debug.print("yo yo yo {any} {any} {any} \n", .{ node, conditions, include });

        // if (!filter(ctx.db, node, typeEntry, conditions, null, null, 0, false)) {
        //     return;
        // }
        // std.debug.print("PASS -> {any} {any} {any} \n", .{ node, conditions, include });

        const size = try getFields(
            node,
            ctx,
            id,
            typeEntry,
            include,
            null,
            null,
            false,
        );

        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
    }
}
