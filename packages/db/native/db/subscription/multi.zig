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

pub fn addMultiSubscriptionInternal(_: c.napi_env, _: c.napi_callback_info) !c.napi_value {
    // const args = try napi.getArgs(2, napi_env, info);
    // const ctx = try napi.get(*DbCtx, napi_env, args[0]);
    // const value = try napi.get([]u8, napi_env, args[1]);
    // const headerLen = 22;
    // const subId = utils.read(u64, value, 0);
    // const typeId = utils.read(u16, value, 8);

    // // if (rangeType == t.Prop.NULL) {
    // // const id1 = utils.read(u32, value, 11);
    // // const id2 = utils.read(u32, value, 15);
    // const hasFullRange = value[19] == 1;

    // const filterLen = utils.read(u16, value, 20);

    // std.debug.print("addMultiSubscriptionInternal: {any}  filterLen {any} \n", .{ value, filterLen });

    // const fields = value[headerLen + filterLen .. value.len];

    // var typeSubscriptionCtx = try upsertSubType(ctx, typeId);
    // var sub: *types.Subscription = undefined;

    // if (!typeSubscriptionCtx.subs.contains(subId)) {
    //     sub = try ctx.allocator.create(types.Subscription);
    //     sub.* = .{
    //         .subType = types.SubType.simpleMulti,
    //         .ids = types.Ids.init(ctx.allocator),
    //         .fields = types.Fields.init(ctx.allocator),
    //         .hasFullRange = hasFullRange,
    //         .filters = null,
    //         .stagedIds = null,
    //         .id = subId,
    //     };
    //     try typeSubscriptionCtx.subs.put(subId, sub);
    //     try typeSubscriptionCtx.nonMarkedMulti.put(subId, sub);
    //     for (fields) |f| {
    //         try sub.fields.put(f, undefined);
    //     }
    // } else {
    //     sub = typeSubscriptionCtx.subs.get(subId).?;
    //     sub.*.hasFullRange = hasFullRange;
    // }

    return null;
}

pub fn removeMultiSubscriptionInternal(_: c.napi_env, _: c.napi_callback_info) !c.napi_value {
    // const args = try napi.getArgs(2, napi_env, info);
    // const ctx = try napi.get(*DbCtx, napi_env, args[0]);
    // const value = try napi.get([]u8, napi_env, args[1]);

    // const subId = utils.read(u64, value, 0);
    // const typeId = utils.read(u16, value, 8);

    // if (ctx.subscriptions.types.get(typeId)) |typeSubscriptionCtx| {
    //     if (typeSubscriptionCtx.subs.fetchRemove(subId)) |removedMultiContainer| {
    //         // if (removedMultiContainer.value.filters) |f| {
    //         //     var filterIterator = f.iterator();
    //         //     while (filterIterator.next()) |filter| {
    //         //         std.debug.print("this is a FILTER {any} \n", .{filter});
    //         //         // ctx.allocator.destroy(filter.value_ptr.*);
    //         //         // _ = f.remove(filter.key_ptr.*);
    //         //     }
    //         //     // ctx.allocator.destroy(f.*);
    //         //     // f.deinit();
    //         // }

    //         // Remove individual ids as well
    //         removedMultiContainer.value.ids.deinit();

    //         // Fields remove
    //         removedMultiContainer.value.fields.deinit();

    //         ctx.allocator.destroy(removedMultiContainer.value);
    //         _ = typeSubscriptionCtx.nonMarkedMulti.remove(subId);
    //     }

    //     removeSubTypeIfEmpty(ctx, typeId, typeSubscriptionCtx);
    // }
    return null;
}
