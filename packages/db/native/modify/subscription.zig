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
        const i = ctx.id % 10_000_000;
        const bit_index: u3 = @truncate(i % 8);

        if ((st.idBitMap[i / 8] & @as(u8, 1) << bit_index) >> bit_index == 1) {
            if (selva.node_id_set_bsearch(@constCast(st.idsList.ptr), st.lastId, ctx.id) != -1) {
                ctx.idSubs = true;
            }

            // get index , and then get the value
        } else {
            ctx.idSubs = false;
        }

        // if (db.getNode(ctx.id, ctx.subTypeEntry) != null) {
        //     // do something
        //     // cnt += 1;
        //     ctx.idSubs = true;
        // } else {
        //     ctx.idSubs = false;
        // }

        // ctx.fieldSchema = try db.getFieldSchema(ctx.typeEntry.?, ctx.field);

        // this is acceptable (ish)
        // if (typeSub.ids.getEntry(ctx.id)) |_| {
        //     ctx.idSubs = true;
        // } else {
        //     ctx.idSubs = false;
        // }
    }
}

pub fn stage(
    _: *ModifyCtx,
    comptime _: Op,
) !void {
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
