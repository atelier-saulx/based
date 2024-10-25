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
    const typeEntry = try db.getType(ctx.db, typeId);
    // pass this refactor single ref
    const node = db.getNode(id, typeEntry);

    if (node == null) {
        return;
    }

    if (!filter(ctx.db, node.?, typeEntry, conditions, null)) {
        return;
    }

    const size = try getFields(
        node.?,
        ctx,
        id,
        typeEntry,
        include,
        null,
        false,
    );

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
    const typeEntry = try db.getType(ctx.db, typeId);
    var i: u32 = 0;
    checkItem: while (i < ids.len) : (i += 4) {
        const id = utils.readInt(u32, ids, i);
        const node = db.getNode(id, typeEntry);
        if (node == null) {
            continue :checkItem;
        }
        if (!filter(ctx.db, node.?, typeEntry, conditions, null)) {
            continue :checkItem;
        }
        const size = try getFields(
            node.?,
            ctx,
            id,
            typeEntry,
            include,
            null,
            false,
        );

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

    const typeEntry = try db.getType(ctx.db, typeId);

    var first = true;
    var node = db.getFirstNode(typeEntry);

    checkItem: while (ctx.totalResults < limit) {
        if (first) {
            first = false;
        } else {
            node = db.getNextNode(typeEntry, node.?);
        }

        if (node == null) {
            break :checkItem;
        }

        if (!filter(ctx.db, node.?, typeEntry, conditions, null)) {
            continue :checkItem;
        }

        if (correctedForOffset != 0) {
            correctedForOffset -= 1;
            continue :checkItem;
        }

        const size = try getFields(
            node.?,
            ctx,
            db.getNodeId(node.?),
            typeEntry,
            include,
            null,
            false,
        );

        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
    }
}
