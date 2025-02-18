const read = @import("../../../utils.zig").read;
const db = @import("../../../db/db.zig");
const dbSort = @import("../../../db/sort.zig");
const QueryCtx = @import("../../types.zig").QueryCtx;
const getFields = @import("../include.zig").getFields;
const queryTypes = @import("../types.zig");
const types = @import("../../../types.zig");
const filter = @import("../../filter/filter.zig").filter;
const selva = @import("../../../selva.zig");
const std = @import("std");

pub fn sortedReferences(
    comptime isEdge: bool,
    refs: queryTypes.Refs(isEdge),
    ctx: *QueryCtx,
    include: []u8,
    sortBuffer: []u8,
    typeEntry: db.Type,
    edgeConstrain: ?db.EdgeFieldConstraint,
    comptime hasFilter: bool,
    filterArr: if (hasFilter) []u8 else ?void,
    offset: u32,
    limit: u32,
) queryTypes.RefsResult {
    var result: queryTypes.RefsResult = .{ .size = 0, .cnt = 0 };
    var i: usize = 0;
    var start: u16 = undefined;
    var len: u16 = undefined;
    const sortField: u8 = sortBuffer[1];
    const sortProp: types.Prop = @enumFromInt(sortBuffer[2]);
    start = read(u16, sortBuffer, 3);
    len = read(u16, sortBuffer, 5);
    const langCode: types.LangCode = @enumFromInt(sortBuffer[7]);

    var metaSortIndex = dbSort.createSortIndexMeta(
        start,
        len,
        sortProp,
        sortBuffer[0] == 1,
        langCode,
    ) catch {
        return result;
    };
    const refsCnt = queryTypes.getRefsCnt(isEdge, refs);
    checkItem: while (i < refsCnt) : (i += 1) {
        if (queryTypes.resolveRefsNode(ctx, isEdge, refs, i)) |refNode| {
            if (hasFilter and !filter(ctx.db, refNode, typeEntry, filterArr, null, null, 0, false)) {
                continue :checkItem;
            }
            const fs = db.getFieldSchema(sortField, typeEntry) catch {
                return result;
            };
            const value = db.getField(typeEntry, 0, refNode, fs, sortProp);
            dbSort.insert(ctx.db, &metaSortIndex, value, refNode);
        }
    }
    i = 0;
    selva.selva_sort_foreach_begin(metaSortIndex.index);
    while (!selva.selva_sort_foreach_done(metaSortIndex.index)) {
        const refNode: db.Node = @ptrCast(selva.selva_sort_foreach(metaSortIndex.index));
        result.cnt += 1;
        if (offset != 0 and result.cnt <= offset) {
            i += 1;
            continue;
        }
        result.size += getFields(
            refNode,
            ctx,
            db.getNodeId(refNode),
            typeEntry,
            include,
            queryTypes.RefResult(isEdge, refs, edgeConstrain, i),
            null,
            false,
        ) catch 0;
        if (result.cnt - offset >= limit) {
            break;
        }
        i += 1;
    }
    selva.selva_sort_destroy(metaSortIndex.index);
    return result;
}
