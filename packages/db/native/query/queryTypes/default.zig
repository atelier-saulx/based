const std = @import("std");
const db = @import("../../db/db.zig");
const deflate = @import("../../deflate.zig");
const getFields = @import("../include/include.zig").getFields;
const results = @import("../results.zig");
const Query = @import("../common.zig");
const filter = @import("../filter/filter.zig").filter;
const searchStr = @import("../filter/search.zig");
const utils = @import("../../utils.zig");
const s = @import("./search.zig");
const t = @import("../../types.zig");

pub fn default(
    comptime hasFilter: bool,
    ctx: *Query.QueryCtx,
    header: *const t.QueryDefaultHeader,
    include: []u8,
    filterSlice: if (hasFilter) []u8 else void,
) !void {
    var correctedForOffset: u32 = header.offset;
    const typeEntry = try db.getType(ctx.db, header.typeId);
    var node = db.getFirstNode(typeEntry);
    checkItem: while (ctx.totalResults < header.limit) {
        if (node == null) {
            break :checkItem;
        }
        if (hasFilter and !filter(ctx.db, node.?, ctx.threadCtx, typeEntry, filterSlice, null, null, 0, false)) {
            node = db.getNextNode(typeEntry, node.?);
            continue :checkItem;
        }
        if (correctedForOffset != 0) {
            correctedForOffset -= 1;
            node = db.getNextNode(typeEntry, node.?);
            continue :checkItem;
        }
        const size = try getFields(node.?, ctx, db.getNodeId(node.?), typeEntry, include, null, null, false);
        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
        node = db.getNextNode(typeEntry, node.?);
    }
}

pub fn search(
    comptime isVector: bool,
    ctx: *Query.QueryCtx,
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
            ctx.threadCtx.decompressor,
            &ctx.threadCtx.libdeflateBlockState,
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
