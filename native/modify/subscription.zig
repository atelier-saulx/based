const Modify = @import("common.zig");
const ModifyCtx = Modify.ModifyCtx;
const std = @import("std");
const selva = @import("../selva/selva.zig");
const utils = @import("../utils.zig");
const jemalloc = @import("../jemalloc.zig");
const Subscription = @import("../subscription/common.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");

const vectorLen = std.simd.suggestVectorLength(u8).?;
const vectorLenU16 = std.simd.suggestVectorLength(u16).?;

pub const Op = enum(u8) {
    update = 0,
    create = 1,
    deleteNode = 2,
    deleteField = 3,
    deleteFieldLang = 4,
    updatePartial = 5,
};

pub fn checkId(
    ctx: *ModifyCtx,
) !void {
    if (ctx.subTypes) |typeSubs| {
        if (ctx.id >= typeSubs.minId and
            typeSubs.idBitSet[(ctx.id - typeSubs.bitSetMin) % typeSubs.bitSetSize] == 1) // can remove the modulo ^2
        {
            if (typeSubs.idSubs.get(ctx.id)) |idSubs| {
                ctx.idSubs = idSubs;
            }
        } else {
            ctx.idSubs = null;
        }
    }
}

pub fn stagePartial(ctx: *ModifyCtx, start: u16) void {
    if (ctx.idSubs) |idSubs| {
        var i: u32 = 0;
        var f: @Vector(vectorLenU16, u16) = @splat(start);
        f[vectorLenU16 - 1] = @intFromEnum(Subscription.SubPartialStatus.all);
        while (i < idSubs.len) : (i += 1) {
            if (idSubs[i].marked == Subscription.SubStatus.marked) {
                continue;
            }
            if (@reduce(.Or, idSubs[i].partial == f)) {
                if (ctx.thread.subscriptions.singleIdMarked.len < ctx.thread.subscriptions.lastIdMarked + 1) {
                    ctx.thread.subscriptions.singleIdMarked = jemalloc.realloc(
                        ctx.thread.subscriptions.singleIdMarked,
                        ctx.thread.subscriptions.singleIdMarked.len + Subscription.BLOCK_SIZE,
                    );
                }
                ctx.thread.subscriptions.singleIdMarked[ctx.thread.subscriptions.lastIdMarked] = idSubs[i].subId;
                ctx.thread.subscriptions.lastIdMarked += 1;
                idSubs[i].marked = Subscription.SubStatus.marked;
            }
        }
    }
}

pub fn stage(
    ctx: *ModifyCtx,
    comptime op: Op,
) void {
    var i: u32 = 0;
    if (op == Op.deleteNode) {
        if (ctx.idSubs) |idSubs| {
            while (i < idSubs.len) : (i += 1) {
                if (idSubs[i].marked == Subscription.SubStatus.marked) {
                    continue;
                }
                if (ctx.thread.subscriptions.singleIdMarked.len < ctx.thread.subscriptions.lastIdMarked + 16) {
                    ctx.thread.subscriptions.singleIdMarked = jemalloc.realloc(
                        ctx.thread.subscriptions.singleIdMarked,
                        ctx.thread.subscriptions.singleIdMarked.len + Subscription.BLOCK_SIZE * 16,
                    );
                }
                ctx.thread.subscriptions.singleIdMarked[ctx.thread.subscriptions.lastIdMarked] = idSubs[i].subId;
                ctx.thread.subscriptions.lastIdMarked += 1;
                idSubs[i].marked = Subscription.SubStatus.marked;
            }
        }
    } else if (op != Op.create) {
        if (ctx.idSubs) |idSubs| {
            var f: @Vector(vectorLen, u8) = @splat(ctx.field);
            f[vectorLen - 1] = @intFromEnum(Subscription.SubStatus.all);
            while (i < idSubs.len) : (i += 1) {
                if (idSubs[i].marked == Subscription.SubStatus.marked) {
                    continue;
                }
                if (@reduce(.Or, idSubs[i].fields == f)) {
                    if (ctx.thread.subscriptions.singleIdMarked.len < ctx.thread.subscriptions.lastIdMarked + 1) {
                        ctx.thread.subscriptions.singleIdMarked = jemalloc.realloc(
                            ctx.thread.subscriptions.singleIdMarked,
                            ctx.thread.subscriptions.singleIdMarked.len + Subscription.BLOCK_SIZE,
                        );
                    }
                    ctx.thread.subscriptions.singleIdMarked[ctx.thread.subscriptions.lastIdMarked] = idSubs[i].subId;
                    ctx.thread.subscriptions.lastIdMarked += 1;
                    idSubs[i].marked = Subscription.SubStatus.marked;
                }
            }
        }
    }
}

// pub fn suscription(thread: *Thread.Thread, batch: []u8) !void {
//     var index: usize = 0;
//     while (index < batch.len) {
//         const op: t.ModOp = @enumFromInt(batch[index]);
//         const operation: []u8 = batch[index + 1 ..];
//         switch (op) {
//             .padding => {
//                 index += 1;
//             },
//             .switchProp => {
//                 index += 3;
//             },
//             .deleteNode => {
//                 index += 1;
//             },
//             .deleteTextField => {
//                 index += 2;
//             },
//             .switchIdCreate => {
//                 index += 1;
//             },
//             .switchIdCreateRing => {
//                 index += 5;
//             },
//             .switchIdCreateUnsafe => {
//                 index += 5;
//             },
//             .switchIdUpdate => {
//                 const id = utils.read(u32, operation, 0);
//                 if (id != 0) {
//                     // ctx.node = .getNode(ctx.typeEntry.?, ctx.id);
//                     // if (ctx.node == null) {
//                     //     ctx.err = errors.ClientError.nx;
//                     // } else {

//                     // try checkId(ctx);
//                 }
//                 index += 5;
//             },
//             .switchEdgeId => {
//                 // const srcId = utils.read(u32, operation, 0);
//                 // const dstId = utils.read(u32, operation, 4);
//                 // const refField = utils.read(u8, operation, 8);

//                 // NEED THIS!
//                 // const prevNodeId = try switchEdgeId(ctx, srcId, dstId, refField);
//                 // writeoutPrevNodeId(ctx, &ctx.resultLen, prevNodeId, ctx.result);
//                 index += 10;
//             },
//             .upsert => {},
//             .insert => {},
//             .switchType => {
//                 const typeId = utils.read(u16, operation, 0);
//                 // try switchType(ctx, read(u16, operation, 0));
//                 index += 3;
//             },
//             .addEmptySort => {},
//             .addEmptySortText => {},
//             .delete => {},
//             .deleteSortIndex => {},
//             .createProp => {
//                 // also here
//             },
//             .updateProp => {
//                 // derp here go
//             },
//             .updatePartial => {
//                 // derp here we go
//             },
//             .increment, .decrement => {
//                 // here we go
//             },
//             .expire => {
//                 index += 5;
//             },
//         }
//     }
// }
