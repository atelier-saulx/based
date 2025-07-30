const db = @import("../../db/db.zig");
const types = @import("../../types.zig");
const std = @import("std");
const utils = @import("../../utils.zig");
const selva = @import("../../selva.zig");
const read = utils.read;
const writeInt = utils.writeIntExact;
const aggregateTypes = @import("../aggregate/types.zig");
const copy = utils.copy;
const microbufferToF64 = @import("./utils.zig").microbufferToF64;

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

        if (aggType == aggregateTypes.AggType.COUNT) {
            writeInt(u32, accumulatorField, resultPos, read(u32, accumulatorField, resultPos) + 1);
        } else if (aggType == aggregateTypes.AggType.MAX) {
            if (!hadAccumulated.*) {
                writeInt(f64, accumulatorField, resultPos, microbufferToF64(propType, value, start));
            } else {
                writeInt(f64, accumulatorField, resultPos, @max(read(f64, accumulatorField, resultPos), microbufferToF64(propType, value, start)));
            }
        } else if (aggType == aggregateTypes.AggType.MIN) {
            if (!hadAccumulated.*) {
                writeInt(f64, accumulatorField, resultPos, microbufferToF64(propType, value, start));
            } else {
                writeInt(f64, accumulatorField, resultPos, @min(read(f64, accumulatorField, resultPos), microbufferToF64(propType, value, start)));
            }
        } else if (aggType == aggregateTypes.AggType.SUM) {
            writeInt(f64, accumulatorField, resultPos, read(f64, accumulatorField, resultPos) + microbufferToF64(propType, value, start));
        } else if (aggType == aggregateTypes.AggType.AVERAGE) {
            const val = microbufferToF64(propType, value, start);
            var count = read(u64, accumulatorField, accumulatorPos);
            var sum = read(f64, accumulatorField, accumulatorPos + 8);

            count += 1;
            sum += val;

            writeInt(u64, accumulatorField, accumulatorPos, count);
            writeInt(f64, accumulatorField, accumulatorPos + 8, sum);
        } else if (aggType == aggregateTypes.AggType.HMEAN) {
            const val = microbufferToF64(propType, value, start);
            if (val != 0) {
                var count = read(u64, accumulatorField, accumulatorPos);
                var sum = read(f64, accumulatorField, accumulatorPos + 8);

                count += 1;
                sum += 1 / val;

                writeInt(u64, accumulatorField, accumulatorPos, count);
                writeInt(f64, accumulatorField, accumulatorPos + 8, sum);
            } else {
                writeInt(u64, accumulatorField, accumulatorPos, 0.0);
                writeInt(f64, accumulatorField, accumulatorPos + 8, 0.0);
            }
        } else if (aggType == aggregateTypes.AggType.STDDEV or
            aggType == aggregateTypes.AggType.VARIANCE)
        {
            const val = microbufferToF64(propType, value, start);
            var count = read(u64, accumulatorField, accumulatorPos);
            var sum = read(f64, accumulatorField, accumulatorPos + 8);
            var sum_sq = read(f64, accumulatorField, accumulatorPos + 16);

            count += 1;
            sum += val;
            sum_sq += val * val;

            writeInt(u64, accumulatorField, accumulatorPos, count);
            writeInt(f64, accumulatorField, accumulatorPos + 8, sum);
            writeInt(f64, accumulatorField, accumulatorPos + 16, sum_sq);
        }
    }
}

pub inline fn aggregate(agg: []u8, typeEntry: db.Type, node: db.Node, accumulatorField: []u8, hllAccumulator: anytype, hadAccumulated: *bool) void {
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
        if (field != types.MAIN_PROP and aggType != aggregateTypes.AggType.CARDINALITY) {
            return;
        }
        const fieldSchema = db.getFieldSchema(typeEntry, field) catch {
            std.log.err("Cannot get fieldschema {any} \n", .{field});
            return;
        };
        if (aggType == aggregateTypes.AggType.CARDINALITY) {
            const hllValue = selva.selva_fields_get_selva_string(node, fieldSchema) orelse null;
            if (hllValue == null) {
                return;
            }
            if (!hadAccumulated.*) {
                _ = selva.selva_string_replace(hllAccumulator, null, 0);
                selva.hll_init(hllAccumulator, 14, false);
            }
            selva.hll_union(hllAccumulator, hllValue);
            writeInt(u32, accumulatorField, 0, read(u32, selva.hll_count(hllAccumulator)[0..4], 0));
            return;
        } else {
            value = db.getField(typeEntry, db.getNodeId(node), node, fieldSchema, types.Prop.MICRO_BUFFER);
            if (value.len == 0) {
                return;
            }
        }
    }
    execAgg(aggPropDef, accumulatorField, value, fieldAggsSize, hadAccumulated);
    return;
}
