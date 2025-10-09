const std = @import("std");
const db = @import("../db.zig");
const DbCtx = @import("../ctx.zig").DbCtx;
const napi = @import("../../napi.zig");
const c = @import("../../c.zig");
const utils = @import("../../utils.zig");
const types = @import("./types.zig");
const upsertSubType = @import("./shared.zig").upsertSubType;
const removeSubTypeIfEmpty = @import("./shared.zig").removeSubTypeIfEmpty;

const vectorLen = std.simd.suggestVectorLength(u8).?;

pub fn addIdSubscriptionInternal(napi_env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(2, napi_env, info);
    const ctx = try napi.get(*DbCtx, napi_env, args[0]);
    const value = try napi.get([]u8, napi_env, args[1]);
    const headerLen = 10;
    const subId = utils.read(u32, value, 0);
    const typeId = utils.read(u16, value, 4);
    const id = utils.read(u32, value, 6);
    const fields = value[headerLen..value.len];
    var typeSubscriptionCtx = try upsertSubType(ctx, typeId);

    // multiple subs per ID fix

    if (typeSubscriptionCtx.lastId + 1 > typeSubscriptionCtx.idsList.len) {
        std.debug.print("DERP NEED RESIZE \n", .{});

        typeSubscriptionCtx.*.idsList = try ctx.allocator.realloc(
            typeSubscriptionCtx.*.idsList,
            typeSubscriptionCtx.*.idsList.len + types.BLOCK_SIZE,
        );

        typeSubscriptionCtx.*.ids = try ctx.allocator.realloc(
            typeSubscriptionCtx.*.ids,
            typeSubscriptionCtx.*.ids.len + types.BLOCK_SIZE,
        );

        // try typeSubscriptionCtx.ids.ensureTotalCapacity(typeSubscriptionCtx.ids.items.len + types.BLOCK_SIZE);

        typeSubscriptionCtx.*.singleIdMarked = try ctx.allocator.realloc(
            typeSubscriptionCtx.*.singleIdMarked,
            typeSubscriptionCtx.*.singleIdMarked.len + types.BLOCK_SIZE * 8,
        );
    }

    // grow all this dynamicly...
    typeSubscriptionCtx.idsList[typeSubscriptionCtx.lastId] = id;
    typeSubscriptionCtx.lastId += 1;
    typeSubscriptionCtx.idBitSet[id % 10_000_000] = 1;

    const sub = try ctx.allocator.alloc(u8, vectorLen + 8);
    // 254 means no match
    @memset(sub, 254);

    // need to put 253 as default for empty vecs
    typeSubscriptionCtx.ids[typeSubscriptionCtx.lastId - 1] = sub;

    utils.writeInt(u32, sub, 4, subId);

    if (fields.len > vectorLen) {
        @memset(sub[8 .. 8 + vectorLen], 255);
        // utils.copy(sub[8..], fields[0..vectorLen]);
        // sub[8 + vectorLen] = 255; // means include all
    } else {
        utils.copy(sub[8..], fields);
    }

    return null;
}

pub fn removeIdSubscriptionInternal(_: c.napi_env, _: c.napi_callback_info) !c.napi_value {

    // this will become slow if you have many on a single id...

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
