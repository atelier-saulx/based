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
const GroupProtocolLen = @import("../aggregate/group.zig").ProtocolLen;
const aggregate = @import("../aggregate/aggregate.zig").aggregate;
const finalizeGroupResults = @import("../aggregate/group.zig").finalizeGroupResults;
const createGroupCtx = @import("../aggregate/group.zig").createGroupCtx;
const c = @import("../../c.zig");

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
    ctx.size = resultsSize + accumulatorSize;
    const agg = aggInput[index..aggInput.len];
    var resultBuffer: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;
    if (c.napi_create_arraybuffer(env, ctx.size + 4, &resultBuffer, &result) != c.napi_ok) {
        return null;
    }
    const hasFilter = conditions.len > 0;
    const resultsField = @as([*]u8, @ptrCast(resultBuffer))[0 .. ctx.size + 4];
    var hadAccumulated: bool = false;

    const hllAccumulator = selva.selva_string_create(null, selva.HLL_INIT_SIZE, selva.SELVA_STRING_MUTABLE);
    defer selva.selva_free(hllAccumulator);

    checkItem: while (ctx.totalResults < limit) {
        if (first) {
            first = false;
        } else {
            node = db.getNextNode(typeEntry, node.?);
        }
        if (node) |n| {
            if (hasFilter and !filter(ctx.db, n, typeEntry, conditions, null, null, 0, false)) {
                continue :checkItem;
            }
            aggregate(agg, typeEntry, n, resultsField, hllAccumulator, &hadAccumulated);
            // writeInt(u32, resultsField, 0, read(u32, selva.hll_count(hllAccumulator)[0..4], 0));
        } else {
            break :checkItem;
        }
    }
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
    checkItem: while (ctx.totalResults < limit) {
        const hllAccumulator = selva.selva_string_create(null, selva.HLL_INIT_SIZE, selva.SELVA_STRING_MUTABLE);
        defer selva.selva_free(hllAccumulator);

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
                    groupValue.ptr[2 + groupCtx.start .. groupCtx.start + groupValue.len - groupCtx.propType.crcLen()]
                else
                    groupValue.ptr[groupCtx.start .. groupCtx.start + groupCtx.len]
            else
                emptyKey;
            const hash_map_entry = try groupCtx.hashMap.getOrInsert(key, groupCtx.accumulatorSize);
            const accumulatorField = hash_map_entry.value;
            var hadAccumulated = !hash_map_entry.is_new;

            if (hash_map_entry.is_new) {
                ctx.size += 2 + key.len + groupCtx.resultsSize;
            }
            aggregate(agg, typeEntry, n, accumulatorField, hllAccumulator, &hadAccumulated);
            // writeInt(u32, accumulatorField, 0, read(u32, selva.hll_count(hllAccumulator)[0..4], 0));
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
