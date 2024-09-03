const c = @import("../../c.zig");
const errors = @import("../../errors.zig");
const std = @import("std");
const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");
const getFields = @import("../include/include.zig").getFields;
const results = @import("../results.zig");
const QueryCtx = @import("../ctx.zig").QueryCtx;
const filter = @import("../filter/filter.zig").filter;
const utils = @import("../../utils.zig");
const hasId = @import("../hasId.zig").hasId;
const mem = std.mem;

pub fn queryId(
    id: u32,
    ctx: *QueryCtx,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
) !void {
    const selvaTypeEntry: *selva.SelvaTypeEntry = selva.selva_get_type_by_index(db.ctx.selva.?, @bitCast(typeId)).?;

    // pass this refactor single ref
    if (filter(id, typeId, conditions)) {
        const size = try getFields(ctx, id, selvaTypeEntry, null, include, 0);
        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
    }
}

pub fn queryIds(
    ids: []u8,
    ctx: *QueryCtx,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
) !void {
    const selvaTypeEntry: *selva.SelvaTypeEntry = selva.selva_get_type_by_index(db.ctx.selva.?, @bitCast(typeId)).?;

    var i: u32 = 0;
    checkItem: while (i <= ids.len) : (i += 4) {
        const id = std.mem.readInt(u32, ids[i..][0..4], .little);
        if (!filter(id, typeId, conditions)) {
            continue :checkItem;
        }
        const size = try getFields(ctx, id, selvaTypeEntry, null, include, 0);
        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
    }
}

pub fn query(
    ctx: *QueryCtx,
    lastId: u32,
    offset: u32,
    limit: u32,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
) !void {
    var i: u32 = 1;
    var correctedForOffset: u32 = offset;

    const selvaTypeEntry: *selva.SelvaTypeEntry = try db.getSelvaTypeEntry(typeId);

    checkItem: while (i <= lastId and ctx.totalResults < limit) : (i += 1) {
        if (!filter(i, typeId, conditions)) {
            continue :checkItem;
        }

        if (correctedForOffset != 0) {
            correctedForOffset -= 1;
            continue :checkItem;
        }

        const size = try getFields(ctx, i, selvaTypeEntry, null, include, 0);

        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
    }
}
