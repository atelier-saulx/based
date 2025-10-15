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

    std.debug.print("BOIK DERPxx THIS IS IT! {any} {any} {any} \n", .{ id, subId, typeId });

    var subs: []u8 = undefined;
    var idDoesNotExist = true;
    var subIndex: usize = 0;

    if (typeSubscriptionCtx.idBitSet[id % 10_000_000] == 1) {
        if (typeSubscriptionCtx.idSubs.get(id)) |s| {
            subs = s;
            idDoesNotExist = false;
            subIndex = subs.len;
            subs = try std.heap.raw_c_allocator.realloc(subs, vectorLen + 8 + subs.len);
            try typeSubscriptionCtx.idSubs.put(id, subs);
        }
    }

    if (idDoesNotExist) {
        typeSubscriptionCtx.idBitSet[id % 10_000_000] = 1;
        subs = try std.heap.c_allocator.alloc(u8, (vectorLen + 8));
        // 254 means no match
        @memset(subs, 254);
        try typeSubscriptionCtx.idSubs.put(id, subs);
    }

    utils.writeInt(u32, subs, subIndex + 4, subId);

    if (fields.len > vectorLen) {
        // If too many fields just fire for each
        @memset(subs[subIndex + 8 .. subIndex + 8 + vectorLen], 255);
    } else {
        utils.copy(subs[subIndex + 8 ..], fields);
    }

    if (id > typeSubscriptionCtx.maxId) {
        typeSubscriptionCtx.maxId = id;
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

    if (ctx.subscriptions.types.get(typeId)) |typeSubscriptionCtx| {
        if (typeSubscriptionCtx.idBitSet[id % 10_000_000] == 1) {

            // add check with bitset as well...
            if (typeSubscriptionCtx.idSubs.get(id)) |subs| {
                if (id == typeSubscriptionCtx.maxId) {
                    // find previous MAX...
                    // typeSubscriptionCtx.maxId = id;
                    std.debug.print("NEED TO GET THE PREVIOUS MAX ID... lets see what fastest... \n", .{});
                }

                var i: usize = 0;
                var idRemoved = false;

                while (i < subs.len) {
                    if (utils.read(u32, subs, i + 4) == subId) {
                        std.debug.print("DERP THIS IS IT! \n", .{});
                        break;
                    } else {
                        i += 24;
                    }
                }

                if (subs.len == 24) {
                    std.heap.raw_c_allocator.free(subs);
                    idRemoved = true;
                } else {
                    std.debug.print("resize shennaigans \n", .{});
                }

                if (idRemoved) {
                    _ = typeSubscriptionCtx.idSubs.remove(id);
                    if (id > 10_000_000) {
                        var hasOthers = false;
                        var overlap = @divTrunc(id, 10_000_000);
                        std.debug.print("? {any} \n", .{overlap});
                        while (overlap > 0) {
                            const potentialId = ((id) % 10_000_000) + (overlap - 1) * 10_000_000;
                            std.debug.print(
                                "hello need to double check if there are more ids on the same number {any} \n",
                                .{potentialId},
                            );

                            if (typeSubscriptionCtx.idSubs.contains(potentialId)) {
                                std.debug.print(
                                    "has double match STOP {any} \n",
                                    .{potentialId},
                                );
                                hasOthers = true;
                                break;
                            }

                            overlap -= 1;
                        }

                        if (!hasOthers) {
                            std.debug.print("flap flap remove \n", .{});
                            typeSubscriptionCtx.idBitSet[id % 10_000_000] = 0;
                        }
                    } else if (typeSubscriptionCtx.maxId < 10_000_001) {
                        typeSubscriptionCtx.idBitSet[id % 10_000_000] = 0;
                    } else {
                        // loop other way
                    }
                }
            }
        }

        removeSubTypeIfEmpty(ctx, typeId, typeSubscriptionCtx);
    }

    return null;
}
