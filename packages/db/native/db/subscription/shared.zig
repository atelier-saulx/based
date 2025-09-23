const types = @import("./types.zig");
const DbCtx = @import("../ctx.zig").DbCtx;
const std = @import("std");

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

pub inline fn removeSubTypeIfEmpty(ctx: *DbCtx, typeId: u16, typeSubscriptionCtx: *types.TypeSubscriptionCtx) void {
    if (typeSubscriptionCtx.ids.count() == 0 and typeSubscriptionCtx.multi.count() == 0) {
        // if all is empty
        if (ctx.subscriptions.types.fetchRemove(typeId)) |removed_entry| {
            removed_entry.value.ids.deinit();
            removed_entry.value.multi.deinit();
            removed_entry.value.nonMarkedMulti.deinit();
            ctx.allocator.destroy(removed_entry.value);

            std.debug.print("hello remove this type? {any}\n", .{typeId});
        }
    }
}
