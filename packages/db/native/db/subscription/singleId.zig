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
    // const headerLen = 10;
    // const subId = utils.read(u32, value, 0);
    const typeId = utils.read(u16, value, 4);
    const id = utils.read(u32, value, 6);
    // const fields = value[headerLen..value.len];
    var typeSubscriptionCtx = try upsertSubType(ctx, typeId);

    // const idEntry = try typeSubscriptionCtx.ids.getOrPut(id);

    // if (!idEntry.found_existing) {
    // idEntry.value_ptr.* = types.Fields.init(ctx.allocator);
    // }
    typeSubscriptionCtx.idsList[typeSubscriptionCtx.lastId] = id;
    typeSubscriptionCtx.lastId += 1;
    typeSubscriptionCtx.idBitSet[id % 10_000_000] = 1;

    // const bit_index: u3 = @truncate(xxx % 8);
    // if ((typeSubscriptionCtx.idBitMap[xxx / 8] & @as(u8, 1) << bit_index) >> bit_index == 1) {
    //     std.debug.print("-> id: {any} \n", .{xxx});
    // } else {
    //     // ctx.idSubs = false;
    // }

    // typeSubscriptionCtx.lastId += 1;

    // for (fields) |field| {
    //     const fieldEntry = try idEntry.value_ptr.*.getOrPut(field);
    //     if (!fieldEntry.found_existing) {
    //         fieldEntry.value_ptr.* = types.IdsSet.init(ctx.allocator);
    //     }
    //     try fieldEntry.value_ptr.*.put(subId, undefined);
    // }

    return null;
}

pub fn removeIdSubscriptionInternal(_: c.napi_env, _: c.napi_callback_info) !c.napi_value {
    // const args = try napi.getArgs(2, env, info);
    // const ctx = try napi.get(*DbCtx, env, args[0]);
    // const value = try napi.get([]u8, env, args[1]);
    // const subId = utils.read(u64, value, 0);
    // const typeId = utils.read(u16, value, 8);
    // const id = utils.read(u32, value, 10);

    // if (ctx.subscriptions.types.get(typeId)) |typeSubscriptionCtx| {
    // if (typeSubscriptionCtx.subs.get(subId)) |sub| {
    //     if (sub.*.ids.remove(id)) {
    //         if (typeSubscriptionCtx.ids.get(id)) |subs| {
    //             if (subs.*.set.remove(sub)) {
    //                 if (subs.*.set.count() == 0) {
    //                     subs.*.set.deinit();
    //                     ctx.allocator.destroy(subs);
    //                     _ = typeSubscriptionCtx.ids.remove(id);
    //                 } else {
    //                     subs.*.active = subs.*.set.count();
    //                 }
    //             }
    //         }
    //         if (sub.*.ids.count() == 0) {
    //             sub.ids.deinit();
    //             sub.stagedIds.?.deinit();
    //             sub.fields.deinit();
    //             if (typeSubscriptionCtx.subs.remove(subId)) {
    //                 // std.debug.print("REMOVE SUB {any}!\n", .{subId});
    //                 // _ = typeSubscriptionCtx.nonMarkedId.remove(subId);
    //                 ctx.allocator.destroy(sub);
    //                 removeSubTypeIfEmpty(ctx, typeId, typeSubscriptionCtx);
    //             }
    //         }
    //     }
    // }
    // }

    return null;
}
