const Query = @import("../common.zig");
const Node = @import("../../selva/node.zig");
const Selva = @import("../../selva/selva.zig");
const Schema = @import("../../selva/schema.zig");
const utils = @import("../../utils.zig");
const writeAs = utils.writeAs;
const read = utils.read;
const microbufferToF64 = utils.microbufferToF64;
const t = @import("../../types.zig");

pub fn iteratorAggregates(
    ctx: *Query.QueryCtx,
    it: anytype,
    limit: u32,
    filterBuf: []u8,
    aggDefs: []u8,
    accumulatorField: []u8,
    typeEntry: Node.Type,
) !void {
    var count: u32 = 0;

    while (it.next()) |node| {
        if (filterBuf.len > 0) {
            // Filter Check
        }

        aggregateNode(ctx, node, typeEntry, aggDefs, accumulatorField);

        count += 1;
        if (count >= limit) break;
    }
}

inline fn aggregateNode(
    ctx: *Query.QueryCtx,
    node: Node.Node,
    typeEntry: Node.Type,
    aggDefs: []u8,
    accumulatorField: []u8,
) void {
    if (aggDefs.len == 0) return;

    var i: usize = 0;
    while (i < aggDefs.len) {
        const field = aggDefs[i];
        i += 1;
        const fieldAggsSize = utils.read(u16, aggDefs, i);
        i += 2;
        const aggPropDef = aggDefs[i .. i + fieldAggsSize];
        const aggType: t.AggFunctionType = @enumFromInt(aggPropDef[0]);
        _ = aggType;
        _ = ctx;

        var value: []u8 = undefined;
        const fieldSchema = Schema.getFieldSchema(typeEntry, field) catch {
            i += fieldAggsSize;
            continue;
        };

        _ = fieldSchema;
        _ = node;
        value = aggDefs[0..1];
        // value = Schema.getField(typeEntry, node, fieldSchema, t.Prop.MICRO_BUFFER);

        if (value.len > 0) {
            execAggInternal(aggPropDef, accumulatorField, value);
        }

        i += fieldAggsSize;
    }
}

inline fn execAggInternal(aggPropDef: []u8, accumulatorField: []u8, value: []u8) void {
    const accumulatorPos = 0;
    const propType: t.PropType = @enumFromInt(aggPropDef[2]);
    const start = read(u16, aggPropDef, 3);
    _ = accumulatorPos;
    _ = propType;
    _ = start;
    _ = value;
    _ = accumulatorField;
    // writeAs(f64, accumulatorField, accumulatorPos, read(f64, accumulatorField, accumulatorPos) + microbufferToF64(propType, value, start));
}
