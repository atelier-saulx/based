const std = @import("std");
const db = @import("../db.zig");
const DbCtx = @import("../ctx.zig").DbCtx;
const napi = @import("../../napi.zig");
const c = @import("../../c.zig");
const utils = @import("../../utils.zig");
const singleId = @import("./singleId.zig");
const multi = @import("./multi.zig");
const types = @import("./types.zig");

fn getMarkedIdSubscriptionsInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(1, env, info);
    const ctx = try napi.get(*DbCtx, env, args[0]);
    if (ctx.subscriptions.lastIdMarked > 0) {
        var resultBuffer: ?*anyopaque = undefined;
        var result: c.napi_value = undefined;
        const size = (ctx.subscriptions.lastIdMarked) * 8;
        if (c.napi_create_arraybuffer(env, size, &resultBuffer, &result) != c.napi_ok) {
            return null;
        }
        const data = @as([*]u8, @ptrCast(resultBuffer))[0..size];

        // Reset
        var i: usize = 0;
        while (i < ctx.subscriptions.lastIdMarked) {
            const sub = ctx.subscriptions.singleIdMarked[i];
            const newDataIndex = i * 8;
            utils.writeInt(u32, data, newDataIndex, sub.id);
            utils.writeInt(u32, data, newDataIndex + 4, sub.subId);
            sub.*.marked = types.SubStatus.all;
            i += 1;
        }

        ctx.subscriptions.lastIdMarked = 0;
        return result;
    }
    return null;
}

fn getMarkedMultiSubscriptionsInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(1, env, info);
    const ctx = try napi.get(*DbCtx, env, args[0]);
    var size: usize = 0;
    var iterator = ctx.subscriptions.types.iterator();
    while (iterator.next()) |entry| {
        if (entry.value_ptr.*.typeModified) {
            size += 2;
        }
    }
    if (size == 0) {
        return null;
    }
    var resultBuffer: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;
    if (c.napi_create_arraybuffer(env, size, &resultBuffer, &result) != c.napi_ok) {
        return null;
    }
    iterator = ctx.subscriptions.types.iterator();
    var i: usize = 0;
    const data = @as([*]u8, @ptrCast(resultBuffer))[0..size];
    while (iterator.next()) |entry| {
        if (entry.value_ptr.*.typeModified) {
            entry.value_ptr.*.typeModified = false;
            utils.writeInt(u16, data, i, entry.key_ptr.*);
            i += 2;
        }
    }
    return result;
}

// ---------------------------------
pub fn getMarkedIdSubscriptions(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getMarkedIdSubscriptionsInternal(napi_env, info) catch |err| {
        std.log.err("getMarkedIdSubscriptions {any} \n", .{err});
        return null;
    };
}

pub fn getMarkedMultiSubscriptions(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getMarkedMultiSubscriptionsInternal(napi_env, info) catch |err| {
        std.log.err("getMarkedMultiSubscriptions {any} \n", .{err});
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
