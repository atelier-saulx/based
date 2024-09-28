const readInt = @import("../../../utils.zig").readInt;
const db = @import("../../../db/db.zig");
const selva = @import("../../../selva.zig");

const results = @import("../../results.zig");
const QueryCtx = @import("../../ctx.zig").QueryCtx;

const getFields = @import("../include.zig");
const addIdOnly = @import("../addIdOnly.zig").addIdOnly;
const types = @import("../types.zig");

const sortedReferences = @import("./sort.zig").sortedReferences;
const defaultReferences = @import("./default.zig").defaultReferences;

const std = @import("std");

// MULTIPLE REFS RESULT BUFFER
// [ op u8, field u8, bytes u32, len u32 ]
// [253, 2, 2124, 10]

pub inline fn getRefsFields(
    ctx: *QueryCtx,
    include: []u8,
    node: db.Node,
    originalType: db.Type,
    ref: ?types.RefStruct,
    comptime isEdge: bool,
) usize {
    const filterSize: db.TypeId = readInt(u16, include, 0);
    const filterArr: ?[]u8 = if (filterSize > 0) include[4 .. 4 + filterSize] else null;
    const hasFilter: bool = filterArr != null;
    const sortSize: db.TypeId = readInt(u16, include, 2);
    const sortArr: ?[]u8 = if (sortSize > 0) include[4 + filterSize .. 4 + filterSize + sortSize] else null;
    const typeId: db.TypeId = readInt(u16, include, 4 + filterSize + sortSize);
    const refField = include[6 + filterSize + sortSize];
    const typeEntry = db.getType(typeId) catch null;
    const includeNested = include[(7 + filterSize + sortSize)..include.len];

    ctx.results.append(.{
        .id = null,
        .field = refField,
        .val = null,
        .refSize = 0,
        .includeMain = null,
        .refType = 253,
        .totalRefs = 0,
        .isEdge = 0,
    }) catch return 0;

    const resultIndex: usize = ctx.results.items.len - 1;

    var edgeConstrain: ?*selva.EdgeFieldConstraint = null;
    var refs: types.Refs(isEdge) = undefined;

    if (isEdge) {
        const edgeFieldSchema = selva.get_fs_by_fields_schema_field(
            ref.?.edgeConstaint.*.fields_schema,
            refField - 1,
        );
        if (ref.?.reference.meta != null) {
            const resultRaw = db.getEdgeProp(ref.?.reference, edgeFieldSchema);
            std.debug.print(" resultRaw {any} \n", .{resultRaw});
        }
        // this is wrong
        refs = db.getEdgeReferences(ref.?.reference, refField - 1);
        std.debug.print(" refs {any} \n", .{refs});
        return 0;
    } else {
        const fieldSchema = db.getFieldSchema(refField, originalType) catch null;
        edgeConstrain = selva.selva_get_edge_field_constraint(fieldSchema);
        refs = db.getReferences(node, refField);
    }

    if (refs == null) {
        return 0;
    }

    var result: types.RefsResult = undefined;

    if (sortArr != null) {
        if (hasFilter) {
            result = sortedReferences(isEdge, refs, ctx, includeNested, sortArr.?, typeEntry.?, edgeConstrain, true, filterArr.?);
        } else {
            result = sortedReferences(isEdge, refs, ctx, includeNested, sortArr.?, typeEntry.?, edgeConstrain, false, null);
        }
    } else if (hasFilter) {
        result = defaultReferences(isEdge, refs, ctx, includeNested, typeEntry.?, edgeConstrain, true, filterArr.?);
    } else {
        result = defaultReferences(isEdge, refs, ctx, includeNested, typeEntry.?, edgeConstrain, false, null);
    }

    const r: *results.Result = &ctx.results.items[resultIndex];
    r.*.refSize = result.size;
    r.*.totalRefs = result.cnt;

    return result.size + 10;
}
