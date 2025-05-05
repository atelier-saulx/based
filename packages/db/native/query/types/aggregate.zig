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

const aggregate = @import("../aggregate/aggregate.zig").aggregate;

const c = @import("../../c.zig");

// add more hashmaps
const SimpleHashMap = std.AutoHashMap([2]u8, []u8);

pub inline fn setGroupResults(
    data: []u8,
    resultsHashMap: SimpleHashMap,
    resultsSize: u16, // should be 1 byte...
) !void {
    var it = resultsHashMap.iterator();
    var i: usize = 0;
    while (it.next()) |entry| {
        copy(data[i .. i + 2], entry.key_ptr);
        i += 2;
        copy(data[i .. i + resultsSize], entry.value_ptr.*);
        i += resultsSize;
    }
    writeInt(u32, data, data.len - 4, selva.crc32c(4, data.ptr, data.len - 4));
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
    const resultsField = @as([*]u8, @ptrCast(resultBuffer))[0 .. ctx.size + 4];
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
    const groupField = aggInput[index];
    index += 1;
    const groupPropType: types.Prop = @enumFromInt(aggInput[index]);
    index += 1;
    const groupStart = read(u16, aggInput, index);
    index += 2;
    const groupLen = read(u16, aggInput, index);
    index += 2;
    const groupType: types.Prop = if (groupField == types.MAIN_PROP) types.Prop.MICRO_BUFFER else groupPropType;
    const groupFieldSchema = try db.getFieldSchema(groupField, typeEntry);
    var resultsHashMap = SimpleHashMap.init(ctx.allocator);
    const resultsSize = read(u16, aggInput, index);
    index += 2;
    const emptyKey = [_]u8{0} ** 2;
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
            const groupValue = db.getField(typeEntry, db.getNodeId(n), n, groupFieldSchema, groupType);

            // key needs to be variable
            const key: [2]u8 = if (groupValue.len > 0) groupValue[groupStart + 1 .. groupStart + 1 + groupLen][0..2].* else emptyKey;
            var resultsField: []u8 = undefined;
            if (!resultsHashMap.contains(key)) {
                resultsField = try ctx.allocator.alloc(u8, resultsSize);
                @memset(resultsField, 0);
                try resultsHashMap.put(key, resultsField);
                ctx.size += 2 + resultsSize;
            } else {
                resultsField = resultsHashMap.get(key).?;
            }

            aggregate(agg, typeEntry, n, resultsField);
        } else {
            // means error
            break :checkItem;
        }
    }

    // Create node result
    var resultBuffer: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;
    if (c.napi_create_arraybuffer(env, ctx.size + 4, &resultBuffer, &result) != c.napi_ok) {
        return null;
    }
    const data = @as([*]u8, @ptrCast(resultBuffer))[0 .. ctx.size + 4];
    try setGroupResults(data, resultsHashMap, resultsSize);
    return result;
}
