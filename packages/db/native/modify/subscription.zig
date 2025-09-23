const Modify = @import("./ctx.zig");
const ModifyCtx = Modify.ModifyCtx;
const std = @import("std");

pub const Op = enum(u8) {
    update = 0,
    create = 1,
    deleteNode = 2,
    deleteField = 3,
    deleteFieldLang = 4,
};

pub inline fn idSwitch(ctx: *ModifyCtx) !void {
    if (ctx.subTypes) |sub| {
        if (sub.activeIdSubs.get(ctx.id)) |cnt| {
            ctx.hasSpecificIdSub = cnt > 0;
        } else {
            ctx.hasSpecificIdSub = false;
        }
    } else {
        ctx.hasSpecificIdSub = false;
    }
}

pub inline fn stage(
    ctx: *ModifyCtx,
    comptime _: Op,
) !void {
    if (ctx.subTypes) |typeSub| {
        if (ctx.hasSpecificIdSub) {
            var iter = typeSub.nonMarkedId.iterator();
            while (iter.next()) |sub| {
                if (sub.value_ptr.*.ids.contains(ctx.id) and !sub.value_ptr.*.stagedIds.?.contains(ctx.id)) {
                    try sub.value_ptr.*.stagedIds.?.put(ctx.id, undefined);
                    ctx.db.subscriptions.hasMarkedSubscriptions = true;
                    try ctx.db.subscriptions.subscriptionsMarked.put(sub.key_ptr.*, ctx.typeId);
                    if (sub.value_ptr.*.stagedIds.?.count() == sub.value_ptr.*.ids.count()) {
                        _ = typeSub.nonMarkedId.remove(sub.key_ptr.*);
                    }

                    // std.debug.print("yo yo hopw much? id:{any} cnt:{any} \n", .{ ctx.id, typeSub.activeIdSubs.get(ctx.id) });

                    if (typeSub.activeIdSubs.getEntry(ctx.id)) |cnt| {
                        cnt.value_ptr.* = cnt.value_ptr.* - 1;
                        if (cnt.value_ptr.* == 0) {
                            // delete me
                            _ = typeSub.activeIdSubs.remove(ctx.id);
                        }
                    }
                }
            }
        }
        // var iter = sub.*.nonMarkedMulti.iterator();
        //     while (iter.next()) |multiSub| {
        //         if (operation == Op.remove) {
        //             if (ctx.id <= multiSub.value_ptr.*.endId) {
        //                 // in this case it can result in an update - only thing you need to do is
        //                 ctx.db.subscriptions.hasMarkedSubscriptions = true;
        //                 try ctx.db.subscriptions.subscriptionsMultiMarked.put(multiSub.key_ptr.*, ctx.typeId);
        //                 _ = sub.nonMarkedMulti.remove(multiSub.key_ptr.*);
        //             }
        //             continue;
        //         }

        //         if (operation == Op.create and multiSub.value_ptr.*.hasFullRange) {
        //             std.debug.print("CREATE MULTI_ID SKIP within range SUBID! {any} \n", .{multiSub.key_ptr.*});
        //             continue;
        //         }

        //         if (multiSub.value_ptr.*.startId <= ctx.id and
        //             multiSub.value_ptr.*.endId >= ctx.id and
        //             // a field can not be created even though its included - filters do need to be evaluated
        //             (operation == Op.create or multiSub.value_ptr.*.fields.contains(ctx.field)))
        //         {
        //             ctx.db.subscriptions.hasMarkedSubscriptions = true;
        //             try ctx.db.subscriptions.subscriptionsMultiMarked.put(multiSub.key_ptr.*, ctx.typeId);
        //             _ = sub.nonMarkedMulti.remove(multiSub.key_ptr.*);
        //         }
        //     }

        //     // derp
    }
}

// pub inline fn singleIdRemove(
//     ctx: *ModifyCtx,
// ) !void {
//     if (ctx.subId) |idContainer| {
//         var fieldIter = idContainer.*.fields.valueIterator();
//         ctx.db.subscriptions.hasMarkedSubscriptions = true;
//         while (fieldIter.next()) |subIds| {
//             var keyIter = subIds.*.keyIterator();
//             while (keyIter.next()) |subId| {
//                 try ctx.db.subscriptions.subscriptionsIdMarked.put(subId.*, undefined);
//             }
//         }
//     }
// }

// pub inline fn singleId(
//     ctx: *ModifyCtx,
// ) !void {
//     if (ctx.subId) |idContainer| {
//         if (idContainer.fields.get(ctx.field)) |subIds| {
//             ctx.db.subscriptions.hasMarkedSubscriptions = true;
//             var keyIter = subIds.keyIterator();
//             while (keyIter.next()) |subId| {
//                 try ctx.db.subscriptions.subscriptionsIdMarked.put(subId.*, undefined);
//             }
//         }
//     }
// }
