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

// pass id
pub fn getRefsFields(
    _: *QueryCtx,
    include: []u8,
    node: db.Node,
    _: u8,
    _: bool,
) usize {
    // var size: usize = 0;

    const typeId: db.TypeId = readInt(u16, include, 0);
    const refField = include[2];

    std.debug.print("REFS {any} type: {d} refField: {d} \n", .{ include, typeId, refField });
    const refs = db.getReferences(node, refField);
    if (refs != null) {
        std.debug.print("refs: {any}\n", .{refs});
    }

    std.debug.print("flap {any} {d} \n", .{ refs, refs.?.nr_refs });

    var i: usize = 0;
    while (i < refs.?.nr_refs) : (i += 1) {
        std.debug.print("snuro {any} \n", .{refs.?.refs[i].dst});
    }

    // const node = db.getReference(originalNode, refField);

    // if (node == null) {
    //     return 0;
    // }

    return 5;

    // const refId = db.getNodeId(node.?);

    // // only do this if there is nothing else
    // if (!hasFields) {
    //     _ = addIdOnly(ctx, refId, refLvl + 1, refField) catch {
    //         return 0;
    //     };
    // }

    // const typeEntry = db.getType(typeId) catch null;

    // if (typeEntry == null) {
    //     return 0;
    // }

    // const includeNested = include[3..include.len];

    // const resultSizeNest = getFields(
    //     node.?,
    //     ctx,
    //     refId,
    //     typeEntry.?,
    //     refField,
    //     includeNested,
    //     refLvl + 1,
    //     !hasFields,
    // ) catch 0;

    // if (!hasFields) {
    //     size += 7 + resultSizeNest;
    // } else {
    //     size += 7 + resultSizeNest;
    // }

    // return size;
}
