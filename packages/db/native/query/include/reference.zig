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
    var size: usize = 0;
    const typeId: db.TypeId = readInt(u16, include, 0);
    const refField = include[2];

    if (isEdge) {
        std.debug.print("SINGLE REF {any} {d} \n", .{ ref.?.reference, refField });
        size += 1;

        // ctx.results.append(.{
        //     .id = null,
        //     .score = null,
        //     .field = refField,
        //     .val = null,
        //     .refSize = 0,
        //     .includeMain = null,
        //     .refType = 254, // from result
        //     .totalRefs = null,
        //     .isEdge = t.Prop.REFERENCE,
        // }) catch return 0;
        // size += 6 + 1;

        // return size;
    }

    // get from edge as well

    // SINGLE REF
    // op, field, bytes
    // u8, u8, u32
    // [254, 2, 4531]
    ctx.results.append(.{
        .id = null,
        .score = null,
        .field = refField,
        .val = null,
        .refSize = 0,
        .includeMain = null,
        .refType = 254, // from result
        .totalRefs = null,
        .isEdge = if (isEdge) t.Prop.REFERENCE else t.Prop.NULL,
    }) catch return 0;

    const resultIndex: usize = ctx.results.items.len - 1;

    // if (isEdge) {
    //     std.debug.print(
    //         "need to handle isEdge single refs (write edge field here) {any} \n",
    //         .{singleRef},
    //     );
    // }

    var selvaRef: ?*selva.SelvaNodeReference = null;

    if (isEdge) {
        // if isEdge ref can be set to NULL if isEdge
        // selvaRef = db.getEdgeReference(ref.?.reference, refField);
    } else {
        selvaRef = db.getSingleReference(originalNode, refField);
    }

    if (selvaRef == null) {
        return 6 + size;
    }

    const node: ?db.Node = selvaRef.?.*.dst;

    if (node == null) {
        return 6 + size;
    }

    const refId = db.getNodeId(node.?);

    const typeEntry = db.getType(ctx.db, typeId) catch {
        return 6 + size;
    };

    const includeNested = include[3..include.len];
    const fieldSchema = db.getFieldSchema(refField, originalType) catch null;

    // edge on edge will not rly work....
    const edgeConstrain: *const selva.EdgeFieldConstraint = selva.selva_get_edge_field_constraint(
        fieldSchema,
    );

    const resultSizeNest = getFields(
        node.?,
        ctx,
        refId,
        typeEntry,
        includeNested,
        .{
            .reference = @ptrCast(selvaRef.?),
            .edgeConstaint = edgeConstrain,
            .edgeReference = null,
        },
        null,
        false,
    ) catch 0;

    ctx.results.items[resultIndex].refSize = resultSizeNest;

    size += 6 + resultSizeNest;

    return size;
}
