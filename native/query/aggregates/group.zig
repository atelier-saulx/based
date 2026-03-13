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
const References = @import("../../selva/references.zig");

pub fn iterator(
    aggCtx: *Aggregates.AggCtx,
    groupByHashMap: *GroupByHashMap,
    it: anytype,
    hasFilter: bool,
    filterBuf: []u8,
    aggDefs: []u8,
) usize {
    var count: u32 = 0;
    aggCtx.hadAccumulated = false;

    var tmpKeyBuf: [1024]u8 = undefined;
    var tmpKeyLen: usize = 0;

    if (@hasDecl(@TypeOf(it.*), "nextRef")) {
        while (it.nextRef()) |ref| {
            if (hasFilter) {
                if (!try filter(.noEdge, ref.node, aggCtx.queryCtx, filterBuf)) {
                    continue;
                }
            }
            aggregatePropsWithGroupBy(groupByHashMap, ref.node, ref.edge, aggDefs, aggCtx, &tmpKeyBuf, &tmpKeyLen) catch {
                return 0;
            };
            count += 1;
            if (count >= aggCtx.limit) break;
        }
    } else {
        while (it.next()) |node| {
            if (hasFilter) {
                if (!try filter(.noEdge, node, aggCtx.queryCtx, filterBuf)) {
                    continue;
                }
            }
            aggregatePropsWithGroupBy(groupByHashMap, node, null, aggDefs, aggCtx, &tmpKeyBuf, &tmpKeyLen) catch {
                return 0;
            };
            count += 1;
            if (count >= aggCtx.limit) break;
        }
    }

    return count;
}

pub fn iteratorEdge(
    aggCtx: *Aggregates.AggCtx,
    groupByHashMap: *GroupByHashMap,
    it: anytype,
    hasFilter: bool,
    filterBuf: []u8,
    aggDefs: []u8,
    edgePropId: u8,
) !usize {
    var count: u32 = 0;
    aggCtx.hadAccumulated = false;

    var tmpKeyBuf: [1024]u8 = undefined;
    var tmpKeyLen: usize = 0;

    if (@hasDecl(@TypeOf(it.*), "nextRef")) {
        while (it.nextRef()) |ref| {
            if (hasFilter) {
                if (!try filter(ref.node, aggCtx.queryCtx, filterBuf)) {
                    continue;
                }
            }
            aggregatePropsWithGroupBy(groupByHashMap, ref.node, ref.edge, aggDefs, aggCtx, &tmpKeyBuf, &tmpKeyLen) catch {
                return 0;
            };
            count += 1;
            if (count >= aggCtx.limit) break;
        }
    } else {
        while (it.next()) |node| {
            if (hasFilter) {
                if (!try filter(.noEdge, node, aggCtx.queryCtx, filterBuf)) {
                    continue;
                }
            }
            var refsIt = try References.iterator(.asc, .edge, aggCtx.queryCtx.db, node, edgePropId, aggCtx.typeEntry);
            while (refsIt.nextRef()) |ref| {
                aggregatePropsWithGroupBy(groupByHashMap, node, ref.edge, aggDefs, aggCtx, &tmpKeyBuf, &tmpKeyLen) catch {
                    return 0;
                };
            }
            count += 1;
            if (count >= aggCtx.limit) break;
        }
    }

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

    const key = switch (propType) {
        .string => if (propId == 0) keyValue.ptr[start + 1 .. start + 1 + keyValue[start]] else keyValue.ptr[2 + start .. start + keyValue.len - propType.crcLen()],
        .stringFixed => if (propId == 0) keyValue.ptr[start + 1 .. start + 1 + keyValue[start]] else keyValue.ptr[2 + start .. start + keyValue.len - propType.crcLen()],
        .timestamp => @constCast(utils.datePart(keyValue.ptr[start .. start + propType.size()], @enumFromInt(stepType), timezone)),
        .reference => Node.getReferenceNodeId(@ptrCast(@alignCast(keyValue.ptr))),
        else => keyValue.ptr[start .. start + propType.size()],
    };

    return key;
}

inline fn aggregatePropsWithGroupBy(
    groupByHashMap: *GroupByHashMap,
    node: Node.Node,
    edgeNode: ?Node.Node,
    aggDefs: []u8,
    aggCtx: *Aggregates.AggCtx,
    tmpKeyBuf: []u8,
    tmpKeyLen: *usize,
) !void {
    if (aggDefs.len == 0) return;

    var i: usize = 0;
    tmpKeyLen.* = 0;
    var firstKeyType = t.PropType.null;
    var firstStepRange: u32 = 0;
    var isSingleKey = true;

    while (true) { // MV: manymany
        const currentKeyPropDef = utils.readNext(t.GroupByKeyProp, aggDefs, &i);

        var keyNode = node;
        var keyTypeEntry = aggCtx.typeEntry;
        if (currentKeyPropDef.isEdge) {
            if (edgeNode) |en| {
                keyNode = en;
                if (aggCtx.edgeTypeEntry) |ete| {
                    keyTypeEntry = ete;
                }
            } else {
                return;
            }
        }
        const propSchema = Schema.getFieldSchema(keyTypeEntry, currentKeyPropDef.propId) catch {
            return;
        };

        const keyValue = Fields.get(
            keyTypeEntry,
            keyNode,
            propSchema,
            currentKeyPropDef.propType,
        );

        const keyPart = getGrouByKeyValue(keyValue, currentKeyPropDef);

        if (firstKeyType == t.PropType.null) {
            isSingleKey = !currentKeyPropDef.hasNext;
            firstKeyType = currentKeyPropDef.propType;
            firstStepRange = currentKeyPropDef.stepRange;
        }

        if (!isSingleKey) {
            var lenBuf: [2]u8 = undefined;
            utils.write(&lenBuf, @as(u16, @intCast(keyPart.len)), 0);

            @memcpy(tmpKeyBuf[tmpKeyLen.* .. tmpKeyLen.* + lenBuf.len], &lenBuf);
            tmpKeyLen.* += lenBuf.len;
        }

        if (keyPart.len > 0) {
            @memcpy(tmpKeyBuf[tmpKeyLen.* .. tmpKeyLen.* + keyPart.len], keyPart);
            tmpKeyLen.* += keyPart.len;
        }

        if (!currentKeyPropDef.hasNext) break;
    }

    const key = tmpKeyBuf[0..tmpKeyLen.*];
    const hash_map_entry = if (firstKeyType == t.PropType.timestamp and firstStepRange != 0 and isSingleKey)
        try groupByHashMap.getOrInsertWithRange(key, aggCtx.accumulatorSize, firstStepRange)
    else
        try groupByHashMap.getOrInsert(key, aggCtx.accumulatorSize);

    const accumulatorProp = hash_map_entry.value;
    aggCtx.hadAccumulated = !hash_map_entry.is_new;
    if (hash_map_entry.is_new) {
        aggCtx.totalResultsSize += 2 + key.len + aggCtx.resultsSize;
    }

    Aggregates.aggregateProps(node, edgeNode, aggDefs[i..], accumulatorProp, aggCtx);
}

pub inline fn finalizeGroupResults(
    aggCtx: *Aggregates.AggCtx,
    groupByHashMap: *GroupByHashMap,
    aggDefs: []u8,
) !void {
    var initialAggDefOffset: usize = 0;
    while (initialAggDefOffset < aggDefs.len) {
        const cur = utils.readNext(t.GroupByKeyProp, aggDefs, &initialAggDefOffset);
        if (!cur.hasNext) break;
    }

    var it = groupByHashMap.iterator();

    while (it.next()) |entry| {
        const key = entry.key_ptr.*;
        const keyLen: u16 = @intCast(key.len);
        try aggCtx.queryCtx.thread.query.append(keyLen);
        if (key.len > 0) {
            try aggCtx.queryCtx.thread.query.append(key);
        }

        const accumulatorProp = entry.value_ptr.*;

        try Aggregates.finalizeResults(aggCtx, aggDefs, accumulatorProp, initialAggDefOffset);
    }
}

pub inline fn finalizeRefsGroupResults(
    aggCtx: *Aggregates.AggCtx,
    groupByHashMap: *GroupByHashMap,
    aggDefs: []u8,
) !void {
    var initialAggDefOffset: usize = 0;
    while (initialAggDefOffset < aggDefs.len) {
        const cur = utils.readNext(t.GroupByKeyProp, aggDefs, &initialAggDefOffset);
        if (!cur.hasNext) break;
    }

    var it = groupByHashMap.iterator();

    while (it.next()) |entry| {
        const key = entry.key_ptr.*;
        const keyLen: u16 = @intCast(key.len);

        if (key.len > 0) {
            try aggCtx.queryCtx.thread.query.append(keyLen);
            try aggCtx.queryCtx.thread.query.append(key);
        }

        const accumulatorProp = entry.value_ptr.*;

        try Aggregates.finalizeResults(aggCtx, aggDefs, accumulatorProp, initialAggDefOffset);
    }
}
