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

pub const SubCtx = struct {
    subTypes: ?*Subscription.TypeSubscriptionCtx, // prob want to add subs here
    idSubs: ?[]*Subscription.Sub,
    id: u32,
    thread: *Thread.Thread,
};

pub fn checkId(
    ctx: *SubCtx,
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

pub fn stagePartial(ctx: *SubCtx, start: u16) void {
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
    ctx: *SubCtx,
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

pub fn suscription(thread: *Thread.Thread, batch: []u8) !void {
    if (thread.subscriptions.types.count() == 0) {
        return;
    }

    const buf = batch[13 + 4 ..];
    var ctx: SubCtx = .{
        .idSubs = null,
        .subTypes = null,
        .id = 0,
        .thread = thread,
    };

    var i: usize = 0;
    while (i < buf.len) {
        const op: t.ModOp = @enumFromInt(buf[i]);
        const data: []u8 = buf[i + 1 ..];
        switch (op) {
            .padding => {
                i += 1;
            },
            .switchProp => {
                i += 3;
            },
            .deleteNode => {
                // if (ctx.node) {
                //     // subs.stage(ctx, subs.Op.deleteNode);
                // }
                i += 1;
            },
            .deleteTextField => {
                // const lang: t.LangCode = @enumFromInt(data[0]);
                i += 2;
            },
            .switchIdCreate => {
                i += 1;
            },
            .switchIdCreateRing => {
                i += 5;
            },
            .switchIdCreateUnsafe => {
                i += 5;
            },
            .switchIdUpdate => {
                const id = utils.read(u32, data, 0);
                if (id != 0) {
                    ctx.id = id;
                    try checkId(&ctx);
                }
                i += 5;
            },
            // .switchEdgeId => {
            // },
            .upsert => {},
            .insert => {},
            .switchType => {
                const typeId = utils.read(u16, data, 0);
                ctx.subTypes = ctx.thread.subscriptions.types.get(typeId);
                i += 3;
            },
            .addEmptySort => {},
            .addEmptySortText => {},
            .delete => {},
            .deleteSortIndex => {},
            .createProp => {},
            .updateProp => {},
            .updatePartial => {},
            .increment, .decrement => {
                const fieldType: t.PropType = @enumFromInt(utils.read(u8, data, 0));
                const propSize = t.PropType.size(fieldType);
                const start = utils.read(u16, data, 1);
                std.debug.print("increment/decrement {s} {d}\n", .{ @tagName(fieldType), start });
                stagePartial(&ctx, start);
                i += propSize + 3 + 1;
            },
            .expire => {
                i += 5;
            },
        }
    }
}
