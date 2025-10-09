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
const utils = @import("../../utils.zig");

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
        .id = 0,
        .score = null,
        .prop = refField,
        .value = &.{},
        .type = if (isEdge) t.ResultType.referenceEdge else t.ResultType.reference,
    }) catch return 0;

    // way less efficient use alloc.create()....
    const resultIndex: usize = ctx.results.items.len - 1;

    // add error handler...
    const fieldSchema = if (isEdge) db.getEdgeFieldSchema(ctx.db, ref.?.edgeConstraint, refField) catch null else db.getFieldSchema(originalType, refField) catch null;

    if (fieldSchema == null) {
        // this just means broken..
        // return if (isEdge)   { return 7 + size; } else {  return 6 + size; };
        return 0;
    }

    var edgeRefStruct: types.RefStruct = undefined;
    var node: ?db.Node = null;

    if (isEdge) {
        size += 1;
        const selvaRef = db.getEdgeReference(ctx.db, ref.?.edgeConstraint, ref.?.largeReference.?, refField);
        if (selvaRef == null) {
            return 6 + size;
        }

        const edgeConstraint = selva.selva_get_edge_field_constraint(
            fieldSchema,
        );

        edgeRefStruct = std.mem.zeroInit(types.RefStruct, .{
            .edgeConstraint = edgeConstraint,
            .largeReference = selvaRef,
        });
        if (db.getRefDstType(ctx.db, fieldSchema.?) catch null) |dstType| {
            node = db.getNodeFromReference(dstType, selvaRef);
        }
        if (node == null) {
            return 6 + size;
        }
    } else {
        const selvaRef = db.getSingleReference(originalNode, fieldSchema.?);
        if (selvaRef == null) {
            return 6 + size;
        }
        const dstType = db.getRefDstType(ctx.db, fieldSchema.?) catch {
            return 6 + size;
        };
        const edgeConstraint = selva.selva_get_edge_field_constraint(
            fieldSchema,
        );

        edgeRefStruct = .{
            .smallReference = null,
            .largeReference = @ptrCast(selvaRef.?),
            .edgeConstraint = edgeConstraint,
        };
        node = db.getNodeFromReference(dstType, selvaRef);
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

    const val = ctx.allocator.alloc(u8, 4) catch {
        return 10;
    };

    utils.writeInt(u32, val, 0, resultSizeNest);
    ctx.results.items[resultIndex].value = val;

    size += 6 + resultSizeNest;

    return size;
}
