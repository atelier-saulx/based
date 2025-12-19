const std = @import("std");
const DbCtx = @import("../ctx.zig").DbCtx;
const Thread = @import("../../thread/thread.zig");
const napi = @import("../../napi.zig");
const utils = @import("../../utils.zig");
const t = @import("../../types.zig");
const singleId = @import("singleId.zig");
const upsertSubType = @import("shared.zig").upsertSubType;
const Subscription = @import("common.zig");
const removeSubTypeIfEmpty = @import("shared.zig").removeSubTypeIfEmpty;

pub fn getMarkedIdSubscriptions(thread: *Thread.Thread, ctx: *DbCtx, q: []u8, op: t.OpType) !void {
    if (ctx.subscriptions.lastIdMarked > 0) {
        const size = (ctx.subscriptions.lastIdMarked) * 8;
        const resp = try thread.query.result(size, utils.read(u32, q, 0), op);
        // Reset
        var i: usize = 0;
        while (i < ctx.subscriptions.lastIdMarked) {
            const sub = ctx.subscriptions.singleIdMarked[i];
            const newDataIndex = i * 8;
            const id = sub.id;
            if (sub.isRemoved) {
                singleId.removeSubscriptionMarked(ctx, sub);
            } else {
                utils.writeAs(u32, resp, id, newDataIndex);
                utils.writeAs(u32, resp, sub.subId, newDataIndex + 4);
                sub.*.marked = Subscription.SubStatus.all;
            }
            i += 1;
        }

        ctx.subscriptions.lastIdMarked = 0;
    } else {
        _ = try thread.query.result(0, utils.read(u32, q, 0), op);
    }
}

pub fn getMarkedMultiSubscriptions(thread: *Thread.Thread, ctx: *DbCtx, q: []u8, op: t.OpType) !void {
    var size: usize = 0;
    var iterator = ctx.subscriptions.types.iterator();
    while (iterator.next()) |entry| {
        if (entry.value_ptr.*.typeModified) {
            size += 2;
        }
    }
    if (size == 0) {
        _ = try thread.query.result(0, utils.read(u32, q, 0), op);
        return;
    }
    const resp = try thread.query.result(size, utils.read(u32, q, 0), op);
    iterator = ctx.subscriptions.types.iterator();
    var i: usize = 0;
    while (iterator.next()) |entry| {
        if (entry.value_ptr.*.typeModified) {
            entry.value_ptr.*.typeModified = false;
            utils.write(resp, entry.key_ptr.*, i);
            i += 2;
        }
    }
}

pub fn removeIdSubscription(
    thread: *Thread.Thread,
    dbCtx: *DbCtx,
    m: []u8,
    op: t.OpType,
) void {
    const resp = try thread.modify.result(4, utils.read(u32, m, 0), op);
    const value = m[5..m.len];
    // headerLen = 16
    const subId = utils.read(u32, value, 1);
    const typeId = utils.read(u16, value, 5);
    const id = utils.read(u32, value, 7);

    singleId.removeIdSubscriptionInternal(dbCtx, subId, typeId, id);
    utils.write(resp, @as(i32, 0), 0);
}

pub fn addIdSubscription(
    thread: *Thread.Thread,
    dbCtx: *DbCtx,
    m: []u8,
    op: t.OpType,
) void {
    const resp = try thread.modify.result(4, utils.read(u32, m, 0), op);
    const value = m[5..m.len];

    const headerLen = 18;
    const subId = utils.read(u32, value, 1);
    const typeId = utils.read(u16, value, 5);
    const id = utils.read(u32, value, 7);
    const fieldsLen = value[11];
    const partialLen = utils.read(u16, value, 12);
    const fields = value[headerLen .. fieldsLen + headerLen];
    const partialFields = value[fieldsLen + headerLen .. fieldsLen + headerLen + partialLen * 2];

    singleId.addIdSubscriptionInternal(dbCtx, subId, typeId, id, fieldsLen, partialLen, fields, partialFields) catch {
        // TODO proper error
        utils.write(resp, @as(i32, -1), 0);
        return;
    };

    utils.write(resp, @as(i32, 0), 0);
}

pub fn addMultiSubscription(
    thread: *Thread.Thread,
    dbCtx: *DbCtx,
    m: []u8,
    op: t.OpType,
) void {
    // [type][type]
    // [subId][subId][subId][subId]

    const resp = try thread.modify.result(4, utils.read(u32, m, 0), op);
    const header = utils.read(t.addMultiSubscriptionHeader, m, 5);

    var typeSubs = upsertSubType(dbCtx, header.typeId) catch {
        // TODO Write proper error
        utils.write(resp, @as(i32, -1), 0);
        return;
    };

    typeSubs.multiSubsSize += 1;
    // typeSubs.multiSubsSizeBits = (typeSubs.multiSubsSize + 8 - 1) / 8; // TODO in zig 0.15 replace with @divCeil

    // typeSubs.multiSubsStageMarked = try std.heap.raw_c_allocator.realloc(
    //     typeSubs.multiSubsStageMarked,
    //     typeSubs.multiSubsSizeBits,
    // );

    // typeSubs.multiSubsStageMarked[typeSubs.multiSubsSize - 1] = 0;

    // typeSubs.multiSubs = try std.heap.raw_c_allocator.realloc(
    //     typeSubs.multiSubs,
    //     typeSubs.multiSubsSize * types.SUB_SIZE, // only fields for now...
    // );

    // utils.read(u32, idSubs, i + 4)
    // utils.write(u32, typeSubs.multiSubs, subId, typeSubs.multiSubsSize * types.SUB_SIZE + 4);
    // typeSubs.multiSubs[]

    // std.debug.print("DERP typeId: {any} subId: {any} \n", .{ typeId, subId });

    utils.write(resp, @as(i32, 0), 0);
}

pub fn removeMultiSubscription(
    thread: *Thread.Thread,
    dbCtx: *DbCtx,
    m: []u8,
    op: t.OpType,
) void {
    const resp = try thread.modify.result(4, utils.read(u32, m, 0), op);
    const header = utils.read(t.removeMultiSubscriptionHeader, m, 5);

    // typeId subId = utils.read(u64, value, 0);
    // const typeId = utils.read(u16, value, 1);
    if (dbCtx.subscriptions.types.get(header.typeId)) |st| {
        st.multiSubsSize -= 1;
        removeSubTypeIfEmpty(dbCtx, header.typeId, st);
    }

    utils.write(resp, @as(i32, -1), 0);
}
