const Modify = @import("./ctx.zig");
const ModifyCtx = Modify.ModifyCtx;

pub inline fn singleId(
    ctx: *ModifyCtx,
) !void {
    if (ctx.subId) |idContainer| {
        if (idContainer.fields.get(ctx.field)) |subIds| {
            ctx.db.subscriptions.hasMarkedSubscriptions = true;
            var keyIter = subIds.keyIterator();
            while (keyIter.next()) |subId| {
                try ctx.db.subscriptions.subscriptionsMarked.put(subId.*, undefined);
            }
        }
    }
}

pub inline fn singleIdRemove(
    ctx: *ModifyCtx,
) !void {
    if (ctx.subId) |idContainer| {
        var fieldIter = idContainer.fields.valueIterator();
        while (fieldIter.next()) |subIds| {
            var keyIter = subIds.*.keyIterator();
            while (keyIter.next()) |subId| {
                try ctx.db.subscriptions.subscriptionsMarked.put(subId.*, undefined);
            }
        }
    }
}
