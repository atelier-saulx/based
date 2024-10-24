const readInt = @import("../../../utils.zig").readInt;
const db = @import("../../../db/db.zig");
const QueryCtx = @import("../../ctx.zig").QueryCtx;
const getFields = @import("../include.zig").getFields;
const types = @import("../types.zig");
const filter = @import("../../filter/filter.zig").filter;

const std = @import("std");

pub fn defaultReferences(
    comptime isEdge: bool,
    refs: types.Refs(isEdge),
    ctx: *QueryCtx,
    include: []u8,
    typeEntry: db.Type,
    edgeConstrain: ?db.EdgeFieldConstraint,
    comptime hasFilter: bool,
    filterArr: if (hasFilter) []u8 else ?void,
    offset: u32,
    limit: u32,
) types.RefsResult {
    if (isEdge) {
        return 0;
    }

    var result: types.RefsResult = .{ .size = 0, .cnt = 0 };
    var i: usize = offset;

    checkItem: while (i < refs.?.nr_refs and result.cnt < limit) : (i += 1) {
        const refNode = refs.?.refs[i].dst.?;
        if (hasFilter and !filter(ctx.db, refNode, typeEntry, filterArr)) {
            continue :checkItem;
        }
        result.cnt += 1;
        result.size += getFields(
            refNode,
            ctx,
            db.getNodeId(refNode),
            typeEntry,
            include,
            types.RefResult(isEdge, refs, edgeConstrain, i),
            false,
        ) catch 0;
    }

    return result;
}
