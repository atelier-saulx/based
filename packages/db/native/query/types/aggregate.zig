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
const setGroupResults = @import("../aggregate/group.zig").setGroupResults;
const createGroupCtx = @import("../aggregate/group.zig").createGroupCtx;
const c = @import("../../c.zig");

pub fn countType(env: c.napi_env, ctx: *QueryCtx, typeId: db.TypeId) !c.napi_value {
    const typeEntry = try db.getType(ctx.db, typeId);
    const count: u32 = @truncate(selva.selva_node_count(typeEntry));
    var resultBuffer: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;
    if (c.napi_create_arraybuffer(env, ctx.size, &resultBuffer, &result) != c.napi_ok) {
        return null;
    }
    const resultsField = @as([*]u8, @ptrCast(resultBuffer))[0 .. ctx.size + 4];
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
    ctx.size = resultsSize;
    const agg = aggInput[index..aggInput.len];
    var resultBuffer: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;
    if (c.napi_create_arraybuffer(env, ctx.size + 4, &resultBuffer, &result) != c.napi_ok) {
        return null;
    }
    const hasFilter = conditions.len > 0;
    const resultsField = @as([*]u8, @ptrCast(resultBuffer))[0 .. ctx.size + 4];
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
            aggregate(agg, typeEntry, n, resultsField);
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
    const agg = aggInput[index..aggInput.len];
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
            // key needs to be variable
            const key: [2]u8 = if (groupValue.len > 0) groupValue[groupCtx.start + 1 .. groupCtx.start + 1 + groupCtx.len][0..2].* else groupCtx.empty;
            var resultsField: []u8 = undefined;
            if (!groupCtx.hashMap.contains(key)) {
                resultsField = try ctx.allocator.alloc(u8, groupCtx.resultsSize);
                @memset(resultsField, 0);
                try groupCtx.hashMap.put(key, resultsField);
                ctx.size += 2 + groupCtx.resultsSize;
            } else {
                resultsField = groupCtx.hashMap.get(key).?;
            }

            aggregate(agg, typeEntry, n, resultsField);
        } else {
            break :checkItem;
        }
    }
    // Create result for node.js
    var resultBuffer: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;
    if (c.napi_create_arraybuffer(env, ctx.size + 4, &resultBuffer, &result) != c.napi_ok) {
        return null;
    }
    const data = @as([*]u8, @ptrCast(resultBuffer))[0 .. ctx.size + 4];
    try setGroupResults(data, groupCtx);
    return result;
}
