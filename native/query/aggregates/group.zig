const Query = @import("../common.zig");
const Node = @import("../../selva/node.zig");
const Selva = @import("../../selva/selva.zig").c;
const Schema = @import("../../selva/schema.zig");
const Fields = @import("../../selva/fields.zig");
const utils = @import("../../utils.zig");
const writeAs = utils.writeAs;
const read = utils.read;
const copy = utils.copy;
const microbufferToF64 = utils.microbufferToF64;
const t = @import("../../types.zig");
const resultHeaderOffset = @import("../../thread/results.zig").resultHeaderOffset;
const Aggregates = @import("aggregates.zig");
const GroupByHashMap = @import("hashMap.zig").GroupByHashMap;
const filter = @import("../filter/filter.zig").filter;

pub fn iterator(
    aggCtx: *Aggregates.AggCtx,
    groupByHashMap: *GroupByHashMap,
    it: anytype,
    comptime hasFilter: bool,
    filterBuf: []u8,
    aggDefs: []u8,
) usize {
    var count: u32 = 0;
    aggCtx.hadAccumulated = false;

    while (it.next()) |node| {
        if (hasFilter) {
            if (!try filter(node, aggCtx.queryCtx, filterBuf)) {
                continue;
            }
        }
        aggregatePropsWithGroupBy(groupByHashMap, node, aggDefs, aggCtx) catch {
            return 0;
        };
        count += 1;
        if (count >= aggCtx.limit) break;
    }
    // utils.debugPrint("count {d}, resultsSize {d}, sumOfDistinctKeyLens {d}\n", .{ count, resultsSize, sumOfDistinctKeyLens.* });
    return count;
}

inline fn getGrouByKeyValue(
    keyValue: []u8,
    currentGroupByKeyDef: t.GroupByKeyProp,
) []u8 {
    const propId = currentGroupByKeyDef.propId;
    const start = currentGroupByKeyDef.propDefStart;
    const propType = currentGroupByKeyDef.propType;
    const stepType = currentGroupByKeyDef.stepType;
    const timezone = currentGroupByKeyDef.timezone;
    const emptyKey = &[_]u8{};

    if (keyValue.len == 0) return emptyKey;

    const key = if (propType == t.PropType.string)
        if (propId == 0)
            keyValue.ptr[start + 1 .. start + 1 + keyValue[start]]
        else
            keyValue.ptr[2 + start .. start + keyValue.len - propType.crcLen()]
    else if (propType == t.PropType.timestamp)
        @constCast(utils.datePart(keyValue.ptr[start .. start + keyValue.len], @enumFromInt(stepType), timezone))
    else if (propType == t.PropType.reference)
        Node.getReferenceNodeId(@ptrCast(@alignCast(keyValue.ptr)))
    else
        keyValue.ptr[start .. start + propType.size()];

    return key;
}

inline fn aggregatePropsWithGroupBy(
    groupByHashMap: *GroupByHashMap,
    node: Node.Node,
    aggDefs: []u8,
    aggCtx: *Aggregates.AggCtx,
) !void {
    if (aggDefs.len == 0) return;
    // utils.debugPrint("\n\naggDefs: {any}\n", .{aggDefs});

    var i: usize = 0;
    const currentKeyPropDef = utils.readNext(t.GroupByKeyProp, aggDefs, &i);
    // utils.debugPrint("currentKeyPropDef: {any}\n", .{currentKeyPropDef});
    // utils.debugPrint("😸 propId: {d}, node {d}\n", .{ currentKeyPropDef.propId, Node.getNodeId(node) });

    var keyValue: []u8 = undefined;

    const propSchema = Schema.getFieldSchema(aggCtx.typeEntry, currentKeyPropDef.propId) catch {
        i += utils.sizeOf(t.GroupByKeyProp);
        return;
    };

    keyValue = Fields.get(
        aggCtx.typeEntry,
        node,
        propSchema,
        currentKeyPropDef.propType,
    );

    const key = getGrouByKeyValue(keyValue, currentKeyPropDef);
    const hash_map_entry = if (currentKeyPropDef.propType == t.PropType.timestamp and currentKeyPropDef.stepRange != 0)
        try groupByHashMap.getOrInsertWithRange(key, aggCtx.accumulatorSize, currentKeyPropDef.stepRange)
    else
        try groupByHashMap.getOrInsert(key, aggCtx.accumulatorSize);

    const accumulatorProp = hash_map_entry.value;
    aggCtx.hadAccumulated = !hash_map_entry.is_new;
    if (hash_map_entry.is_new) {
        aggCtx.totalResultsSize += 2 + key.len + aggCtx.resultsSize;
    }
    // utils.debugPrint("is_new?: {any}, key: {s} {d}, sumOfDistinctKeyLens: {d}\n", .{ hash_map_entry.is_new, key, key.len, sumOfDistinctKeyLens });

    Aggregates.aggregateProps(node, aggDefs[i..], accumulatorProp, aggCtx);
}

pub inline fn finalizeGroupResults(
    aggCtx: *Aggregates.AggCtx,
    groupByHashMap: *GroupByHashMap,
    aggDefs: []u8,
) !void {
    var it = groupByHashMap.iterator();

    while (it.next()) |entry| {
        const key = entry.key_ptr.*;
        const keyLen: u16 = @intCast(key.len);
        if (key.len > 0) {
            try aggCtx.queryCtx.thread.query.append(keyLen);
            try aggCtx.queryCtx.thread.query.append(key);
        }

        const accumulatorProp = entry.value_ptr.*;

        try Aggregates.finalizeResults(aggCtx, aggDefs, accumulatorProp, @bitSizeOf(t.GroupByKeyProp) / 8);
    }
}

pub inline fn finalizeRefsGroupResults(
    aggCtx: *Aggregates.AggCtx,
    groupByHashMap: *GroupByHashMap,
    aggDefs: []u8,
) !void {
    var it = groupByHashMap.iterator();

    while (it.next()) |entry| {
        const key = entry.key_ptr.*;
        const keyLen: u16 = @intCast(key.len);

        if (key.len > 0) {
            try aggCtx.queryCtx.thread.query.append(keyLen);
            try aggCtx.queryCtx.thread.query.append(key);
        }

        const accumulatorProp = entry.value_ptr.*;

        try Aggregates.finalizeResults(aggCtx, aggDefs, accumulatorProp, @bitSizeOf(t.GroupByKeyProp) / 8);
    }
}
