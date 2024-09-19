const readInt = @import("../../utils.zig").readInt;
const db = @import("../../db/db.zig");
const QueryCtx = @import("../ctx.zig").QueryCtx;
const getFields = @import("./include.zig").getFields;
const addIdOnly = @import("./addIdOnly.zig").addIdOnly;
const selva = @import("../../selva.zig");
const std = @import("std");
const results = @import("../results.zig");

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
    const typeId: db.TypeId = readInt(u16, include, 0);
    const refField = include[2];

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
    }) catch return 0;

    const resultIndex: usize = ctx.results.items.len - 1;

    const refs = db.getReferences(node, refField);
    if (refs == null) {
        return 10;
    }

    const typeEntry = db.getType(typeId) catch null;

    var size: usize = 0;

    const includeNested = include[3..include.len];

    std.debug.print("Flap flap {any} \n", .{includeNested});

    var i: usize = 0;

    while (i < refs.?.nr_refs) : (i += 1) {
        // and add filter
        const refNode = refs.?.refs[i].dst.?;

        std.debug.print("  HELLO {any} {d} \n", .{ refNode, db.getNodeId(refNode) });

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
    r.*.totalRefs = refs.?.nr_refs;

    return size + 10;
}
