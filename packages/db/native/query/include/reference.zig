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
    const fieldSchema = if (isEdge) db.getEdgeFieldSchema(ctx.db.selva.?, ref.?.edgeConstaint, refField) catch null else db.getFieldSchema(refField, originalType) catch null;

    if (fieldSchema == null) {
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
        const edgeConstrain: *const selva.EdgeFieldConstraint = selva.selva_get_edge_field_constraint(
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
        const selvaRef = db.getSingleReference(ctx.db, originalNode, refField);
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
