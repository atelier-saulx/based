const db = @import("../../db/db.zig");
const dbSort = @import("../../db/sort.zig");
const selva = @import("../../selva.zig").c;
const getFields = @import("../include/include.zig").getFields;
const results = @import("../results.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const filter = @import("../filter/filter.zig").filter;
const types = @import("../../types.zig");
const read = @import("../../utils.zig").read;
const std = @import("std");
const searchStr = @import("../filter/search.zig");
const s = @import("./search.zig");

pub fn sort(
    comptime desc: bool,
    ids: []u8,
    ctx: *QueryCtx,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
    sortBuffer: []u8,
    offset: u32,
    limit: u32,
) !void {
    const typeEntry = try db.getType(ctx.db, typeId);
    var i: u32 = 0;
    var start: u16 = undefined;
    var len: u16 = undefined;
    const sortField: u8 = sortBuffer[0];
    const sortProp: types.Prop = @enumFromInt(sortBuffer[1]);
    const lang: types.LangCode = @enumFromInt(sortBuffer[6]);
    start = read(u16, sortBuffer, 2);
    len = read(u16, sortBuffer, 4);
    // --------------------------------
    var metaSortIndex = try dbSort.createSortIndexMeta(start, len, sortProp, desc, lang, sortField);
    const fieldSchema = try db.getFieldSchema(typeEntry, sortField);
    sortItem: while (i < ids.len) : (i += 4) {
        const id = read(u32, ids, i);
        const node = db.getNode(typeEntry, id);
        if (node == null) {
            continue :sortItem;
        }
        if (!filter(ctx.db, node.?, ctx.threadCtx, typeEntry, conditions, null, null, 0, false)) {
            continue :sortItem;
        }
        const value = db.getField(typeEntry, node.?, fieldSchema, sortProp);
        dbSort.insert(ctx.threadCtx.decompressor, &metaSortIndex, value, node.?);
    }
    // ------------------------------
    var it: selva.SelvaSortIterator = undefined;
    selva.selva_sort_foreach_begin(metaSortIndex.index, &it);
    while (!selva.selva_sort_foreach_done(&it)) {
        const node: db.Node = @ptrCast(selva.selva_sort_foreach(metaSortIndex.index, &it));
        ctx.totalResults += 1;
        if (offset != 0 and ctx.totalResults <= offset) {
            continue;
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
        }
        if (ctx.totalResults - offset >= limit) {
            break;
        }
    }
    if (offset != 0) {
        ctx.totalResults -= offset;
    }
    selva.selva_sort_destroy(metaSortIndex.index);
}

// add opt filter
pub fn default(
    ids: []u8,
    ctx: *QueryCtx,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
) !void {
    const typeEntry = try db.getType(ctx.db, typeId);
    var i: u32 = 0;
    checkItem: while (i < ids.len) : (i += 4) {
        const id = read(u32, ids, i);
        const node = db.getNode(typeEntry, id);
        if (node == null) {
            continue :checkItem;
        }
        if (!filter(ctx.db, node.?, ctx.threadCtx, typeEntry, conditions, null, null, 0, false)) {
            continue :checkItem;
        }
        const size = try getFields(
            node.?,
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

pub fn search(
    comptime isVector: bool,
    ids: []u8,
    ctx: *QueryCtx,
    typeId: db.TypeId,
    conditions: []u8,
    include: []u8,
    searchCtx: *const searchStr.SearchCtx(isVector),
) !void {
    const typeEntry = try db.getType(ctx.db, typeId);
    var i: u32 = 0;
    var searchCtxC = s.createSearchCtx(isVector, 0);
    checkItem: while (i < ids.len) : (i += 4) {
        const id = read(u32, ids, i);
        const node = db.getNode(typeEntry, id);
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
    try s.addToResults(
        isVector,
        ctx,
        &searchCtxC,
        include,
        @as(u32, @truncate(ids.len)) / 4,
        typeEntry,
    );
}
