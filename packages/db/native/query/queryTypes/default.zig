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
const FilterType = @import("../types.zig").FilterType;
const filterTypes = @import("../filter//types.zig");

const runConditions = @import("../filter/conditions.zig").runConditions;

pub fn default(
    comptime filterType: FilterType,
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
        // Todo measure if this optmizes things
        if (filterType == FilterType.default) {
            if (!filter(ctx.db, node.?, typeEntry, conditions, null, null, 0, false)) {
                continue :checkItem;
            }
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

pub fn defaultSimpleFilter(
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
    const fieldSchema = try db.getFieldSchema(typeEntry, t.MAIN_PROP);

    const querySize: u16 = utils.read(u16, conditions, 1);
    const query = conditions[3 .. querySize + 3];
    checkItem: while (ctx.totalResults < limit) {
        if (first) {
            first = false;
        } else {
            node = db.getNextNode(typeEntry, node.?);
        }
        if (node == null) {
            break :checkItem;
        }
        const value = db.getField(typeEntry, 0, node.?, fieldSchema, t.Prop.MICRO_BUFFER);
        if (value.len == 0 or !runConditions(query, value)) {
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
