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
const aux = @import("./utils.zig");

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
        const option = include[index];
        index += 1;
        const agg = include[index..include.len];
        return try aggregateRefsDefault(isEdge, ctx, typeId, originalType, node, refField, agg, offset, filterArr, resultsSize, accumulatorSize, option);
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
    var edgeConstraint: ?db.EdgeFieldConstraint = null;
    var refs: ?incTypes.Refs = undefined;
    const hasFilter: bool = filterArr != null;
    const emptyKey = &[_]u8{};
    if (isEdge) {
        //later
    } else {
        const fieldSchema = db.getFieldSchema(originalType, refField) catch {
            return 0;
        };
        edgeConstraint = selva.selva_get_edge_field_constraint(fieldSchema);
        const references = db.getReferences(node, fieldSchema);
        if (references == null) {
            return 0;
        }

        refs = .{ .refs = references.?, .fs = fieldSchema };
    }

    var index: usize = 0;
    var resultsSize: usize = 0;

    const groupCtx = try createGroupCtx(aggInput[index .. index + GroupProtocolLen], typeEntry, ctx);
    index += GroupProtocolLen;

    const agg = aggInput[index..aggInput.len];

    const refsCnt = if (!isEdge) refs.?.refs.*.nr_refs else 0;
    var i: usize = offset;

    const hllAccumulator = selva.selva_string_create(null, selva.HLL_INIT_SIZE, selva.SELVA_STRING_MUTABLE);
    defer selva.selva_string_free(hllAccumulator);

    checkItem: while (i < refsCnt) : (i += 1) {
        if (incTypes.resolveRefsNode(ctx, refs.?, i)) |n| {
            if (hasFilter) {
                const refStruct = incTypes.RefResult(refs, edgeConstraint, i);
                if (!filter(ctx.db, n, typeEntry, filterArr.?, refStruct, null, 0, false)) {
                    continue :checkItem;
                }
            }
            const groupValue = db.getField(typeEntry, db.getNodeId(n), n, groupCtx.fieldSchema, groupCtx.propType);
            const key: []u8 = if (groupValue.len > 0)
                if (groupCtx.propType == types.Prop.STRING)
                    if (groupCtx.field == 0)
                        groupValue.ptr[groupCtx.start + 1 .. groupCtx.start + 1 + groupValue[groupCtx.start]]
                    else
                        groupValue.ptr[2 + groupCtx.start .. groupCtx.start + groupValue.len - groupCtx.propType.crcLen()]
                else if (groupCtx.propType == types.Prop.TIMESTAMP)
                    @constCast(aux.datePart(groupValue.ptr[groupCtx.start .. groupCtx.start + groupCtx.len], @enumFromInt(groupCtx.stepType), groupCtx.timezone))
                else if (groupCtx.propType == types.Prop.REFERENCE)
                    db.getReferenceNodeId(@alignCast(@ptrCast(groupValue.ptr)))
                else
                    groupValue.ptr[groupCtx.start .. groupCtx.start + groupCtx.len]
            else
                emptyKey;

            const hash_map_entry = if (groupCtx.propType == types.Prop.TIMESTAMP and groupCtx.stepRange != 0)
                try groupCtx.hashMap.getOrInsertWithRange(key, groupCtx.accumulatorSize, groupCtx.stepRange)
            else
                try groupCtx.hashMap.getOrInsert(key, groupCtx.accumulatorSize);
            const accumulatorField = hash_map_entry.value;
            var hadAccumulated = !hash_map_entry.is_new;
            const resultKeyLen = if (groupCtx.stepType != @intFromEnum(types.Interval.none)) 4 else key.len;
            if (hash_map_entry.is_new) {
                resultsSize += 2 + resultKeyLen + groupCtx.resultsSize;
            }

            aggregate(agg, typeEntry, n, accumulatorField, hllAccumulator, &hadAccumulated);
        }
    }

    const data = try ctx.allocator.alloc(u8, resultsSize);

    try finalizeGroupResults(data, groupCtx, agg);

    try ctx.results.append(.{
        .id = 0,
        .prop = refField,
        .value = data,
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
    option: u8,
) !usize {
    const accumulatorField = try ctx.allocator.alloc(u8, accumulatorSize);
    @memset(accumulatorField, 0);
    const typeEntry = try db.getType(ctx.db, typeId);
    var edgeConstraint: ?db.EdgeFieldConstraint = null;
    var refs: ?incTypes.Refs = undefined;
    const hasFilter: bool = filterArr != null;
    var hadAccumulated: bool = false;

    if (isEdge) {
        //later
    } else {
        const fieldSchema = db.getFieldSchema(originalType, refField) catch {
            return 10;
        };
        edgeConstraint = selva.selva_get_edge_field_constraint(fieldSchema);
        const references = db.getReferences(node, fieldSchema);
        if (references == null) {
            return 10;
        }

        refs = .{ .refs = references.?, .fs = fieldSchema };
    }

    const refsCnt = if (!isEdge) refs.?.refs.*.nr_refs else 0;

    const fieldAggsSize = read(u16, agg, 1);
    const aggPropDef = agg[3 .. 3 + fieldAggsSize];
    const aggType: aggregateTypes.AggType = @enumFromInt(aggPropDef[0]);
    if (aggType == aggregateTypes.AggType.COUNT and !hasFilter) {
        const resultPos = read(u16, aggPropDef, 4);
        writeInt(u32, accumulatorField, resultPos, refsCnt);
    } else {
        var i: usize = offset;
        checkItem: while (i < refsCnt) : (i += 1) {
            if (incTypes.resolveRefsNode(ctx, refs.?, i)) |refNode| {
                if (hasFilter) {
                    const refStruct = incTypes.RefResult(refs, edgeConstraint, i);
                    if (!filter(ctx.db, refNode, typeEntry, filterArr.?, refStruct, null, 0, false)) {
                        continue :checkItem;
                    }
                }
                aggregate(agg, typeEntry, refNode, accumulatorField, null, &hadAccumulated);
            }
        }
    }
    const value = try ctx.allocator.alloc(u8, resultsSize);
    try finalizeResults(value, accumulatorField, agg, option);

    try ctx.results.append(.{
        .id = 0,
        .prop = refField,
        .value = value,
        .score = null,
        .type = types.ResultType.aggregate,
    });

    return resultsSize + 2 + 4;
}
