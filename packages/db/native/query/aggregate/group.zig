const selva = @import("../../selva.zig");
const std = @import("std");
const utils = @import("../../utils.zig");
const copy = utils.copy;
const writeInt = utils.writeIntExact;
const types = @import("../../types.zig");
const GroupByHashMap = @import("./types.zig").GroupByHashMap;
const read = utils.read;
const db = @import("../../db/db.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const aggregateTypes = @import("../aggregate/types.zig");

pub const ProtocolLen = 10;

pub const GroupCtx = struct {
    hashMap: GroupByHashMap,
    resultsSize: u16,
    accumulatorSize: u16,
    fieldSchema: db.FieldSchema,
    start: u16,
    field: u8,
    len: u16,
    propType: types.Prop,
};

pub inline fn setGroupResults(
    data: []u8,
    ctx: *GroupCtx,
) !void {
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
        copy(data[i .. i + ctx.resultsSize], entry.value_ptr.*);
        i += ctx.resultsSize;
    }
}

pub inline fn finalizeResults(resultsField: []u8, accumulatorField: []u8, agg: []u8) !void {
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

        if (aggType == aggregateTypes.AggType.COUNT) {
            copy(resultsField[resultPos..], accumulatorField[accumulatorPos .. accumulatorPos + 4]);
        } else if (aggType == aggregateTypes.AggType.SUM or
            aggType == aggregateTypes.AggType.MAX or
            aggType == aggregateTypes.AggType.MIN)
        {
            copy(resultsField[resultPos..], accumulatorField[accumulatorPos .. accumulatorPos + 8]);
        } else if (aggType == aggregateTypes.AggType.AVERAGE) {
            const count = read(u64, accumulatorField, accumulatorPos);
            const sum = read(f64, accumulatorField, accumulatorPos + 8);
            const mean = sum / @as(f64, @floatFromInt(count));
            writeInt(f64, resultsField, resultPos, @floatCast(mean));
        } else if (aggType == aggregateTypes.AggType.VARIANCE) {
            const count = read(u64, accumulatorField, accumulatorPos);
            if (count > 1) {
                const sum = read(f64, accumulatorField, accumulatorPos + 8);
                const sum_sq = read(f64, accumulatorField, accumulatorPos + 16);
                const mean = sum / @as(f64, @floatFromInt(count));
                const variance = (sum_sq / @as(f64, @floatFromInt(count))) - (mean * mean);
                if (variance < 0.0 and variance > -std.math.inf(f64)) {
                    writeInt(f64, resultsField, resultPos, 0.0);
                } else {
                    writeInt(f64, resultsField, resultPos, @floatCast(variance));
                }
            } else {
                writeInt(f64, resultsField, resultPos, 0.0);
            }
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
            writeInt(u32, resultsField, resultPos, read(u32, accumulatorField, accumulatorPos));
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

            try finalizeResults(resultsField, accumulatorField, agg);
            i += ctx.resultsSize;
        }
    }
}

pub fn createGroupCtx(aggInput: []u8, typeEntry: db.Type, ctx: *QueryCtx) !*GroupCtx {
    const field = aggInput[0];
    const propType: types.Prop = if (field == types.MAIN_PROP and @as(types.Prop, @enumFromInt(aggInput[1])) != types.Prop.ENUM) types.Prop.MICRO_BUFFER else @enumFromInt(aggInput[1]);
    const start = read(u16, aggInput, 2);
    const len = read(u16, aggInput, 4);
    const resultsSize = read(u16, aggInput, 6);
    const accumulatorSize = read(u16, aggInput, 8);
    const fieldSchema = try db.getFieldSchema(typeEntry, field);

    const groupCtx: *GroupCtx = try ctx.allocator.create(GroupCtx);
    groupCtx.* = .{
        .field = field,
        .propType = propType,
        .start = start,
        .len = len,
        .fieldSchema = fieldSchema,
        .hashMap = GroupByHashMap.init(ctx.allocator),
        .resultsSize = resultsSize,
        .accumulatorSize = accumulatorSize,
    };
    return groupCtx;
}
