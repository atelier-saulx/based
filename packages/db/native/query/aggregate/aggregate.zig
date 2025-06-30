const db = @import("../../db/db.zig");
const types = @import("../../types.zig");
const std = @import("std");
const utils = @import("../../utils.zig");
const selva = @import("../../selva.zig");
const read = utils.read;
const writeInt = utils.writeIntExact;
const aggregateTypes = @import("../aggregate/types.zig");
const copy = utils.copy;

pub fn microbufferToF64(propType: types.Prop, buffer: []u8, offset: usize) f64 {
    return switch (propType) {
        types.Prop.UINT8 => @as(f64, @floatFromInt(buffer[offset])),
        types.Prop.INT8 => @as(f64, @floatFromInt(buffer[offset])),
        types.Prop.UINT16 => @as(f64, @floatFromInt(read(u16, buffer, offset))),
        types.Prop.INT16 => @as(f64, @floatFromInt(read(i16, buffer, offset))),
        types.Prop.UINT32 => @as(f64, @floatFromInt(read(u32, buffer, offset))),
        types.Prop.INT32 => @as(f64, @floatFromInt(read(i32, buffer, offset))),
        types.Prop.NUMBER => read(f64, buffer, offset),
        else => undefined,
    };
}

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

        const current_value_f64 = microbufferToF64(propType, value, start);

        if (aggType == aggregateTypes.AggType.COUNT) {
            writeInt(u32, accumulatorField, resultPos, read(u32, accumulatorField, resultPos) + 1);
        } else if (aggType == aggregateTypes.AggType.MAX) {
            if (!hadAccumulated.*) {
                writeInt(f64, accumulatorField, resultPos, current_value_f64);
            } else {
                writeInt(f64, accumulatorField, resultPos, @max(read(f64, accumulatorField, resultPos), current_value_f64));
            }
        } else if (aggType == aggregateTypes.AggType.MIN) {
            if (!hadAccumulated.*) {
                writeInt(f64, accumulatorField, resultPos, current_value_f64);
            } else {
                writeInt(f64, accumulatorField, resultPos, @min(read(f64, accumulatorField, resultPos), current_value_f64));
            }
        } else if (aggType == aggregateTypes.AggType.SUM) {
            writeInt(f64, accumulatorField, resultPos, read(f64, accumulatorField, resultPos) + current_value_f64);
        } else if (aggType == aggregateTypes.AggType.AVERAGE) {
            const val = current_value_f64;
            var count = read(u64, accumulatorField, accumulatorPos);
            var sum = read(f64, accumulatorField, accumulatorPos + 8);

            count += 1; // WARNING: if prop is undefined, it still is initialized with 0, so count increments and average and other stats ARE affected
            sum += val;

            writeInt(u64, accumulatorField, accumulatorPos, count);
            writeInt(f64, accumulatorField, accumulatorPos + 8, sum);
        } else if (aggType == aggregateTypes.AggType.STDDEV or
            aggType == aggregateTypes.AggType.VARIANCE)
        {
            var count = read(u64, accumulatorField, accumulatorPos);
            var sum = read(f64, accumulatorField, accumulatorPos + 8);
            var sum_sq = read(f64, accumulatorField, accumulatorPos + 16);

            count += 1;
            sum += current_value_f64;
            sum_sq += current_value_f64 * current_value_f64;

            writeInt(u64, accumulatorField, accumulatorPos, count);
            writeInt(f64, accumulatorField, accumulatorPos + 8, sum);
            writeInt(f64, accumulatorField, accumulatorPos + 16, sum_sq);
        } else if (aggType == aggregateTypes.AggType.CARDINALITY) {
            // const hll = read from or point to value
            // const hllAcc = read hll from accumulator as selva string []u8
            // hll_union(hllAcc, hll) union and write to the hllAcc
        }
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
    // hadAccumulated.* = true;
    i += fieldAggsSize;
    return;
}
