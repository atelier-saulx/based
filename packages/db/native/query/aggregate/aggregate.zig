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
    resultsField: []u8,
    value: []u8,
    fieldAggsSize: u16,
) void {
    var j: usize = 0;

    while (j < fieldAggsSize) {
        const aggType: aggregateTypes.AggType = @enumFromInt(aggPropDef[0]);
        j += 1;
        const propType: types.Prop = @enumFromInt(aggPropDef[j]);
        j += 1;
        const start = read(u16, aggPropDef, j);
        j += 2;
        const resultPos = read(u16, aggPropDef, j);
        j += 2;
        if (aggType == aggregateTypes.AggType.COUNT) {
            writeInt(u32, resultsField, resultPos, read(u32, resultsField, resultPos) + 1);
        } else if (aggType == aggregateTypes.AggType.CARDINALITY) {
            // dest = the value for that key in hashmap. Must be the hll/selva_string, not the count
            // src = the current hll value to be unioned

            const newLen = selva.hll_union(&resultsField[0..resultPos], &value[start..]);

            utils.debugPrint("union_agg! hll_union => {d}\n", .{newLen});
            // writeInt(u32, resultsField, resultPos, read(u32, resultsField, resultPos) + read(u32, value, start));
        } else if (aggType == aggregateTypes.AggType.SUM) {
            if (propType == types.Prop.UINT32) {
                writeInt(u32, resultsField, resultPos, read(u32, resultsField, resultPos) + read(u32, value, start));
            } else if (propType == types.Prop.UINT8) {
                writeInt(u32, resultsField, resultPos, read(u32, resultsField, resultPos) + value[start]);
            } else {
                //later
            }
        }
    }
}

pub inline fn aggregate(agg: []u8, typeEntry: db.Type, node: db.Node, resultsField: []u8) void {
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

    if (aggType == .CARDINALITY) {
        const fieldSchema = db.getFieldSchema(field, typeEntry) catch {
            std.log.err("Cannot get fieldschema {any} \n", .{field});
            return;
        };
        // value = db.getField(typeEntry, db.getNodeId(node), node, fieldSchema, types.Prop.CARDINALITY);
        value = selva.selva_fields_ensure_string(node, fieldSchema, selva.HLL_INIT_SIZE);

        if (value.len == 0) {
            i += fieldAggsSize;
            // return;
        }
    } else if (field != aggregateTypes.IsId) {
        // Later need to add support for HLL
        if (field != types.MAIN_PROP) {
            i += fieldAggsSize;
            return;
        }
        const fieldSchema = db.getFieldSchema(field, typeEntry) catch {
            std.log.err("Cannot get fieldschema {any} \n", .{field});
            return;
        };
        value = db.getField(typeEntry, db.getNodeId(node), node, fieldSchema, types.Prop.MICRO_BUFFER);
        if (value.len == 0) {
            i += fieldAggsSize;
            return;
        }
    }
    execAgg(aggPropDef, resultsField, value, fieldAggsSize);
    i += fieldAggsSize;
    return;
}
