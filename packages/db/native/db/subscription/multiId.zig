const std = @import("std");
const db = @import("../db.zig");
const DbCtx = @import("../ctx.zig").DbCtx;
const napi = @import("../../napi.zig");
const c = @import("../../c.zig");
const utils = @import("../../utils.zig");
const types = @import("./types.zig");
const t = @import("../../types.zig");
const upsertSubType = @import("./shared.zig").upsertSubType;
const removeSubTypeIfEmpty = @import("./shared.zig").removeSubTypeIfEmpty;

pub fn addMultiSubscriptionInternal(napi_env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(2, napi_env, info);
    const ctx = try napi.get(*DbCtx, napi_env, args[0]);
    const value = try napi.get([]u8, napi_env, args[1]);
    const headerLen = 20;
    const subId = utils.read(u64, value, 0);
    const typeId = utils.read(u16, value, 8);

    std.debug.print("addMultiSubscriptionInternal: {any}   \n", .{value});

    // range
    // const rangeType: t.Prop = @enumFromInt(value[10]);

    // if (rangeType == t.Prop.NULL) {
    const id1 = utils.read(u32, value, 11);
    const id2 = utils.read(u32, value, 15);
    const hasFullRange = value[19] == 1;
    // }

    const fields = value[headerLen..value.len];

    var typeSubscriptionCtx = try upsertSubType(ctx, typeId);

    if (!typeSubscriptionCtx.multi.contains(subId)) {
        const multiId = try ctx.allocator.create(types.MultiId);
        multiId.* = .{
            .fields = types.FieldsSimple.init(ctx.allocator),
            .startId = id1,
            .endId = id2,
            .hasFullRange = hasFullRange,
        };
        try typeSubscriptionCtx.multi.put(subId, multiId);
        try typeSubscriptionCtx.nonMarkedMulti.put(subId, multiId);
        for (fields) |f| {
            try multiId.fields.put(f, undefined);
        }
    } else {
        var multiContainer = typeSubscriptionCtx.multi.get(subId).?;
        multiContainer.startId = id1;
        multiContainer.endId = id2;
        multiContainer.hasFullRange = hasFullRange;
    }

    return null;
}

pub fn removeMultiSubscriptionInternal(napi_env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(2, napi_env, info);
    const ctx = try napi.get(*DbCtx, napi_env, args[0]);
    const value = try napi.get([]u8, napi_env, args[1]);

    // const headerLen = 20;
    const subId = utils.read(u64, value, 0);
    const typeId = utils.read(u16, value, 8);
    if (ctx.subscriptions.types.get(typeId)) |typeSubscriptionCtx| {
        std.debug.print("remove multi AMOUNT OF SUBS subId: {any} multi: {any} ids: {any} \n", .{
            subId,
            typeSubscriptionCtx.multi.count(),
            typeSubscriptionCtx.ids.count(),
        });

        if (typeSubscriptionCtx.multi.fetchRemove(subId)) |removedMultiContainer| {
            removedMultiContainer.value.fields.deinit();
            ctx.allocator.destroy(removedMultiContainer.value);
            _ = typeSubscriptionCtx.nonMarkedMulti.remove(subId);
        }

        removeSubTypeIfEmpty(ctx, typeId, typeSubscriptionCtx);
    }
    return null;
}
