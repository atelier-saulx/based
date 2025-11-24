const db = @import("../../db/db.zig");
const Node = @import("../../db/node.zig");
const getThreadCtx = @import("../../db/ctx.zig").getThreadCtx;
const selva = @import("../../selva.zig").c;
const getFields = @import("../include/include.zig").getFields;
const results = @import("../results.zig");
const Query = @import("../common.zig");
const filter = @import("../filter/filter.zig").filter;
const sort = @import("../../db/sort.zig");
const types = @import("../../types.zig");
const searchStr = @import("../filter/search.zig");
const read = @import("../../utils.zig").read;
const Result = @import("../results.zig").Result;
const s = @import("./search.zig");
const std = @import("std");
const t = @import("../../types.zig");

pub fn default(
    comptime desc: bool,
    comptime hasFilter: bool,
    ctx: *Query.QueryCtx,
    sortIndex: ?*sort.SortIndexMeta,
    header: *const t.QueryDefaultHeader,
    include: []u8,
    filterSlice: if (hasFilter) []u8 else void,
) !void {
    if (sortIndex) |sI| {
        const typeEntry = try db.getType(ctx.db, header.typeId);
        var it: selva.SelvaSortIterator = undefined;
        if (desc) {
            selva.selva_sort_foreach_begin_reverse(sI.index, &it);
        } else {
            selva.selva_sort_foreach_begin(sI.index, &it);
        }
        // create a new iterator per CORE
        var correctedForOffset: u32 = header.offset;
        checkItem: while (!selva.selva_sort_foreach_done(&it)) {
            var node: Node.Node = undefined;
            if (desc) {
                node = @ptrCast(selva.selva_sort_foreach_reverse(sI.index, &it));
            } else {
                node = @ptrCast(selva.selva_sort_foreach(sI.index, &it));
            }

            if (hasFilter and !filter(ctx.db, node, ctx.threadCtx, typeEntry, filterSlice, null, null, 0, false)) {
                continue :checkItem;
            }

            if (correctedForOffset != 0) {
                correctedForOffset -= 1;
                continue :checkItem;
            }
            const id = Node.getNodeId(node);
            const size = try getFields(node, ctx, id, typeEntry, include, null, null, false);
            if (size > 0) {
                ctx.size += size;
                ctx.totalResults += 1;
            }
            if (ctx.totalResults >= header.limit) {
                break;
            }
        }
    } else {
        std.log.err(
            "Err exec query (zig) no sort index available for query {any} \n",
            .{header},
        );
    }
}

pub fn idDesc(
    comptime hasFilter: bool,
    ctx: *Query.QueryCtx,
    header: *const t.QueryDefaultHeader,
    include: []u8,
    filterSlice: if (hasFilter) []u8 else void,
) !void {
    var correctedForOffset: u32 = header.offset;
    const typeEntry = try db.getType(ctx.db, header.typeId);
    var first = true;
    var node = Node.getLastNode(typeEntry);
    checkItem: while (ctx.totalResults < header.limit) {
        if (first) {
            first = false;
        } else {
            node = Node.getPrevNode(typeEntry, node.?);
        }
        if (node) |n| {
            if (hasFilter and !filter(ctx.db, n, ctx.threadCtx, typeEntry, filterSlice, null, null, 0, false)) {
                continue :checkItem;
            }
            if (correctedForOffset != 0) {
                correctedForOffset -= 1;
                continue :checkItem;
            }
            const size = try getFields(n, ctx, Node.getNodeId(n), typeEntry, include, null, null, false);
            if (size > 0) {
                ctx.size += size;
                ctx.totalResults += 1;
            }
        } else {
            break :checkItem;
        }
    }
}

// search + idDesc
pub fn search(
    comptime isVector: bool,
    comptime desc: bool,
    ctx: *Query.QueryCtx,
    offset: u32,
    limit: u32,
    typeId: t.TypeId,
    conditions: []u8,
    include: []u8,
    sortBuffer: []u8,
    searchCtx: *const searchStr.SearchCtx(isVector),
) !void {

    // [order] [prop] [propType] [start] [start] [len] [len]
    const field = sortBuffer[0];
    const start = read(u16, sortBuffer, 2);
    const lang: types.LangCode = @enumFromInt(sortBuffer[6]);

    const sIndex = sort.getSortIndex(ctx.db.sortIndexes.get(typeId), field, start, lang);
    if (sIndex == null) {
        std.log.err(
            "Err exec query (zig) no sort index aviable for query type: {any} field: {any} start: {any}  \n",
            .{ typeId, field, start },
        );
        return;
    }
    const typeEntry = try db.getType(ctx.db, typeId);
    const sI = sIndex.?;
    var it: selva.SelvaSortIterator = undefined;
    if (desc) {
        selva.selva_sort_foreach_begin_reverse(sI.index, &it);
    } else {
        selva.selva_sort_foreach_begin(sI.index, &it);
    }
    var searchCtxC = s.createSearchCtx(isVector, offset);
    while (!selva.selva_sort_foreach_done(&it)) {
        var node: Node.Node = undefined;
        if (desc) {
            node = @ptrCast(selva.selva_sort_foreach_reverse(sI.index, &it));
        } else {
            node = @ptrCast(selva.selva_sort_foreach(sI.index, &it));
        }
        s.addToScore(
            ctx.threadCtx.decompressor,
            &ctx.threadCtx.libdeflateBlockState,
            isVector,
            ctx,
            &searchCtxC,
            node,
            typeEntry,
            conditions,
            searchCtx,
        );
        if ((searchCtxC.totalSearchResults >= limit)) {
            break;
        }
    }
    try s.addToResults(
        isVector,
        ctx,
        &searchCtxC,
        include,
        limit,
        typeEntry,
    );
}
