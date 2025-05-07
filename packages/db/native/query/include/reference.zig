const read = @import("../../utils.zig").read;
const db = @import("../../db/db.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const getFields = @import("./include.zig").getFields;
const addIdOnly = @import("./addIdOnly.zig").addIdOnly;
const selva = @import("../../selva.zig");
const std = @import("std");
const results = @import("../results.zig");
const types = @import("./types.zig");
const t = @import("../../types.zig");

//  Single Reference Protocol Schema:

// | Offset  | Field     | Size (bytes)| Description                          |
// |---------|-----------|-------------|--------------------------------------|
// | 0       | op        | 1           | Operation identifier (254)           |
// | 1       | field     | 1           | Field identifier                     |
// | 2       | refSize   | 4           | Reference size (unsigned 32-bit int) |

pub fn getSingleRefFields(
    ctx: *QueryCtx,
    include: []u8,
    originalNode: db.Node,
    originalType: db.Type,
    ref: ?types.RefStruct,
    comptime isEdge: bool,
) usize {
    var size: usize = 0;
    const typeId: db.TypeId = read(u16, include, 0);
    const refField = include[2];

    ctx.results.append(.{
        .id = null,
        .score = null,
        .field = refField,
        .val = null,
        .refSize = 0,
        .includeMain = null,
        .refType = t.ReadRefOp.REFERENCE, // from result
        .totalRefs = 0,
        .isEdge = if (isEdge) t.Prop.REFERENCE else t.Prop.NULL,
    }) catch return 0;

    const resultIndex: usize = ctx.results.items.len - 1;

    // add error handler...
    const fieldSchema = if (isEdge) db.getEdgeFieldSchema(ctx.db.selva.?, ref.?.edgeConstaint.?, refField) catch null else db.getFieldSchema(refField, originalType) catch null;

    if (fieldSchema == null) {
        // this just means broken..
        // return if (isEdge)   { return 7 + size; } else {  return 6 + size; };
        return 0;
    }

    var edgeRefStruct: types.RefStruct = undefined;
    var node: ?db.Node = undefined;

    if (isEdge) {
        size += 1;
        var selvaRef = db.getEdgeReference(ctx.db, ref.?.reference.?, refField);
        if (selvaRef == null) {
            return 6 + size;
        }

        const edgeConstrain = selva.selva_get_edge_field_constraint(
            fieldSchema,
        );

        edgeRefStruct = .{
            .reference = null,
            .edgeConstaint = edgeConstrain,
            .edgeReference = selvaRef,
        };
        node = db.resolveEdgeReference(ctx.db, fieldSchema.?, &selvaRef.?);
        if (node == null) {
            return 6 + size;
        }
    } else {
        const selvaRef = db.getSingleReference(ctx.db, originalNode, fieldSchema.?);
        if (selvaRef == null) {
            return 6 + size;
        }
        const edgeConstrain = selva.selva_get_edge_field_constraint(
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

    ctx.results.items[resultIndex].refSize = @truncate(resultSizeNest);

    size += 6 + resultSizeNest;

    return size;
}
