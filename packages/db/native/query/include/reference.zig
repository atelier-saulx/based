const read = @import("../../utils.zig").read;
const db = @import("../../db/db.zig");
const Query = @import("../common.zig");
const getFields = @import("./include.zig").getFields;
const addIdOnly = @import("./addIdOnly.zig").addIdOnly;
const std = @import("std");
const results = @import("../results.zig");
const utils = @import("../../utils.zig");
const t = @import("../../types.zig");

//  Single Reference Protocol Schema:

// | Offset  | Field     | Size (bytes)| Description                          |
// |---------|-----------|-------------|--------------------------------------|
// | 0       | op        | 1           | Operation identifier (254)           |
// | 1       | field     | 1           | Field identifier                     |
// | 2       | refSize   | 4           | Reference size (unsigned 32-bit int) |

pub fn getSingleRefFields(
    ctx: *Query.QueryCtx,
    include: []u8,
    originalNode: db.Node,
    originalType: db.Type,
    ref: ?Query.RefStruct,
    comptime isEdge: bool,
) usize {
    var size: usize = 0;
    const typeId: t.TypeId = read(u16, include, 0);
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

    var edgeRefStruct: Query.RefStruct = undefined;
    var node: ?db.Node = null;

    if (isEdge) {
        size += 1;
        const selvaRef = db.getEdgeReference(ctx.db, ref.?.edgeConstraint, ref.?.largeReference.?, refField);
        if (selvaRef == null) {
            return 6 + size;
        }

        const edgeConstraint = db.getEdgeFieldConstraint(fieldSchema.?);

        edgeRefStruct = std.mem.zeroInit(Query.RefStruct, .{
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
        const edgeConstraint = db.getEdgeFieldConstraint(fieldSchema.?);

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

    utils.write(u32, val, @truncate(resultSizeNest), 0);
    ctx.results.items[resultIndex].value = val;

    size += 6 + resultSizeNest;

    return size;
}
