const Query = @import("../common.zig");
const Node = @import("../../selva/node.zig");
const Selva = @import("../../selva/selva.zig");
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const utils = @import("../../utils.zig");
const writeAs = utils.writeAs;
const read = utils.read;
const copy = utils.copy;
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
    hadAccumulated: *bool,
) !u32 {
    var count: u32 = 0;
    _ = ctx;

    while (it.next()) |node| {
        if (filterBuf.len > 0) {
            // Filter Check
        }

        aggregateNode(node, typeEntry, aggDefs, accumulatorField, hadAccumulated);

        count += 1;
        if (count >= limit) break;
    }
    return count;
}

inline fn aggregateNode(
    node: Node.Node,
    typeEntry: Node.Type,
    aggDefs: []u8,
    accumulatorProp: []u8,
    hadAccumulated: *bool,
) void {
    if (aggDefs.len == 0) return;
    utils.debugPrint("\n\naggDefs: {any}\n", .{aggDefs});

    var i: usize = 0;
    while (i < aggDefs.len) {
        const currentAggDef = utils.readNext(t.AggProp, aggDefs, &i);
        utils.debugPrint("currentAggDef: {any}\n", .{currentAggDef});
        utils.debugPrint("😸 propId: {d}, node {d}\n", .{ currentAggDef.propId, Node.getNodeId(node) });

        var value: []u8 = undefined;
        const propSchema = Schema.getFieldSchema(typeEntry, currentAggDef.propId) catch {
            i += @sizeOf(t.AggProp);
            continue;
        };

        value = Fields.get(
            typeEntry,
            node,
            propSchema,
            currentAggDef.propType,
        );

        if (value.len > 0) {
            i += execAggInternal(aggDefs, accumulatorProp, value, hadAccumulated);
        }
    }
}

inline fn execAggInternal(
    aggDefs: []u8,
    accumulatorProp: []u8,
    value: []u8,
    hadAccumulated: *bool,
) usize {
    var start: usize = 0;
    var i: usize = 0;

    while (i < aggDefs.len) {
        const currentAggDef = utils.readNext(t.AggProp, aggDefs, &i);
        const propType = currentAggDef.propType;
        const aggFunction = currentAggDef.aggFunction;
        const accumulatorPos = currentAggDef.accumulatorPos;

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
            .min => {
                if (!hadAccumulated.*) {
                    writeAs(f64, accumulatorProp, microbufferToF64(propType, value, start), accumulatorPos);
                } else {
                    writeAs(f64, accumulatorProp, @min(read(f64, accumulatorProp, accumulatorPos), microbufferToF64(propType, value, start)), accumulatorPos);
                }
            },
            .max => {
                if (!hadAccumulated.*) {
                    writeAs(f64, accumulatorProp, microbufferToF64(propType, value, start), accumulatorPos);
                } else {
                    writeAs(f64, accumulatorProp, @max(read(f64, accumulatorProp, accumulatorPos), microbufferToF64(propType, value, start)), accumulatorPos);
                }
            },
            .hmean => {
                const val = microbufferToF64(propType, value, start);
                if (val != 0) {
                    var count = read(u64, accumulatorProp, accumulatorPos);
                    var sum = read(f64, accumulatorProp, accumulatorPos + 8);

                    count += 1;
                    sum += 1 / val;

                    writeAs(u64, accumulatorProp, count, accumulatorPos);
                    writeAs(f64, accumulatorProp, sum, accumulatorPos + 8);
                } else {
                    writeAs(u64, accumulatorProp, 0.0, accumulatorPos);
                    writeAs(f64, accumulatorProp, 0.0, accumulatorPos + 8);
                }
            },
            .stddev => {
                const val = microbufferToF64(propType, value, start);
                var count = read(u64, accumulatorProp, accumulatorPos);
                var sum = read(f64, accumulatorProp, accumulatorPos + 8);
                var sum_sq = read(f64, accumulatorProp, accumulatorPos + 16);

                count += 1;
                sum += val;
                sum_sq += val * val;

                writeAs(u64, accumulatorProp, count, accumulatorPos);
                writeAs(f64, accumulatorProp, sum, accumulatorPos + 8);
                writeAs(f64, accumulatorProp, sum_sq, accumulatorPos + 16);
            },
            .variance => {
                const val = microbufferToF64(propType, value, start);
                var count = read(u64, accumulatorProp, accumulatorPos);
                var sum = read(f64, accumulatorProp, accumulatorPos + 8);
                var sum_sq = read(f64, accumulatorProp, accumulatorPos + 16);

                count += 1;
                sum += val;
                sum_sq += val * val;

                writeAs(u64, accumulatorProp, count, accumulatorPos);
                writeAs(f64, accumulatorProp, sum, accumulatorPos + 8);
                writeAs(f64, accumulatorProp, sum_sq, accumulatorPos + 16);
            },
            else => {
                return 0;
            },
        }
        start += utils.propTypeSize(propType);
    }
    return i;
}

pub inline fn finalizeResults(ctx: *Query.QueryCtx, aggDefs: []u8, resultsProp: []u8, accumulatorProp: []u8) !void {
    var i: usize = 0;
    utils.debugPrint("aggDefs: {any}", .{aggDefs});
    while (i < aggDefs.len) {
        const currentAggDef = utils.readNext(t.AggProp, aggDefs, &i);
        const aggFunction = currentAggDef.aggFunction;
        const resultPos = currentAggDef.resultPos;
        const accumulatorPos = currentAggDef.accumulatorPos;

        switch (aggFunction) {
            .sum => {
                try ctx.thread.query.append(read(f64, accumulatorProp, resultPos));
            },
            .max => {
                try ctx.thread.query.append(read(f64, accumulatorProp, resultPos));
            },
            .min => {
                try ctx.thread.query.append(read(f64, accumulatorProp, resultPos));
            },
            .avg => {
                const count = read(u64, accumulatorProp, accumulatorPos);
                const sum = read(f64, accumulatorProp, accumulatorPos + 8);
                const mean = sum / @as(f64, @floatFromInt(count));
                try ctx.thread.query.append(@as(f64, @floatCast(mean)));
            },
            .hmean => {
                const count = read(u64, accumulatorProp, accumulatorPos);
                if (count != 0) {
                    const isum = read(f64, accumulatorProp, accumulatorPos + 8);
                    const mean = @as(f64, @floatFromInt(count)) / isum;
                    try ctx.thread.query.append(@as(f64, @floatCast(mean)));
                } else {
                    try ctx.thread.query.append(@as(f64, @floatCast(0.0)));
                }
            },
            .stddev => {
                const option = 0; // hardcoded
                const count = read(u64, accumulatorProp, accumulatorPos);
                if (count > 1) {
                    const sum = read(f64, accumulatorProp, accumulatorPos + 8);
                    const sum_sq = read(f64, accumulatorProp, accumulatorPos + 16);
                    const mean = sum / @as(f64, @floatFromInt(count));
                    const numerator = sum_sq - (sum * sum) / @as(f64, @floatFromInt(count));
                    const denominator = @as(f64, @floatFromInt(count)) - 1.0;
                    const variance = if (option == 1)
                        (sum_sq / @as(f64, @floatFromInt(count))) - (mean * mean)
                    else
                        numerator / denominator;
                    const stddev = @sqrt(variance);
                    try ctx.thread.query.append(@as(f64, @floatCast(stddev)));
                } else {
                    try ctx.thread.query.append(@as(f64, @floatCast(0.0)));
                }
            },
            .variance => {
                const option = 0; // hardcoded
                const count = read(u64, accumulatorProp, accumulatorPos);
                if (count > 1) {
                    const sum = read(f64, accumulatorProp, accumulatorPos + 8);
                    const sum_sq = read(f64, accumulatorProp, accumulatorPos + 16);
                    const mean = sum / @as(f64, @floatFromInt(count));
                    const numerator = sum_sq - (sum * sum) / @as(f64, @floatFromInt(count));
                    const denominator = @as(f64, @floatFromInt(count)) - 1.0;
                    const variance = if (option == 1)
                        (sum_sq / @as(f64, @floatFromInt(count))) - (mean * mean)
                    else
                        numerator / denominator;
                    try ctx.thread.query.append(@as(f64, @floatCast(variance)));
                } else {
                    try ctx.thread.query.append(@as(f64, @floatCast(0.0)));
                }
            },
            else => {
                writeAs(f64, resultsProp, 0.0, resultPos);
            },
        }
    }
}
