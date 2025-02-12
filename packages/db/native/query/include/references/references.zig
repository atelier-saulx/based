const read = @import("../../../utils.zig").read;
const db = @import("../../../db/db.zig");
const selva = @import("../../../selva.zig");

const results = @import("../../results.zig");
const QueryCtx = @import("../../types.zig").QueryCtx;

const getFields = @import("../include.zig");
const addIdOnly = @import("../addIdOnly.zig").addIdOnly;
const types = @import("../types.zig");

const sortedReferences = @import("./sort.zig").sortedReferences;
const defaultReferences = @import("./default.zig").defaultReferences;

const std = @import("std");
const t = @import("../../../types.zig");

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
    const filterSize: u16 = read(u16, include, 0);
    const sortSize: u16 = read(u16, include, 2);
    const offset: u32 = read(u32, include, 4);
    const limit: u32 = read(u32, include, 8);
    const start: comptime_int = 12;
    const filterArr: ?[]u8 = if (filterSize > 0) include[start .. start + filterSize] else null;
    const hasFilter: bool = filterArr != null;
    const sortArr: ?[]u8 = if (sortSize > 0) include[start + filterSize .. start + filterSize + sortSize] else null;
    const typeId: db.TypeId = read(u16, include, start + filterSize + sortSize);
    const refField = include[start + 2 + filterSize + sortSize];
    const typeEntry = db.getType(ctx.db, typeId) catch null;
    const includeNested = include[(start + 3 + filterSize + sortSize)..include.len];

    ctx.results.append(.{
        .id = null,
        .field = refField,
        .val = null,
        .refSize = 0,
        .includeMain = null,
        .score = null,
        .refType = 253,
        .totalRefs = 0,
        .isEdge = if (isEdge) t.Prop.WEAK_REFERENCES else t.Prop.NULL,
    }) catch return 0;

    const resultIndex: usize = ctx.results.items.len - 1;

    var edgeConstrain: ?*const selva.EdgeFieldConstraint = null;
    var refs: ?types.Refs(isEdge) = undefined;

    if (isEdge) {
        if (db.getEdgeReferences(ref.?.reference.?, refField)) |r| {
            const edgeFs = db.getEdgeFieldSchema(ctx.db.selva.?,ref.?.edgeConstaint, refField) catch {
                return 0;
            };
            refs = .{ .weakRefs = r, .fs = edgeFs };
        } else {
            return 0;
        }
    } else {
        const fieldSchema = db.getFieldSchema(refField, originalType) catch null;
        edgeConstrain = selva.selva_get_edge_field_constraint(fieldSchema);
        refs = db.getReferences(node, refField);
        if (refs == null) {
            return 0;
        }
    }

    var result: types.RefsResult = undefined;

    if (sortArr != null) {
        if (hasFilter) {
            result = sortedReferences(isEdge, refs.?, ctx, includeNested, sortArr.?, typeEntry.?, edgeConstrain, true, filterArr.?, offset, limit);
        } else {
            result = sortedReferences(isEdge, refs.?, ctx, includeNested, sortArr.?, typeEntry.?, edgeConstrain, false, null, offset, limit);
        }
    } else if (hasFilter) {
        result = defaultReferences(isEdge, refs.?, ctx, includeNested, typeEntry.?, edgeConstrain, true, filterArr.?, offset, limit);
    } else {
        result = defaultReferences(isEdge, refs.?, ctx, includeNested, typeEntry.?, edgeConstrain, false, null, offset, limit);
    }

    const r: *results.Result = &ctx.results.items[resultIndex];
    r.*.refSize = result.size;
    r.*.totalRefs = result.cnt;

    if (isEdge) {
        result.size += 1;
    }

    return result.size + 10;
}
