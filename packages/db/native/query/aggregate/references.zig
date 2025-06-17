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
            const crcLen = groupCtx.propType.crcLen();
            const key: []u8 = if (groupValue.len > 0) groupValue.ptr[groupCtx.start + 2 .. groupValue.len - crcLen] else emptyKey;
            var accumulatorField: []u8 = undefined;
            if (!groupCtx.hashMap.contains(key)) {
                accumulatorField = try ctx.allocator.alloc(u8, groupCtx.accumulatorSize);
                @memset(accumulatorField, 0);
                try groupCtx.hashMap.put(key, accumulatorField);
                ctx.size += 2 + key.len + groupCtx.resultsSize;
            } else {
                accumulatorField = groupCtx.hashMap.get(key).?;
            }
            aggregate(agg, typeEntry, n, accumulatorField);
        }
    }

    const data = try ctx.allocator.alloc(u8, ctx.size);

    try finalizeGroupResults(data, groupCtx, agg);

    try ctx.results.append(.{
        .id = null,
        .field = refField,
        .val = data,
        .score = null,
        .type = types.ResultType.aggregate,
    });

    return groupCtx.resultsSize + 6;
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
            aggregate(agg, typeEntry, refNode, accumulatorField);
        }
    }

    const val = try ctx.allocator.alloc(u8, resultsSize);
    try finalizeDefaultResults(val, accumulatorField, agg);

    try ctx.results.append(.{
        .id = null,
        .field = refField,
        .val = val,
        .score = null,
        .type = types.ResultType.aggregate,
    });

    return resultsSize + 2 + 4;
}

pub inline fn finalizeDefaultResults(resultsField: []u8, accumulatorField: []u8, agg: []u8) !void {
    var j: usize = 0;
    const fieldAggsSize = read(u16, agg, 1);
    const aggPropDef = agg[3 .. 3 + fieldAggsSize];

    @memset(resultsField, 0);
    j = 0;
    while (j < fieldAggsSize) {
        const aggType: aggregateTypes.AggType = @enumFromInt(aggPropDef[j]);
        j += 1;
        // propType
        j += 1;
        // start
        j += 2;
        const resultPos = read(u16, aggPropDef, j);
        j += 2;
        const accumulatorPos = read(u16, aggPropDef, j);
        j += 2;

        if (aggType == aggregateTypes.AggType.COUNT or aggType == aggregateTypes.AggType.SUM) {
            copy(resultsField[resultPos..], accumulatorField[accumulatorPos .. accumulatorPos + 4]);
        } else if (aggType == aggregateTypes.AggType.STDDEV) {
            const count = read(u64, accumulatorField, accumulatorPos);
            if (count > 1) {
                const sum = read(f64, accumulatorField, accumulatorPos + 8);
                const sum_sq = read(f64, accumulatorField, accumulatorPos + 16);
                const mean = sum / @as(f64, @floatFromInt(count));
                const variance = (sum_sq / @as(f64, @floatFromInt(count))) - (mean * mean);
                const stddev = @sqrt(variance);
                writeInt(f64, resultsField, resultPos, @floatCast(stddev));
            } else {
                writeInt(f64, resultsField, resultPos, 0.0);
            }
        } else if (aggType == aggregateTypes.AggType.CARDINALITY) {
            // const hll = read hll "buffer" from accumulatorField and convert it to selvastring
            // const cardinality = hll_count(hll)
            // writeInt(f64, resultsField, resultPos, cardinality); // u16
        }
    }
}

pub inline fn finalizeGroupResults(
    data: []u8,
    ctx: *GroupCtx,
    agg: []u8,
) !void {
    if (agg.len == 0) {
        try setGroupResults(data, ctx);
    } else {
        var it = ctx.hashMap.iterator();
        var i: usize = 0;

        while (it.next()) |entry| {
            const key = entry.key_ptr.*;
            const keyLen: u16 = @intCast(key.len);
            writeInt(u16, data, i, keyLen);
            i += 2;
            if (keyLen > 0) {
                copy(data[i .. i + keyLen], key);
                i += keyLen;
            }

            const accumulatorField = entry.value_ptr.*;
            const resultsField = data[i .. i + ctx.resultsSize];
            @memset(resultsField, 0);

            try finalizeDefaultResults(resultsField, accumulatorField, agg);
            i += ctx.resultsSize;
        }
    }
}
