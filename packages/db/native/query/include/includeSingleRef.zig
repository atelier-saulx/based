const readInt = @import("../../utils.zig").readInt;
const db = @import("../../db/db.zig");
const QueryCtx = @import("../ctx.zig").QueryCtx;
const incl = @import("./include.zig");
const getFields = incl.getFields;
const RefStruct = incl.RefStruct;

const addIdOnly = @import("./addIdOnly.zig").addIdOnly;
const selva = @import("../../selva.zig");
const std = @import("std");
const results = @import("../results.zig");

const IncludeError = error{
    Recursion,
};

pub fn getSingleRefFields(
    ctx: *QueryCtx,
    include: []u8,
    originalNode: db.Node,
    ref: ?RefStruct,
) usize {
    if (ref != null) {
        std.debug.print("We are in a single ref from edge! \n", .{});
        return 0;
    }

    var size: usize = 0;
    const typeId: db.TypeId = readInt(u16, include, 0);
    const refField = include[2];

    // get from edge as well
    const node = db.getReference(originalNode, refField);

    // SINGLE REF
    // op, field, bytes
    // u8, u8, u32
    // [254, 2, 4531]

    ctx.results.append(.{
        .id = null,
        .field = refField,
        .val = null,
        .refSize = 0,
        .includeMain = &.{},
        .refType = 254,
        .totalRefs = null,
        .isEdge = 0,
    }) catch return 0;

    const resultIndex: usize = ctx.results.items.len - 1;

    if (node == null) {
        return 6;
    }

    const refId = db.getNodeId(node.?);

    const typeEntry = db.getType(typeId) catch {
        return 6;
    };

    const includeNested = include[3..include.len];

    const resultSizeNest = getFields(
        node.?,
        ctx,
        refId,
        typeEntry,
        includeNested,
        null, // ADD REFERENCE
    ) catch 0;

    ctx.results.items[resultIndex].refSize = resultSizeNest;

    size += 6 + resultSizeNest;

    return size;
}
