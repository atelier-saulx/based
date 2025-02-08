const c = @import("../../c.zig");
const errors = @import("../../errors.zig");
const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");
const getFields = @import("../include/include.zig").getFields;
const results = @import("../results.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const filter = @import("../filter/filter.zig").filter;
const sort = @import("../../db/sort.zig");
const types = @import("../../types.zig");
const hasId = @import("../hasId.zig").hasId;
const searchStr = @import("../filter/search.zig");
const readInt = @import("../../utils.zig").readInt;
const Result = @import("../results.zig").Result;
const s = @import("./search.zig");
const std = @import("std");

pub fn default(
    comptime desc: bool,
    ctx: *QueryCtx,
    offset: u32,
    limit: u32,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
    sortBuffer: []u8,
) !void {
    // [order] [prop] [propType] [start] [start] [len] [len]
    const field = sortBuffer[0];
    const start = readInt(u16, sortBuffer, 2);
    const sIndex = sort.getSortIndex(ctx.db.sortIndexes.get(typeId), field, start);
    if (sIndex == null) {
        std.log.err(
            "Err exec query (zig) no sort index aviable for query type: {any} field: {any} start: {any}  \n",
            .{ typeId, field, start },
        );
        return;
    }
    const typeEntry = try db.getType(ctx.db, typeId);
    const sI = sIndex.?;
    if (desc) {
        selva.selva_sort_foreach_begin_reverse(sI.index);
    } else {
        selva.selva_sort_foreach_begin(sI.index);
    }
    var correctedForOffset: u32 = offset;
    checkItem: while (!selva.selva_sort_foreach_done(sI.index)) {
        var node: db.Node = undefined;
        if (desc) {
            node = @ptrCast(selva.selva_sort_foreach_reverse(sI.index));
        } else {
            node = @ptrCast(selva.selva_sort_foreach(sI.index));
        }
        if (!filter(ctx.db, node, typeEntry, conditions, null, null, 0, false)) {
            continue :checkItem;
        }
        if (correctedForOffset != 0) {
            correctedForOffset -= 1;
            continue :checkItem;
        }
        const id = db.getNodeId(node);
        const size = try getFields(node, ctx, id, typeEntry, include, null, null, false);
        if (size > 0) {
            ctx.size += size;
            ctx.totalResults += 1;
        }
        if (ctx.totalResults >= limit) {
            break;
        }
    }
}

pub fn search(
    comptime desc: bool,
    ctx: *QueryCtx,
    offset: u32,
    limit: u32,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
    sortBuffer: []u8,
    searchCtx: *const searchStr.SearchCtx,
) !void {
    // [order] [prop] [propType] [start] [start] [len] [len]
    const field = sortBuffer[0];
    const start = readInt(u16, sortBuffer, 2);
    const sIndex = sort.getSortIndex(ctx.db.sortIndexes.get(typeId), field, start);
    if (sIndex == null) {
        std.log.err(
            "Err exec query (zig) no sort index aviable for query type: {any} field: {any} start: {any}  \n",
            .{ typeId, field, start },
        );
        return;
    }
    const typeEntry = try db.getType(ctx.db, typeId);
    const sI = sIndex.?;
    if (desc) {
        selva.selva_sort_foreach_begin_reverse(sI.index);
    } else {
        selva.selva_sort_foreach_begin(sI.index);
    }
    var searchCtxC = s.createSearchCtx(offset);
    while (!selva.selva_sort_foreach_done(sI.index)) {
        var node: db.Node = undefined;
        if (desc) {
            node = @ptrCast(selva.selva_sort_foreach_reverse(sI.index));
        } else {
            node = @ptrCast(selva.selva_sort_foreach(sI.index));
        }
        s.addToScore(ctx, &searchCtxC, node, typeEntry, conditions, searchCtx);
        if ((searchCtxC.totalSearchResults >= limit)) {
            break;
        }
    }
    try s.addToResults(ctx, &searchCtxC, include, limit, typeEntry);
}
