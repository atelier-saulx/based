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
    const typeEntry = try db.getType(typeId);
    // pass this refactor single ref
    const node = db.getNode(id, typeEntry);

    if (node == null) {
        return;
    }

    if (!filter(node.?, typeEntry, conditions)) {
        return;
    }

    const size = try getFields(node.?, ctx, id, typeEntry, null, include, 0);
    if (size > 0) {
        ctx.size += size;
        ctx.totalResults += 1;
    }
}

pub fn queryIds(
    ids: []u8,
    ctx: *QueryCtx,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
) !void {
    const typeEntry = try db.getType(typeId);

    var i: u32 = 0;
    checkItem: while (i <= ids.len) : (i += 4) {
        const id = std.mem.readInt(u32, ids[i..][0..4], .little);

        const node = db.getNode(id, typeEntry);
        if (node == null) {
            continue :checkItem;
        }

        if (!filter(node.?, typeEntry, conditions)) {
            continue :checkItem;
        }

        const size = try getFields(node.?, ctx, id, typeEntry, null, include, 0);

        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
    }
}

pub fn query(
    ctx: *QueryCtx,
    offset: u32,
    limit: u32,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
) !void {
    var correctedForOffset: u32 = offset;

    const typeEntry = try db.getType(typeId);

    var first = true;
    var node = selva.selva_min_node(typeEntry);

    checkItem: while (ctx.totalResults < limit) {
        if (first) {
            first = false;
        } else {
            node = selva.selva_next_node(typeEntry, node);
        }

        if (node == null) {
            break :checkItem;
        }

        if (!filter(node.?, typeEntry, conditions)) {
            continue :checkItem;
        }

        if (correctedForOffset != 0) {
            correctedForOffset -= 1;
            continue :checkItem;
        }

        const size = try getFields(node.?, ctx, selva.selva_get_node_id(node), typeEntry, null, include, 0);

        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
    }
}
