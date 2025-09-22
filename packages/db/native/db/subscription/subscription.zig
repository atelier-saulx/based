const std = @import("std");
const db = @import("../db.zig");
const DbCtx = @import("../ctx.zig").DbCtx;
const napi = @import("../../napi.zig");
const c = @import("../../c.zig");
const utils = @import("../../utils.zig");
const singleId = @import("./singleId.zig");
const multiId = @import("./multiId.zig");

fn getMarkedSubscriptionsInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(1, env, info);
    const ctx = try napi.get(*DbCtx, env, args[0]);
    if (ctx.subscriptions.hasMarkedSubscriptions) {
        ctx.subscriptions.hasMarkedSubscriptions = false;
        var keyIter = ctx.subscriptions.subscriptionsIdMarked.keyIterator();
        var resultBuffer: ?*anyopaque = undefined;
        var result: c.napi_value = undefined;
        const size: usize = ctx.subscriptions.subscriptionsIdMarked.count() * 8;
        if (c.napi_create_arraybuffer(env, size, &resultBuffer, &result) != c.napi_ok) {
            return null;
        }
        const data = @as([*]u8, @ptrCast(resultBuffer))[0..size];
        var i: usize = 0;
        while (keyIter.next()) |key| {
            utils.writeInt(u64, data, i, key.*);
            _ = ctx.subscriptions.subscriptionsIdMarked.remove(key.*);
            i += 8;
        }
        return result;
    }
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
    return multiId.addMultiSubscriptionInternal(napi_env, info) catch |err| {
        std.log.err("addMultiSubscription err {any} \n", .{err});
        return null;
    };
}
