const Modify = @import("./ctx.zig");
const ModifyCtx = Modify.ModifyCtx;
const std = @import("std");
const db = @import("../db/db.zig");
const selva = @import("../selva.zig");
const utils = @import("../utils.zig");

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
    if (ctx.subTypes) |st| {
        // can do a min offset
        if (st.idBitSet[ctx.id % 10_000_000] == 1) {
            const index = selva.node_id_set_bsearch(@constCast(st.idsList.ptr), st.lastId, ctx.id);

            if (index != -1) {
                // std.debug.print("DERP???? {any} {any} - {any} = {any} {any} \n", .{ ctx.id, index, st.lastId, @as(usize, @intCast(index)), st.ids.items[@intCast(index)] });

                ctx.idSubs = st.ids.items[@intCast(index)];
            }
        } else {
            ctx.idSubs = null;
        }
    }
}

pub fn stage(
    ctx: *ModifyCtx,
    comptime op: Op,
) !void {
    if (op != Op.create and op != Op.deleteNode) {
        if (ctx.idSubs) |idSubs| {
            var i: u32 = 8;
            const size = 24;
            const f: @Vector(vectorLen, u8) = @splat(ctx.field);

            // std.debug.print("DERP {any} \n", .{ctx.id});
            while (i < idSubs.len - 15) : (i += size) {
                if (idSubs[i - 8] == 255) {
                    continue;
                }
                const vec: @Vector(vectorLen, u8) = idSubs[i..][0..vectorLen].*;
                if (@reduce(.Or, vec == f)) {
                    if (ctx.subTypes) |st| {
                        utils.writeInt(u32, st.singleIdMarked, st.lastIdMarked, utils.read(u32, idSubs, i - 4));
                        utils.writeInt(u32, st.singleIdMarked, st.lastIdMarked + 4, ctx.id);
                        st.lastIdMarked += 8;
                        idSubs[i - 8] = 255;
                    }
                }
            }
        }
    }
}
