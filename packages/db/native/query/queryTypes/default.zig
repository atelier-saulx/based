const db = @import("../../db/db.zig");
const deflate = @import("../../deflate.zig");
const getFields = @import("../include/include.zig").getFields;
const results = @import("../results.zig");
const QueryCtx = @import("../common.zig").QueryCtx;
const AggFn = @import("../../types.zig").AggFn;
const filter = @import("../filter/filter.zig").filter;
const searchStr = @import("../filter/search.zig");
const s = @import("./search.zig");
const std = @import("std");
const utils = @import("../../utils.zig");
const t = @import("../../types.zig");
const FilterType = @import("../common.zig").FilterType;
const QueryDefaultHeader = @import("../common.zig").QueryDefaultHeader;

const filterTypes = @import("../filter//types.zig");

const runConditions = @import("../filter/conditions.zig").runConditions;

pub fn default(
    comptime hasFilter: bool,
    ctx: *QueryCtx,
    header: *const QueryDefaultHeader,
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
