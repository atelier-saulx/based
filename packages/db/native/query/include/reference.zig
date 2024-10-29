const readInt = @import("../../utils.zig").readInt;
const db = @import("../../db/db.zig");
const QueryCtx = @import("../ctx.zig").QueryCtx;
const getFields = @import("./include.zig").getFields;
const addIdOnly = @import("./addIdOnly.zig").addIdOnly;
const selva = @import("../../selva.zig");
const std = @import("std");
const results = @import("../results.zig");
const types = @import("./types.zig");
const t = @import("../../types.zig");

pub fn getSingleRefFields(
    ctx: *QueryCtx,
    include: []u8,
    originalNode: db.Node,
    originalType: db.Type,
    ref: ?types.RefStruct,
    comptime isEdge: bool,
) usize {
    if (isEdge) {
        std.debug.print("SINGLE REF {any} \n", .{ref.?.reference});
        return 0;
    }

    var size: usize = 0;
    const typeId: db.TypeId = readInt(u16, include, 0);
    const refField = include[2];

    // get from edge as well

    // SINGLE REF
    // op, field, bytes
    // u8, u8, u32
    // [254, 2, 4531]

    ctx.results.append(.{
        .id = null,
        .field = refField,
        .val = null,
        .refSize = 0,
        .includeMain = null,
        .refType = 254, // from result
        .totalRefs = null,
        .isEdge = t.Prop.NULL,
    }) catch return 0;

    const resultIndex: usize = ctx.results.items.len - 1;

    const selvaRef = db.getSingleReference(originalNode, refField);

    if (selvaRef == null) {
        return 6;
    }

    const node: ?db.Node = selvaRef.?.*.dst;

    if (node == null) {
        return 6;
    }

    const refId = db.getNodeId(node.?);

    const typeEntry = db.getType(ctx.db, typeId) catch {
        return 6;
    };

    const includeNested = include[3..include.len];

    const fieldSchema = db.getFieldSchema(refField, originalType) catch null;

    const edgeConstrain: *const selva.EdgeFieldConstraint = selva.selva_get_edge_field_constraint(fieldSchema);

    const resultSizeNest = getFields(
        node.?,
        ctx,
        refId,
        typeEntry,
        includeNested,
        .{
            .reference = @ptrCast(selvaRef.?),
            .edgeConstaint = edgeConstrain,
        },
        false,
    ) catch 0;

    ctx.results.items[resultIndex].refSize = resultSizeNest;

    size += 6 + resultSizeNest;

    return size;
}
