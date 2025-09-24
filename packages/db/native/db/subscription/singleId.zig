const std = @import("std");
const db = @import("../db.zig");
const DbCtx = @import("../ctx.zig").DbCtx;
const napi = @import("../../napi.zig");
const c = @import("../../c.zig");
const utils = @import("../../utils.zig");
const types = @import("./types.zig");
const upsertSubType = @import("./shared.zig").upsertSubType;
const removeSubTypeIfEmpty = @import("./shared.zig").removeSubTypeIfEmpty;

pub fn addIdSubscriptionInternal(napi_env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(2, napi_env, info);
    const ctx = try napi.get(*DbCtx, napi_env, args[0]);
    const value = try napi.get([]u8, napi_env, args[1]);
    const headerLen = 14;
    const subId = utils.read(u64, value, 0);
    const typeId = utils.read(u16, value, 8);
    const id = utils.read(u32, value, 10);
    const fields = value[headerLen..value.len];
    var typeSubscriptionCtx = try upsertSubType(ctx, typeId);
    var sub: *types.Subscription = undefined;
    if (!typeSubscriptionCtx.subs.contains(subId)) {
        sub = try ctx.allocator.create(types.Subscription);
        sub.* = .{
            .subType = types.SubType.singleId,
            .ids = types.Ids.init(ctx.allocator),
            .fields = types.Fields.init(ctx.allocator),
            .hasFullRange = false,
            .filters = null,
            .stagedIds = types.Ids.init(ctx.allocator),
        };
        try typeSubscriptionCtx.subs.put(subId, sub);
        try typeSubscriptionCtx.nonMarkedId.put(subId, sub);
        for (fields) |f| {
            try sub.fields.put(f, undefined);
        }
    } else {
        sub = typeSubscriptionCtx.subs.get(subId).?;
    }
    try sub.*.ids.put(id, undefined);
    return null;
}

pub fn removeIdSubscriptionInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(2, env, info);
    const ctx = try napi.get(*DbCtx, env, args[0]);
    const value = try napi.get([]u8, env, args[1]);
    const subId = utils.read(u64, value, 0);
    const typeId = utils.read(u16, value, 8);
    const id = utils.read(u32, value, 10);

    if (ctx.subscriptions.types.get(typeId)) |typeSubscriptionCtx| {
        if (typeSubscriptionCtx.subs.get(subId)) |sub| {
            if (sub.*.ids.remove(id)) {
                if (sub.*.ids.count() == 0) {
                    sub.ids.deinit();
                    sub.stagedIds.?.deinit();
                    sub.fields.deinit();
                    if (typeSubscriptionCtx.subs.remove(subId)) {
                        // std.debug.print("REMOVE SUB {any}!\n", .{subId});
                        _ = typeSubscriptionCtx.nonMarkedId.remove(subId);
                        ctx.allocator.destroy(sub);
                        removeSubTypeIfEmpty(ctx, typeId, typeSubscriptionCtx);
                    }
                }
            }
        }
    }

    return null;
}
