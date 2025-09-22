const Modify = @import("./ctx.zig");
const ModifyCtx = Modify.ModifyCtx;
const std = @import("std");

pub inline fn multiId(
    ctx: *ModifyCtx,
) !void {
    // has multi?
    if (ctx.subTypes) |sub| {
        var iter = sub.*.nonMarkedMulti.iterator();
        while (iter.next()) |multiSub| {
            if (multiSub.value_ptr.*.startId <= ctx.id and
                multiSub.value_ptr.*.endId >= ctx.id and
                multiSub.value_ptr.*.fields.contains(ctx.field))
            {
                ctx.db.subscriptions.hasMarkedSubscriptions = true;
                try ctx.db.subscriptions.subscriptionsMultiMarked.put(multiSub.key_ptr.*, ctx.typeId);
                _ = sub.nonMarkedMulti.remove(multiSub.key_ptr.*); // greatly optmizes the check
                std.debug.print("within range SUBID! {any} \n", .{multiSub.key_ptr.*});
            } else {
                // std.debug.print("not within range! {any} \n", .{multiSub});
            }
        }
    }
}

pub inline fn singleIdRemove(
    ctx: *ModifyCtx,
) !void {
    if (ctx.subId) |idContainer| {
        var fieldIter = idContainer.*.fields.valueIterator();
        ctx.db.subscriptions.hasMarkedSubscriptions = true;
        while (fieldIter.next()) |subIds| {
            var keyIter = subIds.*.keyIterator();
            while (keyIter.next()) |subId| {
                try ctx.db.subscriptions.subscriptionsIdMarked.put(subId.*, undefined);
            }
        }
    }
}

pub inline fn singleId(
    ctx: *ModifyCtx,
) !void {
    if (ctx.subId) |idContainer| {
        if (idContainer.fields.get(ctx.field)) |subIds| {
            ctx.db.subscriptions.hasMarkedSubscriptions = true;
            var keyIter = subIds.keyIterator();
            while (keyIter.next()) |subId| {
                try ctx.db.subscriptions.subscriptionsIdMarked.put(subId.*, undefined);
            }
        }
    }
}
