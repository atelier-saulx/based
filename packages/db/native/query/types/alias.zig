const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");
const getFields = @import("../include/include.zig").getFields;
const results = @import("../results.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const filter = @import("../filter/filter.zig").filter;
const std = @import("std");

pub fn default(
    field: u8,
    value: []u8,
    ctx: *QueryCtx,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
) !void {
    const typeEntry = try db.getType(ctx.db, typeId);
    if (db.getAliasByName(typeEntry, field, value)) |node| {
        if (!filter(ctx, node, typeEntry, conditions, null, null, 0, false)) {
            return;
        }
        const size = try getFields(
            node,
            ctx,
            db.getNodeId(node),
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
