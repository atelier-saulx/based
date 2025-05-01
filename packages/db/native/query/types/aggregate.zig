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
const aggregateTypes = @import("../aggregate/types.zig");

const c = @import("../../c.zig");

pub const AggType = enum(u8) { SUM = 1, _ };

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
            var i: usize = 0;
            while (i < agg.len) {
                const field = agg[i];
                i += 1;
                const fieldAggsSize = read(u16, agg, i);
                if (field != types.MAIN_PROP) {
                    // only main for now
                    continue :checkItem;
                }
                i += 2;
                const aggPropDef = agg[i .. i + fieldAggsSize];

                const fieldSchema = try db.getFieldSchema(field, typeEntry);
                const value = db.getField(typeEntry, db.getNodeId(n), n, fieldSchema, types.Prop.MICRO_BUFFER);
                if (value.len == 0) {
                    continue :checkItem;
                }
                var j: usize = 0;
                while (j < fieldAggsSize) {
                    const aggType: AggType = @enumFromInt(aggPropDef[j]);
                    j += 1;
                    const propType: types.Prop = @enumFromInt(aggPropDef[j]);
                    j += 1;
                    const start = read(u16, aggPropDef, j);
                    j += 2;
                    const resultPos = read(u16, aggPropDef, j);
                    j += 2;

                    if (aggType == AggType.SUM) {
                        // ok put on buffer
                        if (propType == types.Prop.UINT32) {
                            writeInt(u32, resultsField, resultPos, read(u32, resultsField, resultPos) + read(u32, value, start));
                        } else if (propType == types.Prop.UINT8) {
                            // gotto go fast
                            // Adds lots of useless stack allocation we want to increment IN MEMORY
                            writeInt(u32, resultsField, resultPos, read(u32, resultsField, resultPos) + value[start]);
                        } else {
                            // later..
                        }
                    }
                }
                i += fieldAggsSize;
            }
        } else {
            // means error
            break :checkItem;
        }
    }

    writeInt(u32, resultsField, resultsField.len - 4, selva.crc32c(4, resultsField.ptr, resultsField.len - 4));
    return result;
}

const SimpleHashMap = std.AutoHashMap([2]u8, []u8);

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

    // std.debug.print("Group? field: {d} {any} start {d} {d} \n", .{ groupField, groupPropType, groupStart, groupLen });
    // need to have dynamic key size or at least a map for different types
    // e.g if string use string hashmap
    var resultsHashMap = SimpleHashMap.init(ctx.allocator);

    // lets make a specific COUNTRY CODE TYPE
    // make predefiend stuff

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

            // std.debug.print("X key {s} {any} {any} \n", .{ key, resultsField, resultsSize });

            var i: usize = 0;
            while (i < agg.len) {
                const field = agg[i];
                i += 1;
                const fieldAggsSize = read(u16, agg, i);
                if (field != types.MAIN_PROP) {
                    continue :checkItem;
                }
                i += 2;
                const aggPropDef = agg[i .. i + fieldAggsSize];

                const fieldSchema = try db.getFieldSchema(field, typeEntry);
                const value = db.getField(typeEntry, db.getNodeId(n), n, fieldSchema, types.Prop.MICRO_BUFFER);
                if (value.len == 0) {
                    continue :checkItem;
                }
                var j: usize = 0;
                while (j < fieldAggsSize) {
                    const aggType: AggType = @enumFromInt(aggPropDef[j]);
                    j += 1;
                    const propType: types.Prop = @enumFromInt(aggPropDef[j]);
                    j += 1;
                    const start = read(u16, aggPropDef, j);
                    j += 2;
                    const resultPos = read(u16, aggPropDef, j);
                    j += 2;

                    if (aggType == AggType.SUM) {
                        // ok put on buffer
                        if (propType == types.Prop.UINT32) {
                            writeInt(u32, resultsField, resultPos, read(u32, resultsField, resultPos) + read(u32, value, start));
                        } else if (propType == types.Prop.UINT8) {
                            // std.debug.print("Start {any} {any} {d} {d} u8: {d} - {d} \n", .{ aggType, propType, start, resultPos, value[start], read(u32, resultsField, resultPos) });

                            // gotto go fast
                            // Adds lots of useless stack allocation we want to increment IN MEMORY
                            writeInt(u32, resultsField, resultPos, read(u32, resultsField, resultPos) + value[start]);
                        } else {
                            // later..
                        }
                    }
                }
                i += fieldAggsSize;
            }
        } else {
            // means error
            break :checkItem;
        }
    }

    var resultBuffer: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;
    if (c.napi_create_arraybuffer(env, ctx.size + 4, &resultBuffer, &result) != c.napi_ok) {
        return null;
    }
    const data = @as([*]u8, @ptrCast(resultBuffer))[0 .. ctx.size + 4];

    var it = resultsHashMap.iterator();
    var i: usize = 0;
    while (it.next()) |entry| {
        copy(data[i .. i + 2], entry.key_ptr);
        i += 2;
        copy(data[i .. i + resultsSize], entry.value_ptr.*);
        i += resultsSize;
    }

    writeInt(u32, data, data.len - 4, selva.crc32c(4, data.ptr, data.len - 4));
    return result;
}
