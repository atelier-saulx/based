const Modify = @import("./ctx.zig");
const ModifyCtx = Modify.ModifyCtx;

pub inline fn checkForSingleId(
    ctx: *ModifyCtx,
) !void {
    if (ctx.subId) |singleId| {
        if (singleId.fields.get(ctx.field)) |subIds| {
            ctx.db.subscriptions.hasMarkedSubscriptions = true;
            var keyIter = subIds.keyIterator();
            while (keyIter.next()) |subId| {
                try ctx.db.subscriptions.subscriptionsMarked.put(subId.*, undefined);
            }
        }
    }
}
