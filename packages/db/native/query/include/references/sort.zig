const readInt = @import("../../../utils.zig").readInt;
const db = @import("../../../db/db.zig");
const QueryCtx = @import("../../ctx.zig").QueryCtx;
const getFields = @import("../include.zig").getFields;
const queryTypes = @import("../types.zig");
const types = @import("../../../types.zig");
const filter = @import("../../filter/filter.zig").filter;

const selva = @import("../../../selva.zig");

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
    if (isEdge) {
        return 0;
    }

    var result: queryTypes.RefsResult = .{ .size = 0, .cnt = 0 };
    var i: usize = 0;
    var start: u16 = undefined;
    var len: u16 = undefined;

    const sortField: u8 = sortBuffer[1];
    const sortFieldType: types.Prop = @enumFromInt(sortBuffer[2]);
    if (sortBuffer.len == 7) {
        start = readInt(u16, sortBuffer, 3);
        len = readInt(u16, sortBuffer, 5);
    } else {
        start = 0;
        len = 0;
    }
    const sortFlag = db.getSortFlag(sortFieldType, sortBuffer[0] == 1) catch {
        return result;
    };
    const sortCtx: *selva.SelvaSortCtx = selva.selva_sort_init(sortFlag, refs.nr_refs).?;

    checkItem: while (i < refs.nr_refs) : (i += 1) {
        const refNode = refs.refs[i].dst.?;
        if (hasFilter and !filter(ctx.db, refNode, typeEntry, filterArr, null, null, 0, false)) {
            continue :checkItem;
        }
        const fs = db.getFieldSchema(sortField, typeEntry) catch {
            return result;
        };
        const value = db.getField(typeEntry, 0, refNode, fs);
        db.insertSort(sortCtx, refNode, sortFieldType, value, start, len);
    }

    selva.selva_sort_foreach_begin(sortCtx);
    while (!selva.selva_sort_foreach_done(sortCtx)) {
        const refNode: db.Node = @ptrCast(selva.selva_sort_foreach(sortCtx));
        result.cnt += 1;
        if (offset != 0 and result.cnt <= offset) {
            continue;
        }
        result.size += getFields(
            refNode,
            ctx,
            db.getNodeId(refNode),
            typeEntry,
            include,
            queryTypes.RefResult(isEdge, refs, edgeConstrain, i),
            false,
        ) catch 0;
        if (result.cnt - offset >= limit) {
            break;
        }
    }
    selva.selva_sort_destroy(sortCtx);

    return result;
}
