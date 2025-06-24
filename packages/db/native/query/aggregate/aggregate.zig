const db = @import("../../db/db.zig");
const types = @import("../../types.zig");
const std = @import("std");
const utils = @import("../../utils.zig");
const selva = @import("../../selva.zig");
const read = utils.read;
const writeInt = utils.writeIntExact;
const aggregateTypes = @import("../aggregate/types.zig");
const copy = utils.copy;

pub inline fn execAgg(
    aggPropDef: []u8,
    accumulatorField: []u8,
    value: []u8,
    fieldAggsSize: u16,
    hadAccumulated: *bool,
) void {
    var j: usize = 0;
    while (j < fieldAggsSize) {
        const aggType: aggregateTypes.AggType = @enumFromInt(aggPropDef[j]);
        j += 1;
        const propType: types.Prop = @enumFromInt(aggPropDef[j]);
        j += 1;
        const start = read(u16, aggPropDef, j);
        j += 2;
        const resultPos = read(u16, aggPropDef, j);
        j += 2;
        const accumulatorPos = read(u16, aggPropDef, j);
        j += 2;

        // TODO: populational or sample statistics switch or aliases

        if (aggType == aggregateTypes.AggType.COUNT) {
            writeInt(u32, accumulatorField, resultPos, read(u32, accumulatorField, resultPos) + 1);
        } else if (aggType == aggregateTypes.AggType.MAX) {
            writeInt(i64, accumulatorField, resultPos, @max(if (hadAccumulated.*) read(i64, accumulatorField, resultPos) else std.math.minInt(i64), value[start]));
        } else if (aggType == aggregateTypes.AggType.MIN) {
            writeInt(i64, accumulatorField, resultPos, @min(if (hadAccumulated.*) read(i64, accumulatorField, resultPos) else std.math.maxInt(i64), value[start]));
        } else if (aggType == aggregateTypes.AggType.SUM) {
            writeInt(f64, accumulatorField, resultPos, read(f64, accumulatorField, resultPos) + @as(f64, @floatFromInt(value[start])));
        } else if (aggType == aggregateTypes.AggType.AVERAGE) {
            const val: f64 = if (propType == types.Prop.UINT32) @floatFromInt(read(u32, value, start)) else if (propType == types.Prop.UINT8) @floatFromInt(value[start]) else 0;

            var count = read(u64, accumulatorField, accumulatorPos);
            var sum = read(f64, accumulatorField, accumulatorPos + 8);

            count += 1;
            sum += val;

            writeInt(u64, accumulatorField, accumulatorPos, count);
            writeInt(f64, accumulatorField, accumulatorPos + 8, sum);
        } else if (aggType == aggregateTypes.AggType.STDDEV or
            aggType == aggregateTypes.AggType.VARIANCE)
        {
            const val: f64 = if (propType == types.Prop.UINT32) @floatFromInt(read(u32, value, start)) else if (propType == types.Prop.UINT8) @floatFromInt(value[start]) else 0;

            var count = read(u64, accumulatorField, accumulatorPos);
            var sum = read(f64, accumulatorField, accumulatorPos + 8);
            var sum_sq = read(f64, accumulatorField, accumulatorPos + 16);

            count += 1;
            sum += val;
            sum_sq += val * val;

            writeInt(u64, accumulatorField, accumulatorPos, count);
            writeInt(f64, accumulatorField, accumulatorPos + 8, sum);
            writeInt(f64, accumulatorField, accumulatorPos + 16, sum_sq);
        } else if (aggType == aggregateTypes.AggType.CARDINALITY) {
            // const hll = read from or point to value
            // const hllAcc = read hll from accumulator as selva string []u8
            // hll_union(hllAcc, hll) union and write to the hllAcc
        }
        hadAccumulated.* = true;
    }
}

pub inline fn aggregate(agg: []u8, typeEntry: db.Type, node: db.Node, accumulatorField: []u8, hadAccumulated: *bool) void {
    if (agg.len == 0) {
        return;
    }

    var i: usize = 0;
    const field = agg[i];
    i += 1;
    const fieldAggsSize = read(u16, agg, i);
    i += 2;
    const aggPropDef = agg[i .. i + fieldAggsSize];
    const aggType: aggregateTypes.AggType = @enumFromInt(aggPropDef[0]);

    var value: []u8 = undefined;

    if (field != aggregateTypes.IsId) {
        if (field != types.MAIN_PROP) {
            i += fieldAggsSize;
            return;
        }
        const fieldSchema = db.getFieldSchema(typeEntry, field) catch {
            std.log.err("Cannot get fieldschema {any} \n", .{field});
            return;
        };
        if (aggType == aggregateTypes.AggType.CARDINALITY) {
            // value = db.getCardinalityFieldAsSelvaString(node, fieldSchema); //@ptrCast para ?[]u8 ver como vai
            value = &[_]u8{}; // temp
        } else {
            value = db.getField(typeEntry, db.getNodeId(node), node, fieldSchema, types.Prop.MICRO_BUFFER);
        }

        if (value.len == 0) {
            i += fieldAggsSize;
            return;
        }
    }
    execAgg(aggPropDef, accumulatorField, value, fieldAggsSize, hadAccumulated);
    i += fieldAggsSize;
    return;
}
