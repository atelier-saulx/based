const std = @import("std");
const db = @import("../db.zig");
const DbCtx = @import("../ctx.zig").DbCtx;
const napi = @import("../../napi.zig");
const utils = @import("../../utils.zig");
const singleId = @import("./singleId.zig");
const multi = @import("./multi.zig");
const Subscription = @import("./common.zig");

const write = utils.write;

fn getMarkedIdSubscriptionsInternal(env: napi.Env, info: napi.Info) !napi.Value {
    const args = try napi.getArgs(1, env, info);
    const ctx = try napi.get(*DbCtx, env, args[0]);
    if (ctx.subscriptions.lastIdMarked > 0) {
        var resultBuffer: ?*anyopaque = undefined;
        var result: napi.Value = undefined;
        const size = (ctx.subscriptions.lastIdMarked) * 8;
        if (napi.c.napi_create_arraybuffer(env, size, &resultBuffer, &result) != napi.Ok) {
            return null;
        }
        const data = @as([*]u8, @ptrCast(resultBuffer))[0..size];

        // Reset
        var i: usize = 0;
        while (i < ctx.subscriptions.lastIdMarked) {
            const sub = ctx.subscriptions.singleIdMarked[i];
            const newDataIndex = i * 8;
            const id = sub.id;
            if (sub.isRemoved) {
                // can make
                try singleId.removeSubscriptionMarked(ctx, sub);
            } else {
                write(u32, data, id, newDataIndex);
                write(u32, data, sub.subId, newDataIndex + 4);
                sub.*.marked = Subscription.SubStatus.all;
            }
            i += 1;
        }

        ctx.subscriptions.lastIdMarked = 0;
        return result;
    }
    return null;
}

fn getMarkedMultiSubscriptionsInternal(env: napi.Env, info: napi.Info) !napi.Value {
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
    var result: napi.Value = undefined;
    if (napi.c.napi_create_arraybuffer(env, size, &resultBuffer, &result) != napi.Ok) {
        return null;
    }
    iterator = ctx.subscriptions.types.iterator();
    var i: usize = 0;
    const data = @as([*]u8, @ptrCast(resultBuffer))[0..size];
    while (iterator.next()) |entry| {
        if (entry.value_ptr.*.typeModified) {
            entry.value_ptr.*.typeModified = false;
            utils.write(u16, data, entry.key_ptr.*, i);
            i += 2;
        }
    }
    return result;
}

// ---------------------------------
pub fn getMarkedIdSubscriptions(napi_env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    return getMarkedIdSubscriptionsInternal(napi_env, info) catch |err| {
        std.log.err("getMarkedIdSubscriptions {any} \n", .{err});
        return null;
    };
}

pub fn getMarkedMultiSubscriptions(napi_env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    return getMarkedMultiSubscriptionsInternal(napi_env, info) catch |err| {
        std.log.err("getMarkedMultiSubscriptions {any} \n", .{err});
        return null;
    };
}

pub fn removeIdSubscription(napi_env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    return singleId.removeIdSubscriptionInternal(napi_env, info) catch |err| {
        std.log.err("removeIdSubscription err {any} \n", .{err});
        return null;
    };
}

pub fn addIdSubscription(napi_env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    return singleId.addIdSubscriptionInternal(napi_env, info) catch |err| {
        std.log.err("addIdSubscription err {any} \n", .{err});
        return null;
    };
}

pub fn addMultiSubscription(napi_env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    return multi.addMultiSubscriptionInternal(napi_env, info) catch |err| {
        std.log.err("addMultiSubscription err {any} \n", .{err});
        return null;
    };
}

pub fn removeMultiSubscription(napi_env: napi.Env, info: napi.Info) callconv(.c) napi.Value {
    return multi.removeMultiSubscriptionInternal(napi_env, info) catch |err| {
        std.log.err("removeMultiSubscription err {any} \n", .{err});
        return null;
    };
}
