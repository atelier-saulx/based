const std = @import("std");
const db = @import("../../../db/db.zig");
const Node = @import("../../../db/node.zig");
const dbSort = @import("../../../db/sort.zig");
const Query = @import("../../common.zig");
const getFields = @import("../include.zig").getFields;
const filter = @import("../../filter/filter.zig").filter;
const selva = @import("../../../selva.zig").c;
const read = @import("../../../utils.zig").read;
const t = @import("../../../types.zig");

pub fn sortedReferences(
    refs: Query.Refs,
    ctx: *Query.QueryCtx,
    include: []u8,
    sortBuffer: []u8, // TODO: PASS SORT HEADER HERE
    typeEntry: Node.Type,
    edgeConstraint: db.EdgeFieldConstraint,
    comptime hasFilter: bool,
    filterArr: if (hasFilter) []u8 else ?void,
    offset: u32,
    limit: u32,
) Query.RefsResult {
    var result: Query.RefsResult = .{ .size = 0, .cnt = 0 };
    var i: usize = 0;
    const sortHeader = read(t.SortHeader, sortBuffer, 0);
    var metaSortIndex = dbSort.createSortIndexMeta(
        &sortHeader,
        sortHeader.order == t.SortOrder.desc,
    ) catch {
        return result;
    };
    const refsCnt = refs.refs.nr_refs;
    checkItem: while (i < refsCnt) : (i += 1) {
        if (Query.resolveRefsNode(ctx.db, refs, i)) |refNode| {
            if (hasFilter and !filter(
                ctx.db,
                refNode,
                ctx.threadCtx,
                typeEntry,
                filterArr,
                null,
                null,
                0,
                false,
            )) {
                continue :checkItem;
            }
            const fs = db.getFieldSchema(typeEntry, sortHeader.prop) catch {
                return result;
            };
            const value = db.getField(typeEntry, refNode, fs, sortHeader.propType);
            dbSort.insert(ctx.threadCtx.decompressor, &metaSortIndex, value, refNode);
        }
    }
    i = 0;
    var it: selva.SelvaSortIterator = undefined;
    selva.selva_sort_foreach_begin(metaSortIndex.index, &it);
    while (!selva.selva_sort_foreach_done(&it)) {
        const refNode: Node.Node = @ptrCast(selva.selva_sort_foreach(metaSortIndex.index, &it));
        result.cnt += 1;
        if (offset != 0 and result.cnt <= offset) {
            i += 1;
            continue;
        }
        result.size += getFields(
            refNode,
            ctx,
            Node.getNodeId(refNode),
            typeEntry,
            include,
            Query.RefResult(refs, edgeConstraint, i),
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
