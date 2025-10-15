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

    var subs: []u8 = undefined;
    var idDoesNotExist = true;
    var subIndex: usize = 0;

    // minId

    // id - minId => has less overlap
    if (typeSubscriptionCtx.idBitSet[id % 10_000_000] == 1) {
        if (typeSubscriptionCtx.idSubs.get(id)) |s| {
            subs = s;
            idDoesNotExist = false;
            subIndex = subs.len;
            subs = try std.heap.raw_c_allocator.realloc(subs, types.SUB_SIZE + subs.len);
            try typeSubscriptionCtx.idSubs.put(id, subs);
        }
    }

    if (idDoesNotExist) {
        typeSubscriptionCtx.idBitSet[id % 10_000_000] = 1;
        subs = try std.heap.c_allocator.alloc(u8, types.SUB_SIZE);
        // 254 means no match
        @memset(subs, 254);
        try typeSubscriptionCtx.idSubs.put(id, subs);
    }

    utils.writeInt(u32, subs, subIndex + 4, subId);

    if (fields.len > vectorLen) {
        // If too many fields just fire for each
        @memset(subs[subIndex + 8 .. subIndex + types.SUB_SIZE], 255);
    } else {
        utils.copy(subs[subIndex + 8 ..], fields);
    }

    if (id > typeSubscriptionCtx.maxId) {
        typeSubscriptionCtx.maxId = id;
    }

    if (id < typeSubscriptionCtx.minId) {
        typeSubscriptionCtx.minId = id;
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
            if (typeSubscriptionCtx.idSubs.getEntry(id)) |subsEntry| {
                const subs = subsEntry.value_ptr.*;

                var i: usize = 0;
                var idRemoved = false;

                while (i < subs.len) {
                    if (utils.read(u32, subs, i + 4) == subId) {
                        break;
                    } else {
                        i += types.SUB_SIZE;
                    }
                }

                if (subs.len == types.SUB_SIZE) {
                    std.heap.raw_c_allocator.free(subs);
                    idRemoved = true;
                } else {
                    const newLen = subs.len - types.SUB_SIZE;
                    if (i != newLen) {
                        const dest = subs[i .. i + types.SUB_SIZE];
                        const src = subs[newLen..];
                        utils.copy(dest, src);
                    }
                    const newSubs = try std.heap.raw_c_allocator.realloc(subs, newLen);
                    subsEntry.value_ptr.* = newSubs;
                }

                if (idRemoved) {
                    _ = typeSubscriptionCtx.idSubs.remove(id);
                    if (id > 10_000_000) {
                        var hasOthers = false;
                        var overlap = @divTrunc(id, 10_000_000);
                        const lowBound = @divTrunc(typeSubscriptionCtx.minId, 10_000_000);
                        while (overlap > lowBound) {
                            const potentialId = ((id) % 10_000_000) + (overlap - 1) * 10_000_000;
                            if (typeSubscriptionCtx.idSubs.contains(potentialId)) {
                                hasOthers = true;
                                break;
                            }
                            overlap -= 1;
                        }
                        if (!hasOthers) {
                            typeSubscriptionCtx.idBitSet[id % 10_000_000] = 0;
                        }
                    } else if (typeSubscriptionCtx.maxId < 10_000_001) {
                        typeSubscriptionCtx.idBitSet[id % 10_000_000] = 0;
                    } else {
                        var hasOthers = false;
                        var overlap = @divTrunc(id, 10_000_000);
                        const maxId = @divTrunc(typeSubscriptionCtx.maxId, 10_000_000) + 1;
                        while (overlap < maxId) {
                            const potentialId = ((id) % 10_000_000) + (overlap + 1) * 10_000_000;
                            if (typeSubscriptionCtx.idSubs.contains(potentialId)) {
                                hasOthers = true;
                                break;
                            }
                            overlap += 1;
                        }
                        if (!hasOthers) {
                            typeSubscriptionCtx.idBitSet[id % 10_000_000] = 0;
                        }
                    }

                    const idCount = typeSubscriptionCtx.idSubs.count();
                    const range = typeSubscriptionCtx.maxId - typeSubscriptionCtx.minId;

                    if (range / idCount > 1000) {
                        if (id == typeSubscriptionCtx.maxId) {
                            var keyIterator = typeSubscriptionCtx.idSubs.keyIterator();
                            while (keyIterator.next()) |k| {
                                if (k.* > typeSubscriptionCtx.maxId) {
                                    typeSubscriptionCtx.maxId = k.*;
                                }
                            }
                        } else if (id == typeSubscriptionCtx.minId) {
                            var keyIterator = typeSubscriptionCtx.idSubs.keyIterator();
                            while (keyIterator.next()) |k| {
                                if (k.* < typeSubscriptionCtx.maxId) {
                                    typeSubscriptionCtx.minId = k.*;
                                }
                            }
                        }
                    } else if (idCount != 0) {
                        if (id == typeSubscriptionCtx.maxId) {
                            var j: u32 = typeSubscriptionCtx.maxId;
                            const min = typeSubscriptionCtx.minId;
                            while (j >= min) {
                                if (typeSubscriptionCtx.idBitSet[j % 10_000_000] == 1) {
                                    if (typeSubscriptionCtx.idSubs.contains(j)) {
                                        typeSubscriptionCtx.maxId = j;
                                        break;
                                    }
                                }
                                j -= 1;
                            }
                        } else if (id == typeSubscriptionCtx.minId) {
                            var j: u32 = typeSubscriptionCtx.minId;
                            while (j <= typeSubscriptionCtx.maxId) {
                                if (typeSubscriptionCtx.idBitSet[j % 10_000_000] == 1 and
                                    typeSubscriptionCtx.idSubs.contains(j))
                                {
                                    typeSubscriptionCtx.minId = j;
                                    break;
                                }
                                j += 1;
                            }
                        }
                    }
                }
            }
        }

        removeSubTypeIfEmpty(ctx, typeId, typeSubscriptionCtx);
    }

    return null;
}
