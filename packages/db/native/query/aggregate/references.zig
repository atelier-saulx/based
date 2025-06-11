const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");

const results = @import("../results.zig");
const QueryCtx = @import("../types.zig").QueryCtx;

const types = @import("../../types.zig");
const std = @import("std");
const utils = @import("../../utils.zig");
const read = utils.read;
const writeInt = utils.writeIntExact;

const aggregateTypes = @import("./types.zig");
const aggregate = @import("./aggregate.zig").aggregate;
const createGroupCtx = @import("./group.zig").createGroupCtx;
const GroupProtocolLen = @import("./group.zig").ProtocolLen;
// const setGroupResults = @import("./group.zig").setGroupResults;

const incTypes = @import("../include/types.zig");
const filter = @import("../filter/filter.zig").filter;

pub inline fn aggregateRefsGroup(
    comptime isEdge: bool,
    ctx: *QueryCtx,
    typeId: db.TypeId,
    originalType: db.Type,
    node: db.Node,
    refField: u8,
    aggInput: []u8,
    offset: u32,
    filterArr: ?[]u8,
) !usize {
    const typeEntry = try db.getType(ctx.db, typeId);
    var edgeConstrain: ?*const selva.EdgeFieldConstraint = null;
    var refs: ?incTypes.Refs(isEdge) = undefined;
    const hasFilter: bool = filterArr != null;
    const emptyKey = &[_]u8{};
    if (isEdge) {
        //later
    } else {
        const fieldSchema = db.getFieldSchema(originalType, refField) catch {
            return 0;
        };
        edgeConstrain = selva.selva_get_edge_field_constraint(fieldSchema);
        refs = db.getReferences(ctx.db, node, fieldSchema);
        if (refs == null) {
            return 0;
        }
    }

    var index: usize = 0;

    const groupCtx = try createGroupCtx(aggInput[index .. index + GroupProtocolLen], typeEntry, ctx);
    index += GroupProtocolLen;

    const agg = aggInput[index..aggInput.len];

    const refsCnt = incTypes.getRefsCnt(isEdge, refs.?);
    var i: usize = offset;
    var resultSize: usize = 0;

    checkItem: while (i < refsCnt) : (i += 1) {
        if (incTypes.resolveRefsNode(ctx, isEdge, refs.?, i)) |n| {
            if (hasFilter) {
                const refStruct = incTypes.RefResult(isEdge, refs, edgeConstrain, i);
                if (!filter(ctx.db, n, typeEntry, filterArr.?, refStruct, null, 0, false)) {
                    continue :checkItem;
                }
            }
            const groupValue = db.getField(typeEntry, db.getNodeId(n), n, groupCtx.fieldSchema, groupCtx.propType);
            const crcLen = groupCtx.propType.crcLen();
            const key: []u8 = if (groupValue.len > 0) groupValue.ptr[groupCtx.start + 2 .. groupValue.len - crcLen] else emptyKey;
            var resultsField: []u8 = undefined;
            if (!groupCtx.hashMap.contains(key)) {
                resultsField = try ctx.allocator.alloc(u8, groupCtx.resultsSize);
                @memset(resultsField, 0);
                try groupCtx.hashMap.put(key, resultsField);
                resultSize += 2 + key.len + groupCtx.resultsSize;
            } else {
                resultsField = groupCtx.hashMap.get(key).?;
            }
            aggregate(agg, typeEntry, n, resultsField);
        }
    }

    const val = try ctx.allocator.alloc(u8, resultSize);
    // try setGroupResults(val, groupCtx);

    try ctx.results.append(.{
        .id = null,
        .field = refField,
        .val = val,
        .score = null,
        .type = types.ResultType.aggregate,
    });

    return resultSize + 6;
}

pub inline fn aggregateRefsDefault(
    comptime isEdge: bool,
    ctx: *QueryCtx,
    typeId: db.TypeId,
    originalType: db.Type,
    node: db.Node,
    refField: u8,
    agg: []u8,
    offset: u32,
    filterArr: ?[]u8,
    resultsSize: u16,
) !usize {
    const resultsField = try ctx.allocator.alloc(u8, resultsSize);
    @memset(resultsField, 0);
    const typeEntry = try db.getType(ctx.db, typeId);
    var edgeConstrain: ?*const selva.EdgeFieldConstraint = null;
    var refs: ?incTypes.Refs(isEdge) = undefined;
    const hasFilter: bool = filterArr != null;

    if (isEdge) {
        //later
    } else {
        const fieldSchema = db.getFieldSchema(originalType, refField) catch {
            // default empty size - means a bug!
            return 10;
        };
        edgeConstrain = selva.selva_get_edge_field_constraint(fieldSchema);
        refs = db.getReferences(ctx.db, node, fieldSchema);
        if (refs == null) { // default empty size - this should never happen
            return 10;
        }
    }

    const refsCnt = incTypes.getRefsCnt(isEdge, refs.?);

    // .totalRefs = refsCnt,
    // if only 1 agg and field 255 and COUNT just return refsCnt
    var i: usize = offset;
    checkItem: while (i < refsCnt) : (i += 1) {
        if (incTypes.resolveRefsNode(ctx, isEdge, refs.?, i)) |refNode| {
            if (hasFilter) {
                const refStruct = incTypes.RefResult(isEdge, refs, edgeConstrain, i);
                if (!filter(ctx.db, refNode, typeEntry, filterArr.?, refStruct, null, 0, false)) {
                    continue :checkItem;
                }
            }
            aggregate(agg, typeEntry, refNode, resultsField);
        }
    }

    try ctx.results.append(.{
        .id = null,
        .field = refField,
        .val = resultsField,
        .score = null,
        .type = types.ResultType.aggregate,
    });

    return resultsSize + 2 + 4;
    // return 0;
}

pub fn aggregateRefsFields(
    ctx: *QueryCtx,
    include: []u8,
    node: db.Node,
    originalType: db.Type,
    comptime isEdge: bool,
) !usize {
    var index: usize = 0;
    const filterSize: u16 = read(u16, include, index);
    index += 2;
    const offset: u32 = read(u32, include, index);
    index += 4;
    const filterArr: ?[]u8 = if (filterSize > 0) include[index .. index + filterSize] else null;
    index += filterSize;
    const typeId: db.TypeId = read(u16, include, index);
    index += 2;
    const refField = include[index];
    index += 1;
    const groupBy: aggregateTypes.GroupedBy = @enumFromInt(include[index]);
    index += 1;
    if (groupBy == aggregateTypes.GroupedBy.hasGroup) {
        const agg = include[index..include.len];
        return try aggregateRefsGroup(isEdge, ctx, typeId, originalType, node, refField, agg, offset, filterArr);
    } else {
        const resultsSize = read(u16, include, index);
        index += 2;
        // const accumulatorSize = read(u16, include, index);
        index += 2;
        const agg = include[index..include.len];
        return try aggregateRefsDefault(isEdge, ctx, typeId, originalType, node, refField, agg, offset, filterArr, resultsSize);
    }
    return 0;
}
