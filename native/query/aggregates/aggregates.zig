const Query = @import("../common.zig");
const Node = @import("../../selva/node.zig");
const Selva = @import("../../selva/selva.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const utils = @import("../../utils.zig");
const writeAs = utils.writeAs;
const read = utils.read;
const microbufferToF64 = utils.microbufferToF64;
const t = @import("../../types.zig");

pub fn iterator(
    ctx: *Query.QueryCtx,
    it: anytype,
    limit: u32,
    filterBuf: []u8,
    aggDefs: []u8,
    accumulatorField: []u8,
    typeEntry: Node.Type,
) !u32 {
    var count: u32 = 0;

    while (it.next()) |node| {
        if (filterBuf.len > 0) {
            // Filter Check
        }

        aggregateNode(ctx, node, typeEntry, aggDefs, accumulatorField);

        count += 1;
        if (count >= limit) break;
    }
    return count;
}

inline fn aggregateNode(
    ctx: *Query.QueryCtx,
    node: Node.Node,
    typeEntry: Node.Type,
    aggDefs: []u8,
    accumulatorProp: []u8,
) void {
    if (aggDefs.len == 0) return;

    var i: usize = 0;
    while (i < aggDefs.len) {
        const propId = aggDefs[i];
        i += 1;
        const propType: t.PropType = @enumFromInt(aggDefs[i]);
        i += 1;
        const aggFunction: t.AggFunction = @enumFromInt(aggDefs[i]);
        _ = ctx;

        var value: []u8 = undefined;
        const propSchema = Schema.getFieldSchema(typeEntry, propId) catch {
            i += @sizeOf(t.AggProp);
            continue;
        };

        value = Fields.get(
            typeEntry,
            node,
            propSchema,
            propType,
        );

        if (value.len > 0) {
            execAggInternal(aggFunction, propType, accumulatorProp, value);
        }

        i += @sizeOf(t.AggProp);
    }
}

inline fn execAggInternal(aggFunction: t.AggFunction, propType: t.PropType, accumulatorProp: []u8, value: []u8) void {
    const accumulatorPos: usize = 0;
    const start = 0;

    switch (aggFunction) {
        .sum => {
            writeAs(f64, accumulatorProp, read(f64, accumulatorProp, accumulatorPos) + microbufferToF64(propType, value, start), accumulatorPos);
        },
        .avg => {
            const val = microbufferToF64(propType, value, start);
            var count = read(u64, accumulatorProp, accumulatorPos);
            var sum = read(f64, accumulatorProp, accumulatorPos + 8);

            count += 1;
            sum += val;

            writeAs(u64, accumulatorProp, count, accumulatorPos);
            writeAs(f64, accumulatorProp, sum, accumulatorPos + 8);
        },
        else => {
            return;
        },
    }
    // utils.debugPrint("accProp: {d}\n", .{read(u64, accumulatorProp, 0)});
    // utils.debugPrint("accProp: {d}\n", .{read(f64, accumulatorProp, 8)});
    // writeAs(f64, accumulatorField, accumulatorPos, read(f64, accumulatorField, accumulatorPos) + microbufferToF64(propType, value, start));
}

// pub inline fn finalizeResults(resultsProp: []u8, accumulatorProp: []u8, agg: []u8) !void {
//     var i: usize = 0;
//     @memset(resultsProp, 0);
// }
