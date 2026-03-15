const std = @import("std");
const selva = @import("../selva/selva.zig");
const utils = @import("../utils.zig");
const jemalloc = @import("../jemalloc.zig");
const Subscription = @import("../subscription/common.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");

const vectorLen = std.simd.suggestVectorLength(u8).?;
const vectorLenU16 = std.simd.suggestVectorLength(u16).?;

inline fn markSingleSub(thread: *Thread.Thread, sub: *Subscription.Sub) void {
    if (thread.subscriptions.singleIdMarked.len < thread.subscriptions.lastIdMarked + 1) {
        thread.subscriptions.singleIdMarked = jemalloc.realloc(
            thread.subscriptions.singleIdMarked,
            thread.subscriptions.singleIdMarked.len + Subscription.BLOCK_SIZE,
        );
    }
    thread.subscriptions.singleIdMarked[thread.subscriptions.lastIdMarked] = sub.subId;
    thread.subscriptions.lastIdMarked += 1;
    sub.marked = Subscription.SubStatus.marked;
}

pub fn subscription(thread: *Thread.Thread, buf: []u8) !void {
    if (thread.subscriptions.types.count() == 0) {
        return;
    }
    var i: usize = utils.sizeOf(t.ModifyHeader);
    while (i < buf.len) {
        const op: t.Modify = @enumFromInt(buf[i]);
        switch (op) {
            .create => {
                const header = utils.read(t.ModifyCreateHeader, buf, i);
                i += utils.sizeOf(t.ModifyCreateHeader);
                i += header.size;
            },
            .createRing => {
                const header = utils.read(t.ModifyCreateRingHeader, buf, i);
                i += utils.sizeOf(t.ModifyCreateRingHeader);
                i += header.size;
            },
            .update => {
                const header = utils.read(t.ModifyUpdateHeader, buf, i);
                i += utils.sizeOf(t.ModifyUpdateHeader);
                if (thread.subscriptions.types.get(header.type)) |typeSubs| {
                    if (header.id >= typeSubs.minId and typeSubs.idBitSet[(header.id - typeSubs.bitSetMin) % typeSubs.bitSetSize] == 1) {
                        if (typeSubs.idSubs.get(header.id)) |idSubs| {
                            const data: []u8 = buf[i .. i + header.size];
                            var j: usize = 0;
                            while (j < data.len) {
                                const propId = data[j];
                                var k: usize = 0;
                                if (propId == 0) {
                                    const main = utils.readNext(t.ModifyMainHeader, data, &j);
                                    j += main.size;
                                    var f: @Vector(vectorLenU16, u16) = @splat(main.start);
                                    f[vectorLenU16 - 1] = @intFromEnum(Subscription.SubPartialStatus.all);
                                    while (k < idSubs.len) : (i += 1) {
                                        if (idSubs[k].marked == Subscription.SubStatus.marked) continue;
                                        if (@reduce(.Or, idSubs[k].partial == f)) markSingleSub(thread, idSubs[k]);
                                    }
                                } else {
                                    const prop = utils.readNext(t.ModifyPropHeader, data, &j);
                                    j += prop.size;
                                    var f: @Vector(vectorLen, u8) = @splat(propId);
                                    f[vectorLen - 1] = @intFromEnum(Subscription.SubStatus.all);
                                    while (k < idSubs.len) : (k += 1) {
                                        if (idSubs[k].marked == Subscription.SubStatus.marked) continue;
                                        if (@reduce(.Or, idSubs[k].fields == f)) markSingleSub(thread, idSubs[k]);
                                    }
                                }
                            }
                        }
                    }
                }
                i += header.size;
            },
            .upsert => {
                const header = utils.read(t.ModifyCreateHeader, buf, i);
                i += utils.sizeOf(t.ModifyCreateHeader);
                const target = buf[i .. i + header.size];
                i += header.size;
                const dataSize = utils.read(u32, buf, i);
                i += 4;
                const data = buf[i .. i + dataSize];
                if (thread.subscriptions.types.get(header.type)) |typeSubs| {
                    var x: usize = 0;
                    while (x < target.len) {
                        const prop = utils.readNext(t.ModifyPropHeader, target, &x);
                        const value = target[x .. x + prop.size];
                        if (prop.type == t.PropType.alias) {
                            if (typeSubs.aliasSubs.get(prop.id)) |aliasSub| {
                                const subIds = aliasSub.get(value);
                                if (subIds.len == 0) continue;
                                var j: usize = 0;
                                while (j < data.len) {
                                    const propId = data[j];
                                    if (propId == 0) {
                                        const main = utils.readNext(t.ModifyMainHeader, data, &j);
                                        j += main.size;
                                        var f: @Vector(vectorLenU16, u16) = @splat(main.start);
                                        f[vectorLenU16 - 1] = @intFromEnum(Subscription.SubPartialStatus.all);
                                        for (subIds) |subId| {
                                            if (thread.subscriptions.subsHashMap.get(subId)) |sub| {
                                                if (sub.marked == Subscription.SubStatus.marked) continue;
                                                if (@reduce(.Or, sub.partial == f)) markSingleSub(thread, sub);
                                            }
                                        }
                                    } else {
                                        const prop2 = utils.readNext(t.ModifyPropHeader, data, &j);
                                        j += prop2.size;
                                        var f: @Vector(vectorLen, u8) = @splat(propId);
                                        f[vectorLen - 1] = @intFromEnum(Subscription.SubStatus.all);
                                        for (subIds) |subId| {
                                            if (thread.subscriptions.subsHashMap.get(subId)) |sub| {
                                                if (sub.marked == Subscription.SubStatus.marked) continue;
                                                if (@reduce(.Or, sub.fields == f)) markSingleSub(thread, sub);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        x += prop.size;
                    }
                }
                i += dataSize;
            },
            .insert => {
                const header = utils.read(t.ModifyCreateHeader, buf, i);
                i += utils.sizeOf(t.ModifyCreateHeader);
                i += header.size;
                const dataSize = utils.read(u32, buf, i);
                i += 4;
                i += dataSize;
            },
            .delete => {
                const header = utils.read(t.ModifyDeleteHeader, buf, i);
                if (thread.subscriptions.types.get(header.type)) |typeSubs| {
                    if (header.id >= typeSubs.minId and typeSubs.idBitSet[(header.id - typeSubs.bitSetMin) % typeSubs.bitSetSize] == 1) {
                        if (typeSubs.idSubs.get(header.id)) |idSubs| {
                            var j: usize = 0;
                            while (j < idSubs.len) : (j += 1) {
                                if (idSubs[j].marked == Subscription.SubStatus.marked) continue;
                                if (thread.subscriptions.singleIdMarked.len < thread.subscriptions.lastIdMarked + 16) {
                                    thread.subscriptions.singleIdMarked = jemalloc.realloc(
                                        thread.subscriptions.singleIdMarked,
                                        thread.subscriptions.singleIdMarked.len + Subscription.BLOCK_SIZE * 16,
                                    );
                                }
                                thread.subscriptions.singleIdMarked[thread.subscriptions.lastIdMarked] = idSubs[j].subId;
                                thread.subscriptions.lastIdMarked += 1;
                                idSubs[j].marked = Subscription.SubStatus.marked;
                            }
                        }
                    }
                }
                i += utils.sizeOf(t.ModifyDeleteHeader);
            },
        }
    }
}
