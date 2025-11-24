const std = @import("std");
const read = @import("../../../utils.zig").read;
const db = @import("../../../db/db.zig");
const Node = @import("../../../db/node.zig");
const Query = @import("../../common.zig");
const getFields = @import("../include.zig").getFields;
const filter = @import("../../filter/filter.zig").filter;

pub fn defaultReferences(
    refs: Query.Refs,
    ctx: *Query.QueryCtx,
    include: []u8,
    typeEntry: Node.Type,
    edgeConstraint: db.EdgeFieldConstraint,
    comptime hasFilter: bool,
    filterArr: if (hasFilter) []u8 else ?void,
    offset: u32,
    limit: u32,
) Query.RefsResult {
    var result: Query.RefsResult = .{ .size = 0, .cnt = 0 };
    var i: usize = offset;
    const refsCnt = refs.refs.nr_refs;
    checkItem: while (i < refsCnt and result.cnt < limit) : (i += 1) {
        if (Query.resolveRefsNode(ctx.db, refs, i)) |refNode| {
            const refStruct = Query.RefResult(refs, edgeConstraint, i);
            if (hasFilter and !filter(
                ctx.db,
                refNode,
                ctx.threadCtx,
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
                Node.getNodeId(refNode),
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
