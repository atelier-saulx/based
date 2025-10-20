const Modify = @import("./ctx.zig");
const ModifyCtx = Modify.ModifyCtx;
const std = @import("std");
const db = @import("../db/db.zig");
const selva = @import("../selva.zig");
const utils = @import("../utils.zig");
const subTypes = @import("../db//subscription/types.zig");

// use this later for the max field check
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
    if (op != Op.create and op != Op.deleteNode) {
        if (ctx.idSubs) |idSubs| {
            var i: u32 = 0;
            const size = subTypes.SUB_SIZE;
            var f: @Vector(vectorLen, u8) = @splat(ctx.field);
            f[vectorLen - 1] = @intFromEnum(subTypes.SubStatus.all);
            while (i < idSubs.len) : (i += size) {
                if (idSubs[i + 8] == @intFromEnum(subTypes.SubStatus.marked)) {
                    continue;
                }
                const vec: @Vector(vectorLen, u8) = idSubs[i..][0..vectorLen].*;
                if (@reduce(.Or, vec == f)) {
                    if (ctx.db.subscriptions.singleIdMarked.len < ctx.db.subscriptions.lastIdMarked + 8) {
                        ctx.db.subscriptions.singleIdMarked = std.heap.raw_c_allocator.realloc(
                            ctx.db.subscriptions.singleIdMarked,
                            ctx.db.subscriptions.singleIdMarked.len + subTypes.BLOCK_SIZE * 8,
                        ) catch &.{};
                    }
                    utils.writeInt(
                        u32,
                        ctx.db.subscriptions.singleIdMarked,
                        ctx.db.subscriptions.lastIdMarked,
                        utils.read(u32, idSubs, i + 4),
                    );
                    utils.writeInt(
                        u32,
                        ctx.db.subscriptions.singleIdMarked,
                        ctx.db.subscriptions.lastIdMarked + 4,
                        ctx.id,
                    );
                    ctx.db.subscriptions.lastIdMarked += 8;
                    idSubs[i + 8] = @intFromEnum(subTypes.SubStatus.marked);
                }
            }
        }
    }
}
