const std = @import("std");
const DbCtx = @import("../db/ctx.zig").DbCtx;
const napi = @import("../napi.zig");
const utils = @import("../utils.zig");
const jemalloc = @import("../jemalloc.zig");
const Subscription = @import("common.zig");
const upsertSubType = @import("shared.zig").upsertSubType;
const removeSubTypeIfEmpty = @import("shared.zig").removeSubTypeIfEmpty;
const t = @import("../types.zig");
const Thread = @import("../thread/thread.zig");

const vectorLen = std.simd.suggestVectorLength(u8).?;
const vectorLenU16 = std.simd.suggestVectorLength(u16).?;

inline fn getNewBitSize(size: u32) u32 {
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
        n = Subscription.MAX_BIT_SET_SIZE;
    }
    if (n > Subscription.MAX_BIT_SET_SIZE) {
        n = Subscription.MAX_BIT_SET_SIZE;
    }
    return n;
}

pub fn sizeBitSet(typeSubs: *Subscription.TypeSubscriptionCtx) void {
    var needsChange = false;
    const range = typeSubs.maxId - typeSubs.minId;

    if (typeSubs.bitSetSize != Subscription.MAX_BIT_SET_SIZE and
        (range > typeSubs.bitSetSize and
            typeSubs.idSubs.count() * typeSubs.*.bitSetRatio > typeSubs.bitSetSize))
    {
        const newSize = getNewBitSize(typeSubs.bitSetSize);
        if (newSize != typeSubs.bitSetSize) {
            if (newSize > 10_000) {
                typeSubs.*.bitSetRatio = 25;
            }
            typeSubs.bitSetSize = newSize;
            typeSubs.idBitSet = jemalloc.realloc(typeSubs.idBitSet, newSize);
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

pub fn addIdSubscription(
    thread: *Thread.Thread,
    queryBuffer: []u8,
    partialFields: []u8,
    fields: []u8,
    subId: u32,
    header: *const t.QueryHeaderSingle,
    subHeader: *const t.SubscriptionHeader,
) !void {
    var typeSubs = try upsertSubType(thread, header.typeId);
    var subs: []*Subscription.Sub = undefined;
    var idDoesNotExist = true;
    var subIndex: usize = 0;

    if (header.id >= typeSubs.minId and typeSubs.idBitSet[(header.id - typeSubs.bitSetMin) % typeSubs.bitSetSize] == 1) {
        if (typeSubs.idSubs.getEntry(header.id)) |entry| {
            subs = entry.value_ptr.*;
            idDoesNotExist = false;
            subIndex = subs.len;
            subs = jemalloc.realloc(subs, subs.len + 1);
            entry.value_ptr.* = subs;
        }
    }

    if (idDoesNotExist) {
        subs = jemalloc.alloc(*Subscription.Sub, 1);
        try typeSubs.idSubs.put(header.id, subs);
        if (header.id > typeSubs.maxId) {
            typeSubs.maxId = header.id;
        }
        if (header.id < typeSubs.minId) {
            typeSubs.minId = header.id;
        }
        sizeBitSet(typeSubs);
        typeSubs.idBitSet[(header.id - typeSubs.bitSetMin) % typeSubs.bitSetSize] = 1;
    }

    const sub = jemalloc.create(Subscription.Sub);

    sub.id = header.id;
    sub.marked = Subscription.SubStatus.all;
    sub.typeId = header.typeId;
    sub.partial = @splat(@intFromEnum(Subscription.SubPartialStatus.none));
    sub.fields = @splat(@intFromEnum(Subscription.SubStatus.marked));
    sub.query = jemalloc.alloc(u8, queryBuffer.len);
    utils.copy(u8, sub.query, queryBuffer, 0);
    sub.subId = subId;

    subs[subIndex] = sub;
    try thread.subscriptions.subsHashMap.put(subId, sub);

    if (subHeader.partialLen > vectorLenU16) {
        sub.partial = @splat(@intFromEnum(Subscription.SubPartialStatus.all));
    } else {
        var j: usize = 0;
        while (j < subHeader.partialLen) {
            sub.partial[j] = utils.read(u16, partialFields, j * 2);
            j += 1;
        }
    }
    if (fields.len > vectorLen) {
        sub.fields = @splat(@intFromEnum(Subscription.SubStatus.all));
    } else {
        var j: usize = 0;
        while (j < subHeader.fieldsLen) {
            sub.fields[j] = fields[j];
            j += 1;
        }
    }
}

pub fn removeIdSubscription(ctx: *DbCtx, subId: u32, typeId: u16, id: u32) void {
    if (ctx.subscriptions.types.get(typeId)) |typeSubs| {
        if (id >= typeSubs.minId and typeSubs.idBitSet[(id - typeSubs.bitSetMin) % typeSubs.bitSetSize] == 1) {
            if (typeSubs.idSubs.getEntry(id)) |idSub| {
                var subs = idSub.value_ptr.*;
                var i: usize = 0;
                while (i < subs.len) {
                    if (subs[i].subId == subId) {
                        // ----------
                        ctx.allocator.destroy(subs[i]);
                        _ = ctx.subscriptions.subsHashMap.remove(subId);

                        if (subs.len == 1) {
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
                                    sizeBitSet(typeSubs);
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
                                    sizeBitSet(typeSubs);
                                }
                            }
                        } else if (subs.len != 0) {
                            const newLen = subs.len - 1;
                            if (i != newLen) {
                                subs[i] = subs[newLen];
                            }
                            subs = jemalloc.realloc(subs, newLen);
                            idSub.value_ptr.* = subs;
                        } else {
                            std.debug.print("Weird subs len is 0 \n", .{});
                        }
                    }

                    removeSubTypeIfEmpty(ctx, typeId, typeSubs);

                    break;
                } else {
                    i += 1;
                }
            }
        }
    }
}
