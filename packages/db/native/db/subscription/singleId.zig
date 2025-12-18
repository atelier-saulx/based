const std = @import("std");
const db = @import("../db.zig");
const DbCtx = @import("../ctx.zig").DbCtx;
const napi = @import("../../napi.zig");
const utils = @import("../../utils.zig");
const types = @import("./types.zig");
const upsertSubType = @import("./shared.zig").upsertSubType;
const removeSubTypeIfEmpty = @import("./shared.zig").removeSubTypeIfEmpty;
const selva = @import("../../selva.zig");
const vectorLen = std.simd.suggestVectorLength(u8).?;
const vectorLenU16 = std.simd.suggestVectorLength(u16).?;

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

pub fn addIdSubscriptionInternal(napi_env: napi.c.napi_env, info: napi.c.napi_callback_info) !napi.c.napi_value {
    const args = try napi.getArgs(2, napi_env, info);
    const ctx = try napi.get(*DbCtx, napi_env, args[0]);
    const value = try napi.get([]u8, napi_env, args[1]);
    const headerLen = 18;
    const subId = utils.read(u32, value, 1);
    const typeId = utils.read(u16, value, 5);
    const id = utils.read(u32, value, 7);
    const fieldsLen = value[11];
    const partialLen = utils.read(u16, value, 12);

    const fields = value[headerLen .. fieldsLen + headerLen];
    const partialFields = value[fieldsLen + headerLen .. fieldsLen + headerLen + partialLen * 2];

    var typeSubs = try upsertSubType(ctx, typeId);

    var subs: []types.IdSubsItem = undefined;
    var idDoesNotExist = true;
    var subIndex: usize = 0;

    if (id >= typeSubs.minId and typeSubs.idBitSet[(id - typeSubs.bitSetMin) % typeSubs.bitSetSize] == 1) {
        if (typeSubs.idSubs.getEntry(id)) |entry| {
            subs = entry.value_ptr.*;
            idDoesNotExist = false;
            subIndex = subs.len;
            // keep prev clean later

            if (ctx.subscriptions.allocator.resize(subs, subs.len + 1)) {} else {
                // std.debug.print("CANT BLA \n", .{});
                const subsFreeList = subs;
                try ctx.subscriptions.freeList.append(
                    ctx.subscriptions.allocator,
                    subsFreeList,
                );
                subs = try ctx.subscriptions.allocator.alloc(types.IdSubsItem, subs.len + 1);
                @memcpy(subs, subsFreeList);
            }

            entry.value_ptr.* = subs;
        }
    }

    if (idDoesNotExist) {
        subs = try ctx.subscriptions.allocator.alloc(types.IdSubsItem, 1);
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

    subs[subIndex].marked = types.SubStatus.all;
    subs[subIndex].subId = subId;
    subs[subIndex].id = id;
    subs[subIndex].typeId = typeId;
    subs[subIndex].isRemoved = false;
    subs[subIndex].partial = @splat(@intFromEnum(types.SubPartialStatus.none));
    subs[subIndex].fields = @splat(@intFromEnum(types.SubStatus.marked));

    if (partialLen > vectorLenU16) {
        subs[subIndex].partial = @splat(@intFromEnum(types.SubPartialStatus.all));
    } else {
        var j: usize = 0;
        while (j < partialLen) {
            subs[subIndex].partial[j] = utils.read(u16, partialFields, j * 2);
            j += 1;
        }
    }

    if (fields.len > vectorLen) {
        subs[subIndex].fields = @splat(@intFromEnum(types.SubStatus.all));
    } else {
        var j: usize = 0;
        while (j < fieldsLen) {
            subs[subIndex].fields[j] = fields[j];
            j += 1;
        }
    }

    return null;
}

pub fn removeIdSubscriptionInternal(env: napi.c.napi_env, info: napi.c.napi_callback_info) !napi.c.napi_value {
    const args = try napi.getArgs(2, env, info);
    const ctx = try napi.get(*DbCtx, env, args[0]);
    const value = try napi.get([]u8, env, args[1]);
    // headerLen = 16
    const subId = utils.read(u32, value, 1);
    const typeId = utils.read(u16, value, 5);
    const id = utils.read(u32, value, 7);

    if (ctx.subscriptions.types.get(typeId)) |typeSubs| {
        if (id >= typeSubs.minId and typeSubs.idBitSet[(id - typeSubs.bitSetMin) % typeSubs.bitSetSize] == 1) {
            if (typeSubs.idSubs.getEntry(id)) |subsEntry| {
                const subs = subsEntry.value_ptr.*;
                var i: usize = 0;
                while (i < subs.len) {
                    if (subs[i].subId == subId) {
                        if (subs[i].marked != types.SubStatus.marked) {
                            if (ctx.subscriptions.singleIdMarked.len < ctx.subscriptions.lastIdMarked + 1) {
                                ctx.subscriptions.singleIdMarked = std.heap.raw_c_allocator.realloc(
                                    ctx.subscriptions.singleIdMarked,
                                    ctx.subscriptions.singleIdMarked.len + types.BLOCK_SIZE,
                                ) catch &.{};
                            }
                            ctx.subscriptions.singleIdMarked[ctx.subscriptions.lastIdMarked] = &subs[i];
                            ctx.subscriptions.lastIdMarked += 1;
                            subs[i].marked = types.SubStatus.marked;
                        }
                        subs[i].isRemoved = true;
                        // only do this when it's actually removed
                        if (subs.len > 1) {
                            const newLen = subs.len - 1;
                            if (i != newLen) {
                                subs[i] = subs[newLen];
                            }
                        }
                        break;
                    } else {
                        i += 1;
                    }
                }
            }
        }
    }

    return null;
}

pub fn removeSubscriptionMarked(ctx: *db.DbCtx, sub: *types.IdSubsItem) !void {
    const id = sub.id;
    const typeId = sub.typeId;

    if (ctx.subscriptions.types.get(typeId)) |typeSubs| {
        if (typeSubs.idSubs.getEntry(id)) |idSub| {
            const subs = idSub.value_ptr.*;
            if (subs.len == 1) {
                try ctx.subscriptions.freeList.append(
                    ctx.subscriptions.allocator,
                    idSub.value_ptr.*,
                );
                idSub.value_ptr.* = &.{};

                _ = typeSubs.idSubs.remove(id);

                // dont do this here need top be in marked
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

                if (idCount == 0) {
                    // remove
                } else if (range / idCount > 1000) {
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
                } else {
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
            } else if (subs.len != 0) {
                if (ctx.subscriptions.allocator.resize(
                    idSub.value_ptr.*,
                    idSub.value_ptr.len - 1,
                )) {} else {
                    // std.debug.print("REMOVE CANT RESIZE {any} \n", .{idSub.value_ptr.len - 1});
                    const subsFreeList = idSub.value_ptr.*;
                    try ctx.subscriptions.freeList.append(
                        ctx.subscriptions.allocator,
                        subsFreeList,
                    );
                    idSub.value_ptr.* = try ctx.subscriptions.allocator.alloc(
                        types.IdSubsItem,
                        idSub.value_ptr.len - 1,
                    );
                    @memcpy(subs, subsFreeList);
                }
            } else {
                std.debug.print("Weird subs len is 0 \n", .{});
            }
        }

        removeSubTypeIfEmpty(ctx, typeId, typeSubs);
    }
}
