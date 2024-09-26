const readInt = @import("../../utils.zig").readInt;
const db = @import("../../db/db.zig");
const QueryCtx = @import("../ctx.zig").QueryCtx;
const getFields = @import("./include.zig").getFields;
const addIdOnly = @import("./addIdOnly.zig").addIdOnly;
const selva = @import("../../selva.zig");
const std = @import("std");
const results = @import("../results.zig");
const filter = @import("../filter/filter.zig").filter;

const IncludeError = error{
    Recursion,
};

// make the filter as option as well

// pass id
pub fn getRefsFields(
    ctx: *QueryCtx,
    include: []u8,
    node: db.Node,
) usize {
    const filterSize: db.TypeId = readInt(u16, include, 0);

    const filterArr: ?[]u8 = if (filterSize > 0) include[2 .. 2 + filterSize] else null;

    const typeId: db.TypeId = readInt(u16, include, 2 + filterSize);
    const refField = include[4 + filterSize];

    // MULTIPLE REFS
    // op u8, field u8, bytes u32, len u32
    // [253, 2, 2124, 10]

    ctx.results.append(.{
        .id = null,
        .field = refField,
        .val = null,
        .refSize = 0,
        .includeMain = &.{},
        .refType = 253,
        .totalRefs = 0,
        .isEdge = false,
    }) catch return 0;

    const resultIndex: usize = ctx.results.items.len - 1;

    const refs = db.getReferences(node, refField);
    if (refs == null) {
        return 10;
    }

    const typeEntry = db.getType(typeId) catch null;

    var size: usize = 0;

    const includeNested = include[(5 + filterSize)..include.len];

    var i: usize = 0;
    var resultsCnt: u32 = 0;

    checkItem: while (i < refs.?.nr_refs) : (i += 1) {
        const refNode = refs.?.refs[i].dst.?;

        if (filterArr != null and !filter(refNode, typeEntry.?, filterArr.?)) {
            continue :checkItem;
        }

        resultsCnt += 1;

        size += getFields(
            refNode,
            ctx,
            db.getNodeId(refNode),
            typeEntry.?,
            includeNested,
        ) catch 0;
    }

    const r: *results.Result = &ctx.results.items[resultIndex];

    r.*.refSize = size;
    r.*.totalRefs = resultsCnt;

    return size + 10;
}
