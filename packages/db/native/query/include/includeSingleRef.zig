const readInt = @import("../../utils.zig").readInt;
const db = @import("../../db/db.zig");
const QueryCtx = @import("../ctx.zig").QueryCtx;
const getFields = @import("./include.zig").getFields;
const addIdOnly = @import("./addIdOnly.zig").addIdOnly;
const selva = @import("../../selva.zig");
const std = @import("std");

const IncludeError = error{
    Recursion,
};

pub fn getSingleRefFields(
    ctx: *QueryCtx,
    include: []u8,
    originalNode: db.Node,
    refLvl: u8,
    hasFields: bool,
) usize {
    var size: usize = 0;

    const typeId: db.TypeId = readInt(u16, include, 0);
    const start = readInt(u16, include, 2);

    const node = db.getReference(originalNode, include[3]);

    if (node == null) {
        return 0;
    }

    const refId = db.getNodeId(node);

    if (!hasFields) {
        _ = addIdOnly(ctx, refId, refLvl + 1, start) catch {
            return 0;
        };
    }

    const typeEntry = db.getType(typeId) catch null;

    if (typeEntry == null) {
        return 0;
    }

    const includeNested = include[4..include.len];

    const resultSizeNest = getFields(
        node.?,
        ctx,
        refId,
        typeEntry.?,
        start,
        includeNested,
        refLvl + 1,
        !hasFields,
    ) catch 0;

    size += 8 + resultSizeNest;

    return size;
}
