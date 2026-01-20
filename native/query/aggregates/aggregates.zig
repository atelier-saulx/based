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
const resultHeaderOffset = @import("../../thread/results.zig").resultHeaderOffset;
const filter = @import("../filter/filter.zig").filter;

pub fn iterator(
    ctx: *Query.QueryCtx,
    it: anytype,
    limit: u32,
    filterBuf: []u8,
    aggDefs: []u8,
    accumulatorProp: []u8,
    typeEntry: Node.Type,
    hadAccumulated: *bool,
) !u32 {
    var count: u32 = 0;
    _ = ctx;

    while (it.next()) |node| {
        if (filterBuf.len > 0) {
            // Filter Check
            // utils.debugPrint("filterBuf: {any}\n", .{filterBuf});
            // if (!try filter(node, ctx, q, typeEntry)) {
            //     continue :nodeLoop;
            // }
        }

        aggregateProps(node, typeEntry, aggDefs, accumulatorProp, hadAccumulated);

        count += 1;
        if (count >= limit) break;
    }
    return count;
}

pub inline fn aggregateProps(
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
        if (currentAggDef.aggFunction == t.AggFunction.count) {
            accumulate(currentAggDef, accumulatorProp, value, hadAccumulated);
            hadAccumulated.* = true;
        } else {
            if (currentAggDef.propId != t.MAIN_PROP) {
                i += @sizeOf(t.AggProp);
                continue;
            }
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
                accumulate(currentAggDef, accumulatorProp, value, hadAccumulated);
            }
        }
    }
}

pub inline fn accumulate(
    currentAggDef: t.AggProp,
    accumulatorProp: []u8,
    value: []u8,
    hadAccumulated: *bool,
) void {
    const propType = currentAggDef.propType;
    const aggFunction = currentAggDef.aggFunction;
    const accumulatorPos = currentAggDef.accumulatorPos;
    const start = currentAggDef.propDefStart;

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
        .count => {
            writeAs(u32, accumulatorProp, read(u32, accumulatorProp, accumulatorPos) + 1, accumulatorPos);
        },
        else => {},
    }
}

pub inline fn finalizeResults(
    ctx: *Query.QueryCtx,
    aggDefs: []u8,
    accumulatorProp: []u8,
    isSamplingSet: bool,
    initialAggDefOffset: usize,
) !void {
    var i: usize = initialAggDefOffset;
    const initialResultOffset = ctx.thread.query.index;
    while (i < aggDefs.len) {
        const currentAggDef = utils.readNext(t.AggProp, aggDefs, &i);
        const aggFunction = currentAggDef.aggFunction;
        const resultPos = currentAggDef.resultPos + initialResultOffset;
        const accumulatorPos = currentAggDef.accumulatorPos;

        switch (aggFunction) {
            .sum => {
                ctx.thread.query.reserveAndWrite(read(f64, accumulatorProp, accumulatorPos), resultPos);
            },
            .max => {
                ctx.thread.query.reserveAndWrite(read(f64, accumulatorProp, accumulatorPos), resultPos);
            },
            .min => {
                ctx.thread.query.reserveAndWrite(read(f64, accumulatorProp, accumulatorPos), resultPos);
            },
            .avg => {
                const count = read(u64, accumulatorProp, accumulatorPos);
                const sum = read(f64, accumulatorProp, accumulatorPos + 8);
                const mean = sum / @as(f64, @floatFromInt(count));
                ctx.thread.query.reserveAndWrite(@as(f64, @floatCast(mean)), resultPos);
            },
            .hmean => {
                const count = read(u64, accumulatorProp, accumulatorPos);
                if (count != 0) {
                    const isum = read(f64, accumulatorProp, accumulatorPos + 8);
                    const mean = @as(f64, @floatFromInt(count)) / isum;
                    ctx.thread.query.reserveAndWrite(@as(f64, @floatCast(mean)), resultPos);
                } else {
                    ctx.thread.query.reserveAndWrite(@as(f64, @floatCast(0.0)), resultPos);
                }
            },
            .stddev => {
                const count = read(u64, accumulatorProp, accumulatorPos);
                if (count > 1) {
                    const sum = read(f64, accumulatorProp, accumulatorPos + 8);
                    const sum_sq = read(f64, accumulatorProp, accumulatorPos + 16);
                    const mean = sum / @as(f64, @floatFromInt(count));
                    const numerator = sum_sq - (sum * sum) / @as(f64, @floatFromInt(count));
                    const denominator = @as(f64, @floatFromInt(count)) - 1.0;
                    const variance = if (isSamplingSet)
                        (sum_sq / @as(f64, @floatFromInt(count))) - (mean * mean)
                    else
                        numerator / denominator;
                    const stddev = @sqrt(variance);
                    ctx.thread.query.reserveAndWrite(@as(f64, @floatCast(stddev)), resultPos);
                } else {
                    ctx.thread.query.reserveAndWrite(@as(f64, @floatCast(0.0)), resultPos);
                }
            },
            .variance => {
                const count = read(u64, accumulatorProp, accumulatorPos);
                if (count > 1) {
                    const sum = read(f64, accumulatorProp, accumulatorPos + 8);
                    const sum_sq = read(f64, accumulatorProp, accumulatorPos + 16);
                    const mean = sum / @as(f64, @floatFromInt(count));
                    const numerator = sum_sq - (sum * sum) / @as(f64, @floatFromInt(count));
                    const denominator = @as(f64, @floatFromInt(count)) - 1.0;
                    const variance = if (isSamplingSet)
                        (sum_sq / @as(f64, @floatFromInt(count))) - (mean * mean)
                    else
                        numerator / denominator;
                    ctx.thread.query.reserveAndWrite(@as(f64, @floatCast(variance)), resultPos);
                } else {
                    ctx.thread.query.reserveAndWrite(@as(f64, @floatCast(0.0)), resultPos);
                }
            },
            .count => {
                const count = read(u32, accumulatorProp, accumulatorPos);
                ctx.thread.query.reserveAndWrite(count, resultPos);
            },
            else => {
                ctx.thread.query.reserveAndWrite(0.0, resultPos);
            },
        }
    }
}
