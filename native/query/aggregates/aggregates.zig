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

pub const AggCtx = struct {
    queryCtx: *Query.QueryCtx,
    typeEntry: Node.Type,
    limit: u32 = 0,
    isSamplingSet: bool = false,
    hllAccumulator: ?*Selva.c.struct_selva_string = null,
    accumulatorSize: usize = 0,
    resultsSize: usize = 0,
    hadAccumulated: bool = false,
    totalResultsSize: usize = 0,
};

pub fn iterator(
    aggCtx: *AggCtx,
    it: anytype,
    comptime hasFilter: bool,
    filterBuf: []u8,
    aggDefs: []u8,
    accumulatorProp: []u8,
) !u32 {
    var count: u32 = 0;
    aggCtx.hadAccumulated = false;

    while (it.next()) |node| {
        if (hasFilter) {
            if (!try filter(node, aggCtx.queryCtx, filterBuf)) {
                continue;
            }
        }
        aggregateProps(node, aggDefs, accumulatorProp, aggCtx);
        count += 1;
        if (count >= aggCtx.limit) break;
    }
    return count;
}

pub inline fn aggregateProps(
    node: Node.Node,
    aggDefs: []u8,
    accumulatorProp: []u8,
    aggCtx: *AggCtx,
) void {
    if (aggDefs.len == 0) return;

    var i: usize = 0;
    while (i < aggDefs.len) {
        const currentAggDef = utils.readNext(t.AggProp, aggDefs, &i);
        // utils.debugPrint("currentAggDef: {any}\n", .{currentAggDef});
        // utils.debugPrint("😸 propId: {d}, node {d}\n", .{ currentAggDef.propId, Node.getNodeId(node) });
        var value: []u8 = undefined;
        if (currentAggDef.aggFunction == t.AggFunction.count) {
            accumulate(currentAggDef, accumulatorProp, value, aggCtx, null);
        } else {
            if (currentAggDef.propId != t.MAIN_PROP and currentAggDef.aggFunction != t.AggFunction.cardinality) {
                i += utils.sizeOf(t.AggProp);
                continue;
            }
            const propSchema = Schema.getFieldSchema(aggCtx.typeEntry, currentAggDef.propId) catch {
                i += utils.sizeOf(t.AggProp);
                continue;
            };
            if (currentAggDef.aggFunction == t.AggFunction.cardinality) {
                const hllValue = Selva.c.selva_fields_get_selva_string(node, propSchema) orelse null;
                if (hllValue == null) {
                    i += utils.sizeOf(t.AggProp);
                    continue;
                }
                if (!aggCtx.hadAccumulated) {
                    _ = Selva.c.selva_string_replace(aggCtx.hllAccumulator, null, Selva.c.HLL_INIT_SIZE);
                    Selva.c.hll_init_like(aggCtx.hllAccumulator, hllValue);
                }
                accumulate(currentAggDef, accumulatorProp, value, aggCtx, hllValue);
            } else {
                value = Fields.get(
                    aggCtx.typeEntry,
                    node,
                    propSchema,
                    currentAggDef.propType,
                );

                if (value.len > 0) {
                    accumulate(currentAggDef, accumulatorProp, value, aggCtx, null);
                }
            }
        }
    }
    aggCtx.hadAccumulated = true;
}

pub inline fn accumulate(
    currentAggDef: t.AggProp,
    accumulatorProp: []u8,
    value: []u8,
    aggCtx: *AggCtx,
    hllValue: anytype,
) void {
    const propType = currentAggDef.propType;
    const aggFunction = currentAggDef.aggFunction;
    const accumulatorPos = currentAggDef.accumulatorPos;
    const start = currentAggDef.propDefStart;

    switch (propType) {
        else => |propTypeTag| {
            switch (aggFunction) {
                .sum => {
                    writeAs(f64, accumulatorProp, read(f64, accumulatorProp, accumulatorPos) + microbufferToF64(propTypeTag, value, start), accumulatorPos);
                    // utils.debugPrint("❤️ v: {d}\n", .{read(f64, accumulatorProp, accumulatorPos)});
                },
                .avg => {
                    const val = microbufferToF64(propTypeTag, value, start);
                    var count = read(u64, accumulatorProp, accumulatorPos);
                    var sum = read(f64, accumulatorProp, accumulatorPos + 8);

                    count += 1;
                    sum += val;

                    writeAs(u64, accumulatorProp, count, accumulatorPos);
                    writeAs(f64, accumulatorProp, sum, accumulatorPos + 8);
                },
                .min => {
                    if (!aggCtx.hadAccumulated) {
                        writeAs(f64, accumulatorProp, microbufferToF64(propTypeTag, value, start), accumulatorPos);
                    } else {
                        writeAs(f64, accumulatorProp, @min(read(f64, accumulatorProp, accumulatorPos), microbufferToF64(propTypeTag, value, start)), accumulatorPos);
                    }
                },
                .max => {
                    if (!aggCtx.hadAccumulated) {
                        writeAs(f64, accumulatorProp, microbufferToF64(propTypeTag, value, start), accumulatorPos);
                    } else {
                        writeAs(f64, accumulatorProp, @max(read(f64, accumulatorProp, accumulatorPos), microbufferToF64(propTypeTag, value, start)), accumulatorPos);
                    }
                },
                .hmean => {
                    const val = microbufferToF64(propTypeTag, value, start);
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
                    const val = microbufferToF64(propTypeTag, value, start);
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
                    const val = microbufferToF64(propTypeTag, value, start);
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
                .cardinality => {
                    Selva.c.hll_union(aggCtx.hllAccumulator, hllValue);
                    writeAs(u32, accumulatorProp, read(u32, Selva.c.hll_count(aggCtx.hllAccumulator)[0..4], 0), accumulatorPos);
                },
                else => {},
            }
        },
    }
}

pub inline fn finalizeResults(
    aggCtx: *AggCtx,
    aggDefs: []u8,
    accumulatorProp: []u8,
    initialAggDefOffset: usize,
) !void {
    var i: usize = initialAggDefOffset;

    const initialResultOffset = aggCtx.queryCtx.thread.query.index;
    while (i < aggDefs.len) {
        const currentAggDef = utils.readNext(t.AggProp, aggDefs, &i);
        const aggFunction = currentAggDef.aggFunction;
        const resultPos = currentAggDef.resultPos + initialResultOffset;
        const accumulatorPos = currentAggDef.accumulatorPos;

        switch (aggFunction) {
            .sum => {
                aggCtx.queryCtx.thread.query.reserveAndWrite(read(f64, accumulatorProp, accumulatorPos), resultPos);
            },
            .max => {
                aggCtx.queryCtx.thread.query.reserveAndWrite(read(f64, accumulatorProp, accumulatorPos), resultPos);
            },
            .min => {
                aggCtx.queryCtx.thread.query.reserveAndWrite(read(f64, accumulatorProp, accumulatorPos), resultPos);
            },
            .avg => {
                const count = read(u64, accumulatorProp, accumulatorPos);
                const sum = read(f64, accumulatorProp, accumulatorPos + 8);
                const mean = sum / @as(f64, @floatFromInt(count));
                aggCtx.queryCtx.thread.query.reserveAndWrite(@as(f64, @floatCast(mean)), resultPos);
            },
            .hmean => {
                const count = read(u64, accumulatorProp, accumulatorPos);
                if (count != 0) {
                    const isum = read(f64, accumulatorProp, accumulatorPos + 8);
                    const mean = @as(f64, @floatFromInt(count)) / isum;
                    aggCtx.queryCtx.thread.query.reserveAndWrite(@as(f64, @floatCast(mean)), resultPos);
                } else {
                    aggCtx.queryCtx.thread.query.reserveAndWrite(@as(f64, @floatCast(0.0)), resultPos);
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
                    const variance = if (aggCtx.isSamplingSet)
                        numerator / denominator
                    else
                        (sum_sq / @as(f64, @floatFromInt(count))) - (mean * mean);
                    const stddev = if (variance < 0) 0 else @sqrt(variance);
                    aggCtx.queryCtx.thread.query.reserveAndWrite(@as(f64, @floatCast(stddev)), resultPos);
                } else {
                    aggCtx.queryCtx.thread.query.reserveAndWrite(@as(f64, @floatCast(0.0)), resultPos);
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
                    var variance = if (aggCtx.isSamplingSet)
                        numerator / denominator
                    else
                        (sum_sq / @as(f64, @floatFromInt(count))) - (mean * mean);
                    if (variance < 0) variance = 0;
                    aggCtx.queryCtx.thread.query.reserveAndWrite(@as(f64, @floatCast(variance)), resultPos);
                } else {
                    aggCtx.queryCtx.thread.query.reserveAndWrite(@as(f64, @floatCast(0.0)), resultPos);
                }
            },
            .count => {
                const count = read(u32, accumulatorProp, accumulatorPos);
                aggCtx.queryCtx.thread.query.reserveAndWrite(count, resultPos);
            },
            .cardinality => {
                aggCtx.queryCtx.thread.query.reserveAndWrite(read(u32, accumulatorProp, accumulatorPos), resultPos);
            },
            else => {
                aggCtx.queryCtx.thread.query.reserveAndWrite(0.0, resultPos);
            },
        }
    }
}
