const std = @import("std");
const db = @import("../../db/db.zig");
const utils = @import("../../utils.zig");
const selva = @import("../../selva.zig").c;
const Query = @import("../common.zig");
const t = @import("../../types.zig");

const microbufferToF64 = utils.microbufferToF64;
const read = utils.read;
const write = utils.write;

inline fn execAgg(
    aggPropTypeDef: []u8,
    accumulatorField: []u8,
    value: []u8,
    fieldAggsSize: u16,
    hadAccumulated: *bool,
    hllAccumulator: anytype,
    hllValue: anytype,
) void {
    var j: usize = 0;
    while (j < fieldAggsSize) {
        const aggType: t.AggType = @enumFromInt(aggPropTypeDef[j]);
        j += 1;
        const propType: t.PropType = @enumFromInt(aggPropTypeDef[j]);
        j += 1;
        const start = read(u16, aggPropTypeDef, j);
        j += 2;
        // const resultPos = read(u16, aggPropTypeDef, j); // TODO: Remove from buffer if not used
        j += 2;
        const accumulatorPos = read(u16, aggPropTypeDef, j);
        j += 2;
        // isEdge
        j += 1;

        if (aggType == t.AggType.count) {
            write(
                u32,
                accumulatorField,
                read(u32, accumulatorField, accumulatorPos) + 1,
                accumulatorPos,
            );
        } else if (aggType == t.AggType.max) {
            if (!hadAccumulated.*) {
                write(
                    f64,
                    accumulatorField,
                    microbufferToF64(propType, value, start),
                    accumulatorPos,
                );
            } else {
                write(
                    f64,
                    accumulatorField,
                    @max(read(f64, accumulatorField, accumulatorPos), microbufferToF64(propType, value, start)),
                    accumulatorPos,
                );
            }
        } else if (aggType == t.AggType.min) {
            if (!hadAccumulated.*) {
                write(
                    f64,
                    accumulatorField,
                    microbufferToF64(propType, value, start),
                    accumulatorPos,
                );
            } else {
                write(
                    f64,
                    accumulatorField,
                    @min(read(f64, accumulatorField, accumulatorPos), microbufferToF64(propType, value, start)),
                    accumulatorPos,
                );
            }
        } else if (aggType == t.AggType.sum) {
            write(
                f64,
                accumulatorField,
                read(f64, accumulatorField, accumulatorPos) + microbufferToF64(propType, value, start),
                accumulatorPos,
            );
        } else if (aggType == t.AggType.average) {
            const val = microbufferToF64(propType, value, start);
            var count = read(u64, accumulatorField, accumulatorPos);
            var sum = read(f64, accumulatorField, accumulatorPos + 8);
            count += 1;
            sum += val;
            write(u64, accumulatorField, count, accumulatorPos);
            write(f64, accumulatorField, sum, accumulatorPos + 8);
        } else if (aggType == t.AggType.hmean) {
            const val = microbufferToF64(propType, value, start);
            if (val != 0) {
                var count = read(u64, accumulatorField, accumulatorPos);
                var sum = read(f64, accumulatorField, accumulatorPos + 8);
                count += 1;
                sum += 1 / val;
                write(u64, accumulatorField, count, accumulatorPos);
                write(f64, accumulatorField, sum, accumulatorPos + 8);
            } else {
                write(u64, accumulatorField, 0.0, accumulatorPos);
                write(f64, accumulatorField, 0.0, accumulatorPos + 8);
            }
        } else if (aggType == t.AggType.stddev or
            aggType == t.AggType.variance)
        {
            const val = microbufferToF64(propType, value, start);
            var count = read(u64, accumulatorField, accumulatorPos);
            var sum = read(f64, accumulatorField, accumulatorPos + 8);
            var sum_sq = read(f64, accumulatorField, accumulatorPos + 16);
            count += 1;
            sum += val;
            sum_sq += val * val;
            write(u64, accumulatorField, count, accumulatorPos);
            write(f64, accumulatorField, sum, accumulatorPos + 8);
            write(f64, accumulatorField, sum_sq, accumulatorPos + 16);
        } else if (aggType == t.AggType.cardinality) {
            selva.hll_union(hllAccumulator, hllValue);
            write(
                u32,
                accumulatorField,
                read(u32, selva.hll_count(hllAccumulator)[0..4], 0),
                accumulatorPos,
            );
        }
    }
}

pub inline fn aggregate(
    agg: []u8,
    typeEntry: db.Type,
    node: db.Node,
    accumulatorField: []u8,
    hllAccumulator: anytype,
    hadAccumulated: *bool,
    ctx: *db.DbCtx,
    edgeRef: ?Query.RefStruct,
) void {
    if (agg.len == 0) {
        return;
    }
    var i: usize = 0;
    while (i < agg.len) {
        const field = agg[i];
        i += 1;
        const fieldAggsSize = read(u16, agg, i);
        i += 2;
        const aggPropTypeDef = agg[i .. i + fieldAggsSize];
        const aggType: t.AggType = @enumFromInt(aggPropTypeDef[0]);
        const isEdge: bool = aggPropTypeDef[8] == 1;
        var value: []u8 = undefined;

        if (field != t.ID_PROP) {
            if (field != t.MAIN_PROP and aggType != t.AggType.cardinality) {
                i += fieldAggsSize;
                continue;
            }
            const fieldSchema = db.getFieldSchema(typeEntry, field) catch {
                std.log.err("Cannot get fieldschema {any} \n", .{field});
                i += fieldAggsSize;
                continue;
            };
            if (aggType == t.AggType.cardinality) {
                const hllValue = selva.selva_fields_get_selva_string(node, fieldSchema) orelse null;
                if (hllValue == null) {
                    i += fieldAggsSize;
                    continue;
                }
                if (!hadAccumulated.*) {
                    _ = selva.selva_string_replace(hllAccumulator, null, selva.HLL_INIT_SIZE);
                    selva.hll_init_like(hllAccumulator, hllValue);
                }
                execAgg(aggPropTypeDef, accumulatorField, value, fieldAggsSize, hadAccumulated, hllAccumulator, hllValue);
                hadAccumulated.* = true;
            } else {
                value = if (isEdge and edgeRef != null) db.getEdgePropType(ctx, edgeRef.?.edgeConstraint, edgeRef.?.largeReference.?, fieldSchema) else db.getField(
                    typeEntry,
                    node,
                    fieldSchema,
                    t.PropType.microBuffer,
                );
                if (value.len == 0) {
                    i += fieldAggsSize;
                    continue;
                }
                execAgg(aggPropTypeDef, accumulatorField, value, fieldAggsSize, hadAccumulated, null, null);
                hadAccumulated.* = true;
            }
        } else {
            execAgg(aggPropTypeDef, accumulatorField, value, fieldAggsSize, hadAccumulated, null, null);
            hadAccumulated.* = true;
        }
        i += fieldAggsSize;
    }
}
