const std = @import("std");
const db = @import("../../db/db.zig");
const getFields = @import("../include/include.zig").getFields;
const results = @import("../results.zig");
const Query = @import("../common.zig");
const filter = @import("../filter/filter.zig").filter;
const t = @import("../../types.zig");

pub fn default(
    id: u32,
    ctx: *Query.QueryCtx,
    typeId: t.TypeId,
    conditions: []u8,
    include: []u8,
) !void {
    const typeEntry = try db.getType(ctx.db, typeId);
    if (db.getNode(typeEntry, id)) |node| {
        if (!filter(ctx.db, node, typeEntry, conditions, null, null, 0, false)) {
            return;
        }

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
