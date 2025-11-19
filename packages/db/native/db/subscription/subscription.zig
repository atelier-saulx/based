const std = @import("std");
const db = @import("../db.zig");
const DbCtx = @import("../ctx.zig").DbCtx;
const napi = @import("../../napi.zig");
const c = @import("../../c.zig");
const utils = @import("../../utils.zig");
const singleId = @import("./singleId.zig");
const multi = @import("./multi.zig");
const types = @import("./types.zig");

fn getMarkedIdSubscriptionsInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(1, env, info);
    const ctx = try napi.get(*DbCtx, env, args[0]);
    if (ctx.subscriptions.lastIdMarked > 0) {
        var resultBuffer: ?*anyopaque = undefined;
        var result: c.napi_value = undefined;
        const size = (ctx.subscriptions.lastIdMarked) * 8;
        if (c.napi_create_arraybuffer(env, size, &resultBuffer, &result) != c.napi_ok) {
            return null;
        }
        const data = @as([*]u8, @ptrCast(resultBuffer))[0..size];

        // Reset
        var i: usize = 0;
        while (i < ctx.subscriptions.lastIdMarked) {
            const sub = ctx.subscriptions.singleIdMarked[i];
            const newDataIndex = i * 8;
            const id = sub.id;

            if (sub.isRemoved) {
                if (ctx.subscriptions.types.get(sub.typeId)) |typeSubs| {
                    if (typeSubs.idSubs.getEntry(id)) |idSub| {
                        const subs = idSub.value_ptr;
                        if (subs.len == 1) {
                            _ = typeSubs.idSubs.remove(id);
                            std.heap.raw_c_allocator.free(idSub.value_ptr.*);

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
                                    try singleId.sizeBitSet(typeSubs);
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
                                    try singleId.sizeBitSet(typeSubs);
                                }
                            }
                        } else {
                            const newSubs = try std.heap.raw_c_allocator.realloc(
                                idSub.value_ptr.*,
                                idSub.value_ptr.len - 1,
                            );
                            idSub.value_ptr.* = newSubs;
                        }
                    }
                }
                // get sub types
            } else {
                utils.writeInt(u32, data, newDataIndex, id);
                utils.writeInt(u32, data, newDataIndex + 4, sub.subId);
                sub.*.marked = types.SubStatus.all;
            }
            i += 1;
        }

        ctx.subscriptions.lastIdMarked = 0;
        return result;
    }
    return null;
}

fn getMarkedMultiSubscriptionsInternal(env: c.napi_env, info: c.napi_callback_info) !c.napi_value {
    const args = try napi.getArgs(1, env, info);
    const ctx = try napi.get(*DbCtx, env, args[0]);
    var size: usize = 0;
    var iterator = ctx.subscriptions.types.iterator();
    while (iterator.next()) |entry| {
        if (entry.value_ptr.*.typeModified) {
            size += 2;
        }
    }
    if (size == 0) {
        return null;
    }
    var resultBuffer: ?*anyopaque = undefined;
    var result: c.napi_value = undefined;
    if (c.napi_create_arraybuffer(env, size, &resultBuffer, &result) != c.napi_ok) {
        return null;
    }
    iterator = ctx.subscriptions.types.iterator();
    var i: usize = 0;
    const data = @as([*]u8, @ptrCast(resultBuffer))[0..size];
    while (iterator.next()) |entry| {
        if (entry.value_ptr.*.typeModified) {
            entry.value_ptr.*.typeModified = false;
            utils.writeInt(u16, data, i, entry.key_ptr.*);
            i += 2;
        }
    }
    return result;
}

// ---------------------------------
pub fn getMarkedIdSubscriptions(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getMarkedIdSubscriptionsInternal(napi_env, info) catch |err| {
        std.log.err("getMarkedIdSubscriptions {any} \n", .{err});
        return null;
    };
}

pub fn getMarkedMultiSubscriptions(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return getMarkedMultiSubscriptionsInternal(napi_env, info) catch |err| {
        std.log.err("getMarkedMultiSubscriptions {any} \n", .{err});
        return null;
    };
}

pub fn removeIdSubscription(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return singleId.removeIdSubscriptionInternal(napi_env, info) catch |err| {
        std.log.err("removeIdSubscription err {any} \n", .{err});
        return null;
    };
}

pub fn addIdSubscription(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return singleId.addIdSubscriptionInternal(napi_env, info) catch |err| {
        std.log.err("addIdSubscription err {any} \n", .{err});
        return null;
    };
}

pub fn addMultiSubscription(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return multi.addMultiSubscriptionInternal(napi_env, info) catch |err| {
        std.log.err("addMultiSubscription err {any} \n", .{err});
        return null;
    };
}

pub fn removeMultiSubscription(napi_env: c.napi_env, info: c.napi_callback_info) callconv(.C) c.napi_value {
    return multi.removeMultiSubscriptionInternal(napi_env, info) catch |err| {
        std.log.err("removeMultiSubscription err {any} \n", .{err});
        return null;
    };
}
