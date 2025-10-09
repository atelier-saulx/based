const std = @import("std");
const db = @import("../db.zig");
const DbCtx = @import("../ctx.zig").DbCtx;
const napi = @import("../../napi.zig");
const c = @import("../../c.zig");
const utils = @import("../../utils.zig");
const types = @import("./types.zig");
const upsertSubType = @import("./shared.zig").upsertSubType;
const removeSubTypeIfEmpty = @import("./shared.zig").removeSubTypeIfEmpty;
const selva = @import("../../selva.zig");
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

    var sub: []u8 = undefined;
    var idDoesNotExist = true;
    var subIndex: usize = 0;
    var idIndex: isize = 0;
    // multiple subs per ID fix
    if (typeSubscriptionCtx.idBitSet[id % 10_000_000] == 1) {
        idIndex = selva.node_id_set_bsearch(
            @constCast(typeSubscriptionCtx.idsList.ptr),
            typeSubscriptionCtx.lastId,
            id,
        );
        if (idIndex != -1) {
            sub = typeSubscriptionCtx.ids[@intCast(idIndex)];
            idDoesNotExist = false;
        }
    }

    if (idDoesNotExist) {
        const newSize = typeSubscriptionCtx.lastId + 1;
        if (newSize > typeSubscriptionCtx.idsList.len) {
            // std.debug.print("RESIZE ID SUBS \n", .{});
            // grow bitset!
            typeSubscriptionCtx.*.idsList = try ctx.allocator.realloc(typeSubscriptionCtx.*.idsList, newSize + types.BLOCK_SIZE);
            typeSubscriptionCtx.*.ids = try ctx.allocator.realloc(
                typeSubscriptionCtx.*.ids,
                newSize + types.BLOCK_SIZE,
            );
            typeSubscriptionCtx.*.singleIdMarked = try ctx.allocator.realloc(
                typeSubscriptionCtx.*.singleIdMarked,
                typeSubscriptionCtx.*.singleIdMarked.len + types.BLOCK_SIZE * 8,
            );
        }
        typeSubscriptionCtx.idsList[typeSubscriptionCtx.lastId] = id;
        typeSubscriptionCtx.lastId += 1;
        // Want to grow this dynamcly as well
        typeSubscriptionCtx.idBitSet[id % 10_000_000] = 1;
        sub = try ctx.allocator.alloc(u8, (vectorLen + 8) * 2);
        // 254 means no match
        @memset(sub, 254);
        typeSubscriptionCtx.ids[typeSubscriptionCtx.lastId - 1] = sub;
    } else {
        // lots of re-alloc - we can prob keep the number here - will become very annoying to remove things otherwise

        // we can also do addIds and invalidate the total allocater every period
        // this will remove the need for ANY reallocation scine we know

        subIndex = sub.len;
        sub = try ctx.allocator.realloc(sub, vectorLen + 8 + sub.len);
        typeSubscriptionCtx.ids[@intCast(idIndex)] = sub;
    }

    utils.writeInt(u32, sub, subIndex + 4, subId);
    if (fields.len > vectorLen) {
        // if too many fields just fire for each
        @memset(sub[subIndex + 8 .. subIndex + 8 + vectorLen], 255);
    } else {
        utils.copy(sub[subIndex + 8 ..], fields);
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
