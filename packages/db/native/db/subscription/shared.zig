const types = @import("./types.zig");
const DbCtx = @import("../ctx.zig").DbCtx;
const std = @import("std");

pub inline fn upsertSubType(ctx: *DbCtx, typeId: u16) !*types.TypeSubscriptionCtx {
    var typeSubscriptionCtx: *types.TypeSubscriptionCtx = undefined;
    if (!ctx.subscriptions.types.contains(typeId)) {
        typeSubscriptionCtx = try ctx.allocator.create(types.TypeSubscriptionCtx);

        typeSubscriptionCtx.*.lastId = 0;
        typeSubscriptionCtx.*.idBitMap = try ctx.allocator.alloc(u8, 2_000_000);

        @memset(typeSubscriptionCtx.*.idBitMap, 255);
        typeSubscriptionCtx.*.idsList = try ctx.allocator.alloc(u32, 2_000_000);

        // typeSubscriptionCtx.*.subs = types.Subscriptions.init(ctx.allocator);
        typeSubscriptionCtx.*.ids = types.IdsSubs.init(ctx.allocator);
        // typeSubscriptionCtx.*.nonMarkedMulti = types.Subscriptions.init(ctx.allocator);
        try ctx.subscriptions.types.put(typeId, typeSubscriptionCtx);
    } else {
        typeSubscriptionCtx = ctx.subscriptions.types.get(typeId).?;
    }
    return typeSubscriptionCtx;
}

pub inline fn removeSubTypeIfEmpty(
    ctx: *DbCtx,
    typeId: u16,
    typeSubscriptionCtx: *types.TypeSubscriptionCtx,
) void {
    if (typeSubscriptionCtx.ids.count() == 0) {
        if (ctx.subscriptions.types.fetchRemove(typeId)) |removed_entry| {
            // removed_entry.value.nonMarkedMulti.deinit();
            // removed_entry.value.subs.deinit();
            removed_entry.value.ids.deinit();
            ctx.allocator.destroy(removed_entry.value);
        }
    }
}
