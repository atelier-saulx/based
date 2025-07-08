const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");

const results = @import("../results.zig");
const QueryCtx = @import("../types.zig").QueryCtx;

const types = @import("../../types.zig");
const std = @import("std");
const utils = @import("../../utils.zig");
const read = utils.read;
const copy = utils.copy;
const writeInt = utils.writeIntExact;

const aggregateTypes = @import("./types.zig");
const aggregate = @import("./aggregate.zig").aggregate;
const createGroupCtx = @import("./group.zig").createGroupCtx;
const GroupProtocolLen = @import("./group.zig").ProtocolLen;
const groupFunctions = @import("./group.zig");
const setGroupResults = groupFunctions.setGroupResults;
const finalizeGroupResults = groupFunctions.finalizeGroupResults;
const finalizeResults = groupFunctions.finalizeResults;
const GroupCtx = groupFunctions.GroupCtx;

const incTypes = @import("../include/types.zig");
const filter = @import("../filter/filter.zig").filter;

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
        const accumulatorSize = read(u16, include, index);
        index += 2;
        const agg = include[index..include.len];
        return try aggregateRefsDefault(isEdge, ctx, typeId, originalType, node, refField, agg, offset, filterArr, resultsSize, accumulatorSize);
    }
    return 0;
}

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
    var resultsSize: usize = 0;

    const groupCtx = try createGroupCtx(aggInput[index .. index + GroupProtocolLen], typeEntry, ctx);
    index += GroupProtocolLen;

    const agg = aggInput[index..aggInput.len];

    const refsCnt = incTypes.getRefsCnt(isEdge, refs.?);
    var i: usize = offset;

    checkItem: while (i < refsCnt) : (i += 1) {
        if (incTypes.resolveRefsNode(ctx, isEdge, refs.?, i)) |n| {
            if (hasFilter) {
                const refStruct = incTypes.RefResult(isEdge, refs, edgeConstrain, i);
                if (!filter(ctx.db, n, typeEntry, filterArr.?, refStruct, null, 0, false)) {
                    continue :checkItem;
                }
            }
            const groupValue = db.getField(typeEntry, db.getNodeId(n), n, groupCtx.fieldSchema, groupCtx.propType);
            const key: []u8 = if (groupValue.len > 0)
                if (groupCtx.propType == types.Prop.STRING)
                    groupValue.ptr[2 + groupCtx.start .. groupCtx.start + groupValue.len - groupCtx.propType.crcLen()]
                else
                    groupValue.ptr[groupCtx.start .. groupCtx.start + groupCtx.len]
            else
                emptyKey;
            const hash_map_entry = try groupCtx.hashMap.getOrInsert(key, groupCtx.accumulatorSize);
            const accumulatorField = hash_map_entry.value;
            var hadAccumulated = !hash_map_entry.is_new;

            if (hash_map_entry.is_new) {
                resultsSize += 2 + key.len + groupCtx.resultsSize;
            }

            aggregate(agg, typeEntry, n, accumulatorField, null, &hadAccumulated);
        }
    }

    const data = try ctx.allocator.alloc(u8, resultsSize);

    try finalizeGroupResults(data, groupCtx, agg);

    try ctx.results.append(.{
        .id = null,
        .field = refField,
        .val = data,
        .score = null,
        .type = types.ResultType.aggregate,
    });
    return resultsSize + 6;
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
    accumulatorSize: u16,
) !usize {
    const accumulatorField = try ctx.allocator.alloc(u8, accumulatorSize);
    @memset(accumulatorField, 0);
    const typeEntry = try db.getType(ctx.db, typeId);
    var edgeConstrain: ?*const selva.EdgeFieldConstraint = null;
    var refs: ?incTypes.Refs(isEdge) = undefined;
    const hasFilter: bool = filterArr != null;
    var hadAccumulated: bool = false;

    if (isEdge) {
        //later
    } else {
        const fieldSchema = db.getFieldSchema(originalType, refField) catch {
            return 10;
        };
        edgeConstrain = selva.selva_get_edge_field_constraint(fieldSchema);
        refs = db.getReferences(ctx.db, node, fieldSchema);
        if (refs == null) {
            return 10;
        }
    }

    const refsCnt = incTypes.getRefsCnt(isEdge, refs.?);

    var i: usize = offset;
    checkItem: while (i < refsCnt) : (i += 1) {
        if (incTypes.resolveRefsNode(ctx, isEdge, refs.?, i)) |refNode| {
            if (hasFilter) {
                const refStruct = incTypes.RefResult(isEdge, refs, edgeConstrain, i);
                if (!filter(ctx.db, refNode, typeEntry, filterArr.?, refStruct, null, 0, false)) {
                    continue :checkItem;
                }
            }
            aggregate(agg, typeEntry, refNode, accumulatorField, null, &hadAccumulated);
        }
    }

    const val = try ctx.allocator.alloc(u8, resultsSize);
    try finalizeResults(val, accumulatorField, agg);

    try ctx.results.append(.{
        .id = null,
        .field = refField,
        .val = val,
        .score = null,
        .type = types.ResultType.aggregate,
    });

    return resultsSize + 2 + 4;
}
