const Modify = @import("./ctx.zig");
const ModifyCtx = Modify.ModifyCtx;
const std = @import("std");
const db = @import("../db/db.zig");
const selva = @import("../selva.zig");
const utils = @import("../utils.zig");
const subTypes = @import("../db//subscription/types.zig");

const vectorLen = std.simd.suggestVectorLength(u8).?;

pub const Op = enum(u8) {
    update = 0,
    create = 1,
    deleteNode = 2,
    deleteField = 3,
    deleteFieldLang = 4,
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

pub fn stage(
    ctx: *ModifyCtx,
    comptime op: Op,
) void {
    var i: u32 = 0;
    if (op == Op.deleteNode) {
        if (ctx.idSubs) |idSubs| {
            while (i < idSubs.len) : (i += subTypes.SUB_SIZE) {
                if (idSubs[i].marked == subTypes.SubStatus.marked) {
                    continue;
                }

                if (ctx.db.subscriptions.singleIdMarked.len < ctx.db.subscriptions.lastIdMarked + 16) {
                    ctx.db.subscriptions.singleIdMarked = std.heap.raw_c_allocator.realloc(
                        ctx.db.subscriptions.singleIdMarked,
                        ctx.db.subscriptions.singleIdMarked.len + subTypes.BLOCK_SIZE * 16,
                    ) catch &.{};
                }

                ctx.db.subscriptions.singleIdMarked[ctx.db.subscriptions.lastIdMarked] = &idSubs[i];
                ctx.db.subscriptions.lastIdMarked += 1;

                idSubs[i].marked = subTypes.SubStatus.marked;
            }
        }
    } else if (op != Op.create) {
        if (ctx.idSubs) |idSubs| {
            var f: @Vector(vectorLen, u8) = @splat(ctx.field);
            f[vectorLen - 1] = @intFromEnum(subTypes.SubStatus.all);
            while (i < idSubs.len) : (i += 1) {
                if (idSubs[i].marked == subTypes.SubStatus.marked) {
                    continue;
                }
                if (@reduce(.Or, idSubs[i].fields == f)) {
                    if (ctx.db.subscriptions.singleIdMarked.len < ctx.db.subscriptions.lastIdMarked + 1) {
                        ctx.db.subscriptions.singleIdMarked = std.heap.raw_c_allocator.realloc(
                            ctx.db.subscriptions.singleIdMarked,
                            ctx.db.subscriptions.singleIdMarked.len + subTypes.BLOCK_SIZE,
                        ) catch &.{};
                    }
                    ctx.db.subscriptions.singleIdMarked[ctx.db.subscriptions.lastIdMarked] = &idSubs[i];
                    ctx.db.subscriptions.lastIdMarked += 1;
                    idSubs[i].marked = subTypes.SubStatus.marked;
                }
            }
        }
    }
}
