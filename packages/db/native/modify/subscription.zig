const Modify = @import("./ctx.zig");
const ModifyCtx = Modify.ModifyCtx;
const std = @import("std");
const db = @import("../db/db.zig");
const selva = @import("../selva.zig");

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
        if (st.idBitSet[ctx.id % 10_000_000] == 1) {
            // this can be used to get the subs
            // add index and get stuff - still need this because there can be overhead here
            // if (selva.node_id_set_bsearch(@constCast(st.idsList.ptr), st.lastId, ctx.id) != -1) {
            ctx.idSubs = true;
            std.debug.print("HAS ID \n", .{});
            // }
        } else {
            ctx.idSubs = false;
        }
    }
}

pub fn stage(
    _: *ModifyCtx,
    comptime _: Op,
) !void {

    // here we check field in subs
    // idSubs has to be some indexes i geuss

    // if (op != Op.create and op != Op.deleteNode) {
    //     if (ctx.idSubs) |idSubs| {
    //         // lets make a UINT8ARRAY
    //         if (idSubs.getEntry(ctx.field)) |entry| {
    //             var iterator = entry.value_ptr.*.iterator();
    //             while (iterator.next()) |subIdEntry| {
    //                 ctx.db.subscriptions.hasMarkedSubscriptions = true;
    //                 try ctx.db.subscriptions.subscriptionsMarked.put(.{
    //                     subIdEntry.key_ptr.*,
    //                     ctx.id,
    //                 }, undefined);
    //             }
    //         }
    //     }
    // }
}
