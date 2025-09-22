const types = @import("./types.zig");
const DbCtx = @import("../ctx.zig").DbCtx;

pub inline fn upsertSubType(ctx: *DbCtx, typeId: u16) !*types.TypeSubscriptionCtx {
    var typeSubscriptionCtx: *types.TypeSubscriptionCtx = undefined;
    if (!ctx.subscriptions.types.contains(typeId)) {
        typeSubscriptionCtx = try ctx.allocator.create(types.TypeSubscriptionCtx);
        typeSubscriptionCtx.*.ids = types.IdsSubscriptions.init(ctx.allocator);
        typeSubscriptionCtx.*.multi = types.MultiIdSubscriptions.init(ctx.allocator);
        typeSubscriptionCtx.*.nonMarkedMulti = types.MultiIdSubscriptions.init(ctx.allocator);
        try ctx.subscriptions.types.put(typeId, typeSubscriptionCtx);
    } else {
        typeSubscriptionCtx = ctx.subscriptions.types.get(typeId).?;
    }
    return typeSubscriptionCtx;
}
