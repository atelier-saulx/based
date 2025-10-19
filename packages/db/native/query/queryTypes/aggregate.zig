const db = @import("../../db/db.zig");
const selva = @import("../../selva.zig");
const QueryCtx = @import("../types.zig").QueryCtx;
const types = @import("../../types.zig");
const AggFn = types.AggFn;
const filter = @import("../filter/filter.zig").filter;
const std = @import("std");
const utils = @import("../../utils.zig");
const read = utils.read;
const copy = utils.copy;
const writeInt = utils.writeIntExact;
const groupFunctions = @import("../aggregate/group.zig");
const GroupProtocolLen = groupFunctions.ProtocolLen;
const setGroupResults = groupFunctions.setGroupResults;
const finalizeGroupResults = groupFunctions.finalizeGroupResults;
const finalizeResults = groupFunctions.finalizeResults;
const createGroupCtx = groupFunctions.createGroupCtx;
const aggregate = @import("../aggregate/aggregate.zig").aggregate;

const c = @import("../../c.zig");
const aux = @import("../aggregate/utils.zig");

pub fn countType(env: c.napi_env, ctx: *QueryCtx, typeId: db.TypeId) !c.napi_value {
    const typeEntry = try db.getType(ctx.db, typeId);
    const count: u32 = @truncate(selva.selva_node_count(typeEntry));
    var resultBuffer: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;
    if (c.napi_create_arraybuffer(env, 4, &resultBuffer, &result) != c.napi_ok) {
        return null;
    }
    const resultsField = @as([*]u8, @ptrCast(resultBuffer))[0..4];
    writeInt(u32, resultsField, 0, count);
    return result;
}

pub fn default(env: c.napi_env, ctx: *QueryCtx, limit: u32, typeId: db.TypeId, conditions: []u8, aggInput: []u8) !c.napi_value {
    const typeEntry = try db.getType(ctx.db, typeId);
    var first = true;
    var node = db.getFirstNode(typeEntry);
    var index: usize = 1;
    const resultsSize = read(u16, aggInput, index);
    index += 2;
    const accumulatorSize = read(u16, aggInput, index);
    index += 2;
    const option = aggInput[index];
    index += 1;
    ctx.size = resultsSize + accumulatorSize;
    const agg = aggInput[index..aggInput.len];
    var resultBuffer: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;
    if (c.napi_create_arraybuffer(env, ctx.size + 4, &resultBuffer, &result) != c.napi_ok) {
        return null;
    }
    const hasFilter = conditions.len > 0;
    const resultsField = @as([*]u8, @ptrCast(resultBuffer))[0 .. ctx.size + 4];
    const accumulatorField = try ctx.allocator.alloc(u8, accumulatorSize);
    @memset(accumulatorField, 0);
    var hadAccumulated: bool = false;

    const hllAccumulator = selva.selva_string_create(null, selva.HLL_INIT_SIZE, selva.SELVA_STRING_MUTABLE);
    defer selva.selva_string_free(hllAccumulator);
    var y: u8 = 0;
    checkItem: while (ctx.totalResults < limit) {
        y += 1;
        utils.debugPrint("[default]: node {d}\n", .{y});
        if (first) {
            first = false;
        } else {
            node = db.getNextNode(typeEntry, node.?);
        }
        if (node) |n| {
            if (hasFilter and !filter(ctx.db, n, typeEntry, conditions, null, null, 0, false)) {
                continue :checkItem;
            }
            aggregate(agg, typeEntry, n, accumulatorField, hllAccumulator, &hadAccumulated);
        } else {
            break :checkItem;
        }
    }
    try finalizeResults(resultsField, accumulatorField, agg, option);
    writeInt(u32, resultsField, resultsField.len - 4, selva.crc32c(4, resultsField.ptr, resultsField.len - 4));
    return result;
}

pub fn group(env: c.napi_env, ctx: *QueryCtx, limit: u32, typeId: db.TypeId, conditions: []u8, aggInput: []u8) !c.napi_value {
    const typeEntry = try db.getType(ctx.db, typeId);
    var first = true;
    var node = db.getFirstNode(typeEntry);
    var index: usize = 1;
    const groupCtx = try createGroupCtx(aggInput[index .. index + GroupProtocolLen], typeEntry, ctx);
    index += GroupProtocolLen;
    const agg = aggInput[index..];
    const emptyKey = &[_]u8{};
    const hllAccumulator = selva.selva_string_create(null, selva.HLL_INIT_SIZE, selva.SELVA_STRING_MUTABLE);
    defer selva.selva_string_free(hllAccumulator);

    checkItem: while (ctx.totalResults < limit) {
        if (first) {
            first = false;
        } else {
            node = db.getNextNode(typeEntry, node.?);
        }
        if (node) |n| {
            if (!filter(ctx.db, n, typeEntry, conditions, null, null, 0, false)) {
                continue :checkItem;
            }
            const groupValue = db.getField(typeEntry, db.getNodeId(n), n, groupCtx.fieldSchema, groupCtx.propType);
            const key: []u8 = if (groupValue.len > 0)
                if (groupCtx.propType == types.Prop.STRING)
                    if (groupCtx.field == 0)
                        groupValue.ptr[groupCtx.start + 1 .. groupCtx.start + 1 + groupValue[groupCtx.start]]
                    else
                        groupValue.ptr[2 + groupCtx.start .. groupCtx.start + groupValue.len - groupCtx.propType.crcLen()]
                else if (groupCtx.propType == types.Prop.TIMESTAMP)
                    @constCast(aux.datePart(groupValue.ptr[groupCtx.start .. groupCtx.start + groupCtx.len], @enumFromInt(groupCtx.stepType), groupCtx.timezone))
                else if (groupCtx.propType == types.Prop.REFERENCE)
                    db.getReferenceNodeId(@alignCast(@ptrCast(groupValue.ptr)))
                else
                    groupValue.ptr[groupCtx.start .. groupCtx.start + groupCtx.len]
            else
                emptyKey;

            const hash_map_entry = if (groupCtx.propType == types.Prop.TIMESTAMP and groupCtx.stepRange != 0)
                try groupCtx.hashMap.getOrInsertWithRange(key, groupCtx.accumulatorSize, groupCtx.stepRange)
            else
                try groupCtx.hashMap.getOrInsert(key, groupCtx.accumulatorSize);
            const accumulatorField = hash_map_entry.value;
            var hadAccumulated = !hash_map_entry.is_new;

            const resultKeyLen = if (groupCtx.stepType != @intFromEnum(types.Interval.none)) 4 else key.len;
            if (hash_map_entry.is_new) {
                ctx.size += 2 + resultKeyLen + groupCtx.resultsSize;
                ctx.totalResults += 1;
            }
            aggregate(agg, typeEntry, n, accumulatorField, hllAccumulator, &hadAccumulated);
        } else {
            break :checkItem;
        }
    }
    var resultBuffer: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;
    if (c.napi_create_arraybuffer(env, ctx.size + 4, &resultBuffer, &result) != c.napi_ok) {
        return null;
    }
    const data = @as([*]u8, @ptrCast(resultBuffer))[0 .. ctx.size + 4];
    try finalizeGroupResults(data, groupCtx, agg);
    writeInt(u32, data, data.len - 4, selva.crc32c(4, data.ptr, data.len - 4));
    return result;
}
