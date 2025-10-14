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

// If we do it per staged area its going to be
//   - Add typeSub (ids LEN, id min, id max)
//   - Add id [sub buffer]
//   - Add marked ids buffer

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

    if (typeSubscriptionCtx.idBitSet[id % 10_000_000] == 1) {
        if (typeSubscriptionCtx.idSubs.get(id)) |s| {
            sub = s;
            idDoesNotExist = false;
            subIndex = sub.len;
            sub = try std.heap.raw_c_allocator.realloc(sub, vectorLen + 8 + sub.len);
            try typeSubscriptionCtx.idSubs.put(id, sub);
        }
    }

    if (idDoesNotExist) {
        typeSubscriptionCtx.idBitSet[id % 10_000_000] = 1;
        sub = try std.heap.c_allocator.alloc(u8, (vectorLen + 8));
        // 254 means no match
        @memset(sub, 254);
        try typeSubscriptionCtx.idSubs.put(id, sub);
    }

    utils.writeInt(u32, sub, subIndex + 4, subId);

    if (fields.len > vectorLen) {
        // If too many fields just fire for each
        @memset(sub[subIndex + 8 .. subIndex + 8 + vectorLen], 255);
    } else {
        utils.copy(sub[subIndex + 8 ..], fields);
    }

    return null;
}

pub fn removeIdSubscriptionInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(2, env, info);
    const ctx = try napi.get(*DbCtx, env, args[0]);
    const value = try napi.get([]u8, env, args[1]);

    const id = utils.read(u32, value, 0);
    const subId = utils.read(u32, value, 4);
    const typeId = utils.read(u16, value, 8);

    std.debug.print("DERPxx THIS IS IT! {any} {any} {any} \n", .{ id, subId, typeId });

    if (ctx.subscriptions.types.get(typeId)) |typeSubscriptionCtx| {
        if (typeSubscriptionCtx.idSubs.get(id)) |subs| {
            var i: usize = 0;
            std.debug.print("ID ID ID {any} ! \n", .{id});

            while (i < subs.len) {
                if (utils.read(u32, subs, i + 4) == subId) {
                    std.debug.print("DERP THIS IS IT! \n", .{});
                }
                i += 24;

                // if (id > 10_000_000) {
                //     var overlap = @divTrunc(id, 10_000_000);
                //     while (overlap > 0) {
                //         const potentialId = ((id) % 10_000_000) + overlap * 10_000_000;
                //         std.debug.print(
                //             "hello need to double check if there are more ids on the same number {any} \n",
                //             .{potentialId},
                //         );
                //         overlap -= 1;
                //     }
                // }

                // if (typeSubscriptionCtx.ids.get(id)) |subs| {
                //     if (subs.*.set.remove(sub)) {
                //         if (subs.*.set.count() == 0) {
                //             subs.*.set.deinit();
                //             ctx.allocator.destroy(subs);
                //             _ = typeSubscriptionCtx.ids.remove(id);
                //         } else {
                //             subs.*.active = subs.*.set.count();
                //         }
                //     }
                // }
                // if (sub.*.ids.count() == 0) {
                //     sub.ids.deinit();
                //     sub.stagedIds.?.deinit();
                //     sub.fields.deinit();
                //     if (typeSubscriptionCtx.subs.remove(subId)) {
                //         // std.debug.print("REMOVE SUB {any}!\n", .{subId});
                //         // _ = typeSubscriptionCtx.nonMarkedId.remove(subId);
                //         ctx.allocator.destroy(sub);
                //         removeSubTypeIfEmpty(ctx, typeId, typeSubscriptionCtx);
                //     }
                // }
            }
        }
    }

    return null;
}
