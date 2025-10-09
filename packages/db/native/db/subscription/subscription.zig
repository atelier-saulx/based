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
    _ = try napi.get(*DbCtx, env, args[0]);
    // const args = try napi.getArgs(1, env, info);
    // const ctx = try napi.get(*DbCtx, env, args[0]);
    // if (ctx.subscriptions.hasMarkedSubscriptions) {
    //     ctx.subscriptions.hasMarkedSubscriptions = false;
    //     var resultBuffer: ?*anyopaque = undefined;
    //     var result: c.napi_value = undefined;
    //     var iter = ctx.subscriptions.subscriptionsMarked.iterator();
    //     const size: usize = ctx.subscriptions.subscriptionsMarked.count() * 8;
    //     if (c.napi_create_arraybuffer(env, size, &resultBuffer, &result) != c.napi_ok) {
    //         return null;
    //     }
    //     const data = @as([*]u8, @ptrCast(resultBuffer))[0..size];
    //     var i: usize = 0;
    //     while (iter.next()) |entry| {
    //         const u8a: [8]u8 = @bitCast(entry.key_ptr.*);
    //         const u8as = (&u8a)[0..8];
    //         utils.copy(data[i .. i + 8], u8as);
    //         i += 8;
    //     }
    //     iter = ctx.subscriptions.subscriptionsMarked.iterator();
    //     while (iter.next()) |entry| {
    //         _ = ctx.subscriptions.subscriptionsMarked.remove(entry.key_ptr.*);
    //     }
    //     return result;
    // }
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
