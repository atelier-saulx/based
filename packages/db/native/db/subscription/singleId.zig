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

pub inline fn getNewBitSize(size: u32) u32 {
    var n: u32 = size;
    if (size < 100) {
        n = 100;
    } else if (size < 1000) {
        n = 1000;
    } else if (size < 10_000) {
        n = 10_000;
    } else if (size < 100_000) {
        n = 100_000;
    } else {
        n = types.MAX_BIT_SET_SIZE;
    }
    if (n > types.MAX_BIT_SET_SIZE) {
        n = types.MAX_BIT_SET_SIZE;
    }
    return n;
}

pub fn sizeBitSet(typeSubs: *types.TypeSubscriptionCtx) !void {
    var needsChange = false;
    const range = typeSubs.maxId - typeSubs.minId;

    if (typeSubs.bitSetSize != types.MAX_BIT_SET_SIZE and
        (range > typeSubs.bitSetSize and
            typeSubs.idSubs.count() * typeSubs.*.bitSetRatio > typeSubs.bitSetSize))
    {
        const newSize = getNewBitSize(typeSubs.bitSetSize);
        if (newSize != typeSubs.bitSetSize) {
            if (newSize > 10_000) {
                typeSubs.*.bitSetRatio = 25;
            }
            typeSubs.bitSetSize = newSize;
            typeSubs.idBitSet = try std.heap.raw_c_allocator.realloc(typeSubs.idBitSet, newSize);
            needsChange = true;
        }
    }

    if (typeSubs.bitSetMin == std.math.maxInt(u32) or typeSubs.minId < typeSubs.bitSetMin or needsChange) {
        const div = typeSubs.bitSetSize / 10;
        var newBitMin: u32 = 0;
        if (div > typeSubs.minId) {
            newBitMin = 0;
        } else {
            newBitMin = (typeSubs.minId / div) * div;
        }
        if (newBitMin != typeSubs.bitSetMin) {
            typeSubs.bitSetMin = newBitMin;
            needsChange = true;
        }
    }

    if (needsChange) {
        @memset(typeSubs.*.idBitSet, 0);
        var keyIterator = typeSubs.idSubs.keyIterator();
        while (keyIterator.next()) |k| {
            typeSubs.idBitSet[(k.* - typeSubs.bitSetMin) % typeSubs.bitSetSize] = 1;
        }
    }
}

pub fn addIdSubscriptionInternal(napi_env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(2, napi_env, info);
    const ctx = try napi.get(*DbCtx, napi_env, args[0]);
    const value = try napi.get([]u8, napi_env, args[1]);
    const headerLen = 10;
    const subId = utils.read(u32, value, 0);
    const typeId = utils.read(u16, value, 4);
    const id = utils.read(u32, value, 6);
    const fields = value[headerLen..value.len];
    var typeSubs = try upsertSubType(ctx, typeId);

    var subs: []u8 = undefined;
    var idDoesNotExist = true;
    var subIndex: usize = 0;

    if (typeSubs.idBitSet[(id - typeSubs.bitSetMin) % typeSubs.bitSetSize] == 1) {
        if (typeSubs.idSubs.getEntry(id)) |entry| {
            subs = entry.value_ptr.*;
            idDoesNotExist = false;
            subIndex = subs.len;
            subs = try std.heap.raw_c_allocator.realloc(subs, types.SUB_SIZE + subs.len);
            entry.value_ptr.* = subs;
        }
    }

    if (idDoesNotExist) {
        subs = try std.heap.c_allocator.alloc(u8, types.SUB_SIZE);
        // 254 means no match
        @memset(subs, @intFromEnum(types.SubStatus.noMatch));
        try typeSubs.idSubs.put(id, subs);
        if (id > typeSubs.maxId) {
            typeSubs.maxId = id;
        }
        if (id < typeSubs.minId) {
            typeSubs.minId = id;
        }
        try sizeBitSet(typeSubs);
        typeSubs.idBitSet[(id - typeSubs.bitSetMin) % typeSubs.bitSetSize] = 1;
    }

    utils.writeInt(u32, subs, subIndex + 4, subId);

    if (fields.len > vectorLen) {
        // If too many fields just fire for each
        @memset(subs[subIndex + 8 .. subIndex + types.SUB_SIZE], @intFromEnum(types.SubStatus.all));
    } else {
        utils.copy(subs[subIndex + 8 ..], fields);
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

    if (ctx.subscriptions.types.get(typeId)) |typeSubs| {
        if (typeSubs.idBitSet[(id - typeSubs.bitSetMin) % typeSubs.bitSetSize] == 1) {
            if (typeSubs.idSubs.getEntry(id)) |subsEntry| {
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
                    _ = typeSubs.idSubs.remove(id);
                    if (id > typeSubs.bitSetSize) {
                        var hasOthers = false;
                        var overlap = @divTrunc(id, typeSubs.bitSetSize);
                        const lowBound = @divTrunc(typeSubs.minId, typeSubs.bitSetSize);
                        while (overlap > lowBound) {
                            const potentialId = ((id) % typeSubs.bitSetSize) + (overlap - 1) * typeSubs.bitSetSize;
                            if (typeSubs.idSubs.contains(potentialId)) {
                                hasOthers = true;
                                break;
                            }
                            overlap -= 1;
                        }
                        if (!hasOthers) {
                            typeSubs.idBitSet[(id - typeSubs.bitSetMin) % typeSubs.bitSetSize] = 0;
                        }
                    } else if (typeSubs.maxId < typeSubs.bitSetSize + 1) {
                        typeSubs.idBitSet[(id - typeSubs.bitSetMin) % typeSubs.bitSetSize] = 0;
                    } else {
                        var hasOthers = false;
                        var overlap = @divTrunc(id, typeSubs.bitSetSize);
                        const maxId = @divTrunc(typeSubs.maxId, typeSubs.bitSetSize) + 1;
                        while (overlap < maxId) {
                            const potentialId = ((id) % typeSubs.bitSetSize) + (overlap + 1) * typeSubs.bitSetSize;
                            if (typeSubs.idSubs.contains(potentialId)) {
                                hasOthers = true;
                                break;
                            }
                            overlap += 1;
                        }
                        if (!hasOthers) {
                            typeSubs.idBitSet[(id - typeSubs.bitSetMin) % typeSubs.bitSetSize] = 0;
                        }
                    }

                    const idCount = typeSubs.idSubs.count();
                    const range = typeSubs.maxId - typeSubs.minId;

                    if (range / idCount > 1000) {
                        if (id == typeSubs.maxId) {
                            var keyIterator = typeSubs.idSubs.keyIterator();
                            while (keyIterator.next()) |k| {
                                if (k.* > typeSubs.maxId) {
                                    typeSubs.maxId = k.*;
                                }
                            }
                        } else if (id == typeSubs.minId) {
                            var keyIterator = typeSubs.idSubs.keyIterator();
                            while (keyIterator.next()) |k| {
                                if (k.* < typeSubs.maxId) {
                                    typeSubs.minId = k.*;
                                }
                            }
                            try sizeBitSet(typeSubs);
                        }
                    } else if (idCount != 0) {
                        if (id == typeSubs.maxId) {
                            var j: u32 = typeSubs.maxId;
                            const min = typeSubs.minId;
                            while (j >= min) {
                                if (typeSubs.idBitSet[(j - typeSubs.bitSetMin) % typeSubs.bitSetSize] == 1) {
                                    if (typeSubs.idSubs.contains(j)) {
                                        typeSubs.maxId = j;
                                        break;
                                    }
                                }
                                j -= 1;
                            }
                        } else if (id == typeSubs.minId) {
                            var j: u32 = typeSubs.minId;
                            while (j <= typeSubs.maxId) {
                                if (typeSubs.idBitSet[(j - typeSubs.bitSetMin) % typeSubs.bitSetSize] == 1 and
                                    typeSubs.idSubs.contains(j))
                                {
                                    typeSubs.minId = j;
                                    break;
                                }
                                j += 1;
                            }
                            try sizeBitSet(typeSubs);
                        }
                    }
                }
            }
        }

        removeSubTypeIfEmpty(ctx, typeId, typeSubs);
    }

    return null;
}
