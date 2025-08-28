const read = @import("../../../utils.zig").read;
const db = @import("../../../db/db.zig");
const QueryCtx = @import("../../types.zig").QueryCtx;
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
    edgeConstraint: ?db.EdgeFieldConstraint,
    comptime hasFilter: bool,
    filterArr: if (hasFilter) []u8 else ?void,
    offset: u32,
    limit: u32,
) types.RefsResult {
    var result: types.RefsResult = .{ .size = 0, .cnt = 0 };
    var i: usize = offset;
    const refsCnt = types.getRefsCnt(isEdge, refs);

    checkItem: while (i < refsCnt and result.cnt < limit) : (i += 1) {
        if (types.resolveRefsNode(ctx, isEdge, refs, i)) |refNode| {
            const refStruct = types.RefResult(isEdge, refs, edgeConstraint, i);
            if (hasFilter and !filter(
                ctx.db,
                refNode,
                typeEntry,
                filterArr,
                refStruct,
                null,
                0,
                false,
            )) {
                continue :checkItem;
            }
            result.cnt += 1;
            result.size += getFields(
                refNode,
                ctx,
                db.getNodeId(refNode),
                typeEntry,
                include,
                refStruct,
                null,
                false,
            ) catch 0;
        }
    }

    return result;
}
