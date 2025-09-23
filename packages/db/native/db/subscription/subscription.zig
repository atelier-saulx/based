const std = @import("std");
const db = @import("../db.zig");
const DbCtx = @import("../ctx.zig").DbCtx;
const napi = @import("../../napi.zig");
const c = @import("../../c.zig");
const utils = @import("../../utils.zig");
const singleId = @import("./singleId.zig");
const multi = @import("./multi.zig");
const types = @import("./types.zig");

fn getMarkedSubscriptionsInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(1, env, info);
    const ctx = try napi.get(*DbCtx, env, args[0]);
    if (ctx.subscriptions.hasMarkedSubscriptions) {
        ctx.subscriptions.hasMarkedSubscriptions = false;
        var resultBuffer: ?*anyopaque = undefined;
        var result: c.napi_value = undefined;
        var iter = ctx.subscriptions.subscriptionsMarked.iterator();
        var size: usize = 0;
        while (iter.next()) |entry| {
            if (ctx.subscriptions.types.get(entry.value_ptr.*)) |t| {
                const sub = t.subs.get(entry.key_ptr.*).?;
                if (sub.*.subType == types.SubType.singleId) {
                    size += sub.*.stagedIds.?.count() * 4 + 13;
                } else if (sub.*.subType == types.SubType.simpleMulti) {
                    size += 9;
                }
            }
        }
        if (c.napi_create_arraybuffer(env, size, &resultBuffer, &result) != c.napi_ok) {
            return null;
        }
        const data = @as([*]u8, @ptrCast(resultBuffer))[0..size];
        var i: usize = 0;

        iter = ctx.subscriptions.subscriptionsMarked.iterator();
        while (iter.next()) |entry| {
            if (ctx.subscriptions.types.get(entry.value_ptr.*)) |t| {
                const sub = t.subs.get(entry.key_ptr.*).?;
                if (sub.*.subType == types.SubType.singleId) {
                    std.debug.print("LETS PUT! \n", .{});
                    data[i] = 255; // isId
                    utils.writeInt(u64, data, i + 1, entry.key_ptr.*);
                    utils.writeInt(u32, data, i + 9, sub.*.stagedIds.?.count());
                    var stagedKeyIter = sub.*.stagedIds.?.keyIterator();
                    i += 13;
                    while (stagedKeyIter.next()) |stagedIdKey| {
                        std.debug.print("LETS PUT? {any} {any} \n", .{ t.activeIdSubs.get(stagedIdKey.*), stagedIdKey.* });
                        if (t.activeIdSubs.getEntry(stagedIdKey.*)) |cnt| {
                            cnt.value_ptr.* = cnt.value_ptr.* + 1;
                        }

                        utils.writeInt(u32, data, i, stagedIdKey.*);
                        _ = sub.*.stagedIds.?.remove(stagedIdKey.*);
                        i += 4;
                    }
                    try t.nonMarkedId.put(entry.key_ptr.*, t.subs.get(entry.key_ptr.*).?);
                } else if (sub.*.subType == types.SubType.simpleMulti) {
                    data[i] = 1; // isMultiId
                    utils.writeInt(u64, data, i + 1, entry.key_ptr.*);
                    try t.nonMarkedMulti.put(entry.key_ptr.*, t.subs.get(entry.key_ptr.*).?);
                    i += 9;
                }
            }
            _ = ctx.subscriptions.subscriptionsMarked.remove(entry.key_ptr.*);
        }

        return result;
    }
    // subscriptionsMultiMarked
    return null;
}

// ---------------------------------
pub fn getMarkedSubscriptions(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getMarkedSubscriptionsInternal(napi_env, info) catch |err| {
        std.log.err("getMarkedSubscriptions {any} \n", .{err});
        return null;
    };
}

pub fn removeIdSubscription(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return singleId.removeIdSubscriptionInternal(napi_env, info) catch |err| {
        std.log.err("removeIdSubscription err {any} \n", .{err});
        return null;
    };
}

pub fn addIdSubscription(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return singleId.addIdSubscriptionInternal(napi_env, info) catch |err| {
        std.log.err("addIdSubscription err {any} \n", .{err});
        return null;
    };
}

pub fn addMultiSubscription(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return multi.addMultiSubscriptionInternal(napi_env, info) catch |err| {
        std.log.err("addMultiSubscription err {any} \n", .{err});
        return null;
    };
}

pub fn removeMultiSubscription(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return multi.removeMultiSubscriptionInternal(napi_env, info) catch |err| {
        std.log.err("removeMultiSubscription err {any} \n", .{err});
        return null;
    };
}
