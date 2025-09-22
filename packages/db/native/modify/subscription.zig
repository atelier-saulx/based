const Modify = @import("./ctx.zig");
const ModifyCtx = Modify.ModifyCtx;

const std = @import("std");

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
