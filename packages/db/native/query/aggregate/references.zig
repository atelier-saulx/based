const std = @import("std");
const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig").c;
const results = @import("../results.zig");
const Query = @import("../common.zig");
const utils = @import("../../utils.zig");
const aggregate = @import("./aggregate.zig").aggregate;
const createGroupCtx = @import("./group.zig").createGroupCtx;
const GroupProtocolLen = @import("./group.zig").ProtocolLen;
const groupFunctions = @import("./group.zig");
const filter = @import("../filter/filter.zig").filter;
const t = @import("../../types.zig");

const setGroupResults = groupFunctions.setGroupResults;
const finalizeGroupResults = groupFunctions.finalizeGroupResults;
const finalizeResults = groupFunctions.finalizeResults;
const GroupCtx = groupFunctions.GroupCtx;
const read = utils.read;
const copy = utils.copy;
const writeInt = utils.writeIntExact;

pub fn aggregateRefsFields(
    ctx: *Query.QueryCtx,
    include: []u8,
    node: db.Node,
    originalType: db.Type,
) !usize {
    var index: usize = 0;
    const filterSize: u16 = read(u16, include, index);
    index += 2;
    const offset: u32 = read(u32, include, index);
    index += 4;
    const filterArr: ?[]u8 = if (filterSize > 0) include[index .. index + filterSize] else null;
    index += filterSize;
    const typeId: t.TypeId = read(u16, include, index);
    index += 2;
    const refField = include[index];
    index += 1;
    const groupBy: t.AggGroupedBy = @enumFromInt(include[index]);
    index += 1;
    if (groupBy == t.AggGroupedBy.hasGroup) {
        const agg = include[index..include.len];
        return try aggregateRefsGroup(ctx, typeId, originalType, node, refField, agg, offset, filterArr);
    } else {
        const resultsSize = read(u16, include, index);
        index += 2;
        const accumulatorSize = read(u16, include, index);
        index += 2;
        const option = include[index];
        index += 1;
        const agg = include[index..include.len];
        return try aggregateRefsDefault(ctx, typeId, originalType, node, refField, agg, offset, filterArr, resultsSize, accumulatorSize, option);
    }
    return 0;
}

pub inline fn aggregateRefsGroup(
    ctx: *Query.QueryCtx,
    typeId: t.TypeId,
    originalType: db.Type,
    node: db.Node,
    refField: u8,
    aggInput: []u8,
    offset: u32,
    filterArr: ?[]u8,
) !usize {
    const typeEntry = try db.getType(ctx.db, typeId);
    var refs: ?Query.Refs = undefined;
    const hasFilter: bool = filterArr != null;
    const emptyKey = &[_]u8{};
    const fieldSchema = db.getFieldSchema(originalType, refField) catch {
        return 0;
    };
    const edgeConstraint = db.getEdgeFieldConstraint(fieldSchema);
    const references = db.getReferences(node, fieldSchema);
    if (references == null) {
        return 0;
    }

    refs = .{ .refs = references.?, .fs = fieldSchema };

    var index: usize = 0;
    var resultsSize: usize = 0;

    const groupCtx = try createGroupCtx(aggInput[index .. index + GroupProtocolLen], typeEntry, ctx);
    index += GroupProtocolLen;

    const agg = aggInput[index..aggInput.len];

    const refsCnt = refs.?.refs.*.nr_refs;
    var i: usize = offset;

    const hllAccumulator = selva.selva_string_create(null, selva.HLL_INIT_SIZE, selva.SELVA_STRING_MUTABLE);
    defer selva.selva_string_free(hllAccumulator);

    checkItem: while (i < refsCnt) : (i += 1) {
        if (Query.resolveRefsNode(ctx.db, refs.?, i)) |n| {
            if (hasFilter) {
                const refStruct = Query.RefResult(refs, edgeConstraint, i);
                if (!filter(ctx.db, n, ctx.threadCtx, typeEntry, filterArr.?, refStruct, null, 0, false)) {
                    continue :checkItem;
                }
            }
            const groupValue = db.getField(typeEntry, n, groupCtx.fieldSchema, groupCtx.propType);
            const key: []u8 = if (groupValue.len > 0)
                if (groupCtx.propType == t.PropType.string)
                    if (groupCtx.field == 0)
                        groupValue.ptr[groupCtx.start + 1 .. groupCtx.start + 1 + groupValue[groupCtx.start]]
                    else
                        groupValue.ptr[2 + groupCtx.start .. groupCtx.start + groupValue.len - groupCtx.propType.crcLen()]
                else if (groupCtx.propType == t.PropType.timestamp)
                    @constCast(utils.datePart(groupValue.ptr[groupCtx.start .. groupCtx.start + groupCtx.len], @enumFromInt(groupCtx.stepType), groupCtx.timezone))
                else if (groupCtx.propType == t.PropType.reference)
                    db.getReferenceNodeId(@ptrCast(@alignCast(groupValue.ptr)))
                else
                    groupValue.ptr[groupCtx.start .. groupCtx.start + groupCtx.len]
            else
                emptyKey;

            const hash_map_entry = if (groupCtx.propType == t.PropType.timestamp and groupCtx.stepRange != 0)
                try groupCtx.hashMap.getOrInsertWithRange(key, groupCtx.accumulatorSize, groupCtx.stepRange)
            else
                try groupCtx.hashMap.getOrInsert(key, groupCtx.accumulatorSize);
            const accumulatorField = hash_map_entry.value;
            var hadAccumulated = !hash_map_entry.is_new;
            const resultKeyLen = if (groupCtx.stepType != @intFromEnum(t.Interval.none)) 4 else key.len;
            if (hash_map_entry.is_new) {
                resultsSize += 2 + resultKeyLen + groupCtx.resultsSize;
            }

            aggregate(agg, typeEntry, n, accumulatorField, hllAccumulator, &hadAccumulated, undefined, null);
        }
    }

    const data = try ctx.allocator.alloc(u8, resultsSize);

    try finalizeGroupResults(data, groupCtx, agg);

    try ctx.results.append(.{
        .id = 0,
        .prop = refField,
        .value = data,
        .score = null,
        .type = t.ResultType.aggregate,
    });
    return resultsSize + 6;
}

pub inline fn aggregateRefsDefault(
    ctx: *Query.QueryCtx,
    typeId: t.TypeId,
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
    var refs: ?Query.Refs = undefined;
    const hasFilter: bool = filterArr != null;
    var hadAccumulated: bool = false;
    const hllAccumulator = selva.selva_string_create(null, selva.HLL_INIT_SIZE, selva.SELVA_STRING_MUTABLE);
    defer selva.selva_string_free(hllAccumulator);
    var fieldSchema: db.FieldSchema = undefined;
    const aggPropTypeDefSize = 10;

    fieldSchema = db.getFieldSchema(originalType, refField) catch {
        return aggPropTypeDefSize;
    };
    const edgeConstraint = db.getEdgeFieldConstraint(fieldSchema);
    const references = db.getReferences(node, fieldSchema);
    if (references == null) {
        return aggPropTypeDefSize;
    }

    refs = .{ .refs = references.?, .fs = fieldSchema };

    const refsCnt = refs.?.refs.*.nr_refs;

    const fieldAggsSize = read(u16, agg, 1);
    const aggPropTypeDef = agg[3 .. 3 + fieldAggsSize];
    const aggType: t.AggType = @enumFromInt(aggPropTypeDef[0]);
    if (aggType == t.AggType.count and !hasFilter and accumulatorSize == 4) {
        const resultPos = read(u16, aggPropTypeDef, 4);
        writeInt(u32, accumulatorField, resultPos, refsCnt);
    } else {
        var i: usize = offset;
        checkItem: while (i < refsCnt) : (i += 1) {
            if (Query.resolveRefsNode(ctx.db, refs.?, i)) |refNode| {
                const refStruct = Query.RefResult(refs, edgeConstraint, i);
                if (hasFilter) {
                    if (!filter(ctx.db, refNode, ctx.threadCtx, typeEntry, filterArr.?, refStruct, null, 0, false)) {
                        continue :checkItem;
                    }
                }
                aggregate(agg, typeEntry, refNode, accumulatorField, hllAccumulator, &hadAccumulated, ctx.db, refStruct);
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
        .type = t.ResultType.aggregate,
    });

    return resultsSize + 2 + 4;
}
