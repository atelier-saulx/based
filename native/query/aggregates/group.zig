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
const Aggregates = @import("./aggregates.zig");
const GroupByHashMap = @import("./hashMap.zig").GroupByHashMap;

pub fn iterator(
    groupByHashMap: *GroupByHashMap,
    it: anytype,
    limit: u32,
    filterBuf: []u8,
    aggDefs: []u8,
    accumulatorSize: usize,
    typeEntry: Node.Type,
) !u32 {
    var count: u32 = 0;

    while (it.next()) |node| {
        if (filterBuf.len > 0) {
            // Filter Check
        }

        try aggregatePropsWithGroupBy(groupByHashMap, node, typeEntry, aggDefs, accumulatorSize);

        count += 1;
        if (count >= limit) break;
    }
    return count;
}

inline fn getGrouByKeyValue(keyValue: []u8, currentGroupByKeyDef: t.GroupByKeyProp) []u8 {
    const emptyKey = &[_]u8{};

    if (keyValue.len == 0) return emptyKey;

    const key = if (currentGroupByKeyDef.propType == t.PropType.string)
        if (currentGroupByKeyDef.propId == 0)
            keyValue.ptr[currentGroupByKeyDef.propDefStart + 1 .. currentGroupByKeyDef.propDefStart + 1 + keyValue[currentGroupByKeyDef.propDefStart]]
        else
            keyValue.ptr[2 + currentGroupByKeyDef.propDefStart .. currentGroupByKeyDef.propDefStart + keyValue.len - currentGroupByKeyDef.propType.crcLen()]
    else if (currentGroupByKeyDef.propType == t.PropType.timestamp)
        @constCast(utils.datePart(keyValue.ptr[currentGroupByKeyDef.propDefStart .. currentGroupByKeyDef.propDefStart + keyValue.len], @enumFromInt(currentGroupByKeyDef.stepType), currentGroupByKeyDef.timezone))
    else
        keyValue.ptr[currentGroupByKeyDef.propDefStart .. currentGroupByKeyDef.propDefStart + t.PropType.size(currentGroupByKeyDef.propType)];

    utils.debugPrint("currentGroupByKeyDef: {any}, key: {s}\n", .{ currentGroupByKeyDef, key });
    return key;
}

inline fn aggregatePropsWithGroupBy(
    groupByHashMap: *GroupByHashMap,
    node: Node.Node,
    typeEntry: Node.Type,
    aggDefs: []u8,
    accumulatorSize: usize,
) !void {
    if (aggDefs.len == 0) return;
    utils.debugPrint("\n\naggDefs: {any}\n", .{aggDefs});

    var i: usize = 0;
    const currentKeyPropDef = utils.readNext(t.GroupByKeyProp, aggDefs, &i);
    utils.debugPrint("currentKeyPropDef: {any}\n", .{currentKeyPropDef});
    utils.debugPrint("😸 propId: {d}, node {d}\n", .{ currentKeyPropDef.propId, Node.getNodeId(node) });

    var keyValue: []u8 = undefined;

    // const hllAccumulator = Selva.selva_string_create(null, Selva.HLL_INIT_SIZE, Selva.SELVA_STRING_MUTABLE);
    // defer Selva.selva_string_free(hllAccumulator);

    const propSchema = Schema.getFieldSchema(typeEntry, currentKeyPropDef.propId) catch {
        i += @sizeOf(t.GroupByKeyProp);
        return;
    };

    keyValue = Fields.get(
        typeEntry,
        node,
        propSchema,
        currentKeyPropDef.propType,
    );

    const key = getGrouByKeyValue(keyValue, currentKeyPropDef);
    const hash_map_entry = if (currentKeyPropDef.propType == t.PropType.timestamp and currentKeyPropDef.stepRange != 0)
        try groupByHashMap.getOrInsertWithRange(key, accumulatorSize, currentKeyPropDef.stepRange)
    else
        try groupByHashMap.getOrInsert(key, accumulatorSize);
    const accumulatorProp = hash_map_entry.value;
    var hadAccumulated = !hash_map_entry.is_new;

    Aggregates.aggregateProps(node, typeEntry, aggDefs[i..], accumulatorProp, &hadAccumulated);
}

pub inline fn finalizeGroupResults(
    ctx: *Query.QueryCtx,
    groupByHashMap: *GroupByHashMap,
    aggDefs: []u8,
) !void {
    var it = groupByHashMap.iterator();

    while (it.next()) |entry| {
        const key = entry.key_ptr.*;
        const keyLen: u16 = @intCast(key.len);
        if (key.len > 0) {
            try ctx.thread.query.append(keyLen);
            try ctx.thread.query.append(key);
        }

        const accumulatorProp = entry.value_ptr.*;

        try Aggregates.finalizeResults(ctx, aggDefs, accumulatorProp, true, @bitSizeOf(t.GroupByKeyProp) / 8);
    }
}
