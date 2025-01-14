const readInt = @import("../../utils.zig").readInt;
const db = @import("../../db/db.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
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
    const fieldSchema = db.getFieldSchema(refField, originalType) catch null;

    var edgeRefStruct: types.RefStruct = undefined;
    var node: ?db.Node = undefined;

    if (isEdge) {
        // if isEdge ref can be set to NULL if isEdge
        const selvaRef = db.getEdgeReference(ref.?.reference.?, refField);
        if (selvaRef == null) {
            return 6 + size;
        }
        const edgeConstrain: *const selva.EdgeFieldConstraint = selva.selva_get_edge_field_constraint(
            fieldSchema,
        );
        edgeRefStruct = .{
            .reference = null,
            .edgeConstaint = edgeConstrain,
            .edgeReference = selvaRef,
        };
        std.debug.print("\n\nGURP: {any} {any} id: {any} \n", .{
            selvaRef,
            ref.?.reference.?,
            db.getNodeId(ref.?.reference.?.dst.?),
        });
        return 7;
        // node = selvaRef.?.dst;
        // if (node == null) {
        //     return 6 + size;
        // }
    } else {
        const selvaRef = db.getSingleReference(originalNode, refField);
        if (selvaRef == null) {
            return 6 + size;
        }
        const edgeConstrain: *const selva.EdgeFieldConstraint = selva.selva_get_edge_field_constraint(
            fieldSchema,
        );
        edgeRefStruct = .{
            .reference = @ptrCast(selvaRef.?),
            .edgeConstaint = edgeConstrain,
            .edgeReference = null,
        };
        node = selvaRef.?.*.dst;
        if (node == null) {
            return 6 + size;
        }
    }

    const refId = db.getNodeId(node.?);

    const typeEntry = db.getType(ctx.db, typeId) catch {
        return 6 + size;
    };

    const includeNested = include[3..include.len];

    // edge on edge will not rly work....

    const resultSizeNest = getFields(
        node.?,
        ctx,
        refId,
        typeEntry,
        includeNested,
        edgeRefStruct,
        null,
        false,
    ) catch 0;

    ctx.results.items[resultIndex].refSize = resultSizeNest;

    size += 6 + resultSizeNest;

    return size;
}
