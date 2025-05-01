const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");
const getFields = @import("../include/include.zig").getFields;
const results = @import("../results.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const AggFn = @import("../../types.zig").AggFn;
const filter = @import("../filter/filter.zig").filter;
const searchStr = @import("../filter/search.zig");
const s = @import("./search.zig");
const std = @import("std");
const utils = @import("../../utils.zig");
const t = @import("../../types.zig");

pub fn default(
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
        if (!filter(ctx.db, node.?, typeEntry, conditions, null, null, 0, false)) {
            continue :checkItem;
        }
        if (correctedForOffset != 0) {
            correctedForOffset -= 1;
            continue :checkItem;
        }
        const size = try getFields(node.?, ctx, db.getNodeId(node.?), typeEntry, include, null, null, false);
        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
    }
}

pub fn search(
    comptime isVector: bool,
    ctx: *QueryCtx,
    offset: u32,
    limit: u32,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
    searchCtx: *const searchStr.SearchCtx(isVector),
) !void {
    const typeEntry = try db.getType(ctx.db, typeId);
    var first = true;
    var node = db.getFirstNode(typeEntry);
    var searchCtxC = s.createSearchCtx(isVector, offset);
    checkItem: while (searchCtxC.totalSearchResults < limit) {
        if (first) {
            first = false;
        } else {
            node = db.getNextNode(typeEntry, node.?);
        }
        if (node == null) {
            break :checkItem;
        }
        s.addToScore(
            isVector,
            ctx,
            &searchCtxC,
            node.?,
            typeEntry,
            conditions,
            searchCtx,
        );
    }
    try s.addToResults(isVector, ctx, &searchCtxC, include, limit, typeEntry);
}
