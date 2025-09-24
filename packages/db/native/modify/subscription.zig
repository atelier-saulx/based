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

pub fn checkId(
    ctx: *ModifyCtx,
) !void {
    if (ctx.subTypes) |typeSub| {
        if (typeSub.ids.get(ctx.id)) |subs| {
            ctx.idSubs = subs;
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
            // std.debug.print("{any}\n", .{idSubs});
            var iter = idSubs.iterator();
            while (iter.next()) |sub| {
                if (sub.key_ptr.*.fields.contains(ctx.field) and !sub.key_ptr.*.stagedIds.?.contains(ctx.field)) {
                    try sub.key_ptr.*.stagedIds.?.put(ctx.id, undefined);
                    ctx.db.subscriptions.hasMarkedSubscriptions = true;
                    try ctx.db.subscriptions.subscriptionsMarked.put(sub.key_ptr.*.id, ctx.typeId);
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
    // }
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
