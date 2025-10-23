const db = @import("../../db/db.zig");
const types = @import("../../types.zig");
const std = @import("std");
const utils = @import("../../utils.zig");
const selva = @import("../../selva.zig").c;
const read = utils.read;
const writeInt = utils.writeIntExact;
const aggregateTypes = @import("../aggregate/types.zig");
const copy = utils.copy;
const microbufferToF64 = @import("./utils.zig").microbufferToF64;
const incTypes = @import("../include/types.zig");

inline fn execAgg(
    aggPropDef: []u8,
    accumulatorField: []u8,
    value: []u8,
    fieldAggsSize: u16,
    hadAccumulated: *bool,
    hllAccumulator: anytype,
    hllValue: anytype,
) void {
    var j: usize = 0;
    while (j < fieldAggsSize) {
        const aggType: aggregateTypes.AggType = @enumFromInt(aggPropDef[j]);
        j += 1;
        const propType: types.Prop = @enumFromInt(aggPropDef[j]);
        j += 1;
        const start = read(u16, aggPropDef, j);
        j += 2;
        // const resultPos = read(u16, aggPropDef, j); // TODO: Remove from buffer if not used
        j += 2;
        const accumulatorPos = read(u16, aggPropDef, j);
        j += 2;
        // isEdge
        j += 1;

        if (aggType == aggregateTypes.AggType.COUNT) {
            writeInt(u32, accumulatorField, accumulatorPos, read(u32, accumulatorField, accumulatorPos) + 1);
        } else if (aggType == aggregateTypes.AggType.MAX) {
            if (!hadAccumulated.*) {
                writeInt(f64, accumulatorField, accumulatorPos, microbufferToF64(propType, value, start));
            } else {
                writeInt(f64, accumulatorField, accumulatorPos, @max(read(f64, accumulatorField, accumulatorPos), microbufferToF64(propType, value, start)));
            }
        } else if (aggType == aggregateTypes.AggType.MIN) {
            if (!hadAccumulated.*) {
                writeInt(f64, accumulatorField, accumulatorPos, microbufferToF64(propType, value, start));
            } else {
                writeInt(f64, accumulatorField, accumulatorPos, @min(read(f64, accumulatorField, accumulatorPos), microbufferToF64(propType, value, start)));
            }
        } else if (aggType == aggregateTypes.AggType.SUM) {
            writeInt(f64, accumulatorField, accumulatorPos, read(f64, accumulatorField, accumulatorPos) + microbufferToF64(propType, value, start));
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
        } else if (aggType == aggregateTypes.AggType.CARDINALITY) {
            selva.hll_union(hllAccumulator, hllValue);
            writeInt(u32, accumulatorField, accumulatorPos, read(u32, selva.hll_count(hllAccumulator)[0..4], 0));
        }
    }
}

pub inline fn aggregate(agg: []u8, typeEntry: db.Type, node: db.Node, accumulatorField: []u8, hllAccumulator: anytype, hadAccumulated: *bool, ctx: *db.DbCtx, edgeRef: ?incTypes.RefStruct) void {
    if (agg.len == 0) {
        return;
    }
    var i: usize = 0;
    while (i < agg.len) {
        const field = agg[i];
        i += 1;
        const fieldAggsSize = read(u16, agg, i);
        i += 2;
        const aggPropDef = agg[i .. i + fieldAggsSize];
        const aggType: aggregateTypes.AggType = @enumFromInt(aggPropDef[0]);
        const isEdge: bool = aggPropDef[8] == 1;
        var value: []u8 = undefined;

        if (field != aggregateTypes.IsId) {
            if (field != types.MAIN_PROP and aggType != aggregateTypes.AggType.CARDINALITY) {
                i += fieldAggsSize;
                continue;
            }
            const fieldSchema = db.getFieldSchema(typeEntry, field) catch {
                std.log.err("Cannot get fieldschema {any} \n", .{field});
                i += fieldAggsSize;
                continue;
            };
            if (aggType == aggregateTypes.AggType.CARDINALITY) {
                const hllValue = selva.selva_fields_get_selva_string(node, fieldSchema) orelse null;
                if (hllValue == null) {
                    i += fieldAggsSize;
                    continue;
                }
                if (!hadAccumulated.*) {
                    _ = selva.selva_string_replace(hllAccumulator, null, selva.HLL_INIT_SIZE);
                    selva.hll_init_like(hllAccumulator, hllValue);
                }
                execAgg(aggPropDef, accumulatorField, value, fieldAggsSize, hadAccumulated, hllAccumulator, hllValue);
                hadAccumulated.* = true;
            } else {
                value = if (isEdge and edgeRef != null) db.getEdgeProp(ctx, edgeRef.?.edgeConstraint, edgeRef.?.largeReference.?, fieldSchema) else db.getField(typeEntry, node, fieldSchema, types.Prop.MICRO_BUFFER);
                if (value.len == 0) {
                    i += fieldAggsSize;
                    continue;
                }
                execAgg(aggPropDef, accumulatorField, value, fieldAggsSize, hadAccumulated, null, null);
                hadAccumulated.* = true;
            }
        } else {
            execAgg(aggPropDef, accumulatorField, value, fieldAggsSize, hadAccumulated, null, null);
            hadAccumulated.* = true;
        }
        i += fieldAggsSize;
    }
}
