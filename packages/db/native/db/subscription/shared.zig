const types = @import("./types.zig");
const DbCtx = @import("../ctx.zig").DbCtx;
const std = @import("std");

pub inline fn upsertSubType(ctx: *DbCtx, typeId: u16) !*types.TypeSubscriptionCtx {
    var typeSubscriptionCtx: *types.TypeSubscriptionCtx = undefined;
    if (!ctx.subscriptions.types.contains(typeId)) {
        typeSubscriptionCtx = try ctx.allocator.create(types.TypeSubscriptionCtx);

        typeSubscriptionCtx.*.lastId = 0;
        // 4MB - make this dynamic (add till max first)
        typeSubscriptionCtx.*.idBitSet = try ctx.allocator.alloc(u1, 10_000_000 * 4); // 4mb

        // 4MB - make this dynamic per block of e.g. 100k and grow it
        // ctx.allocator.realloc()
        typeSubscriptionCtx.*.idsList = try ctx.allocator.alloc(u32, 2_000_000); // 8mb

        typeSubscriptionCtx.*.ids = types.IdsSubs.init(ctx.allocator);

        try typeSubscriptionCtx.ids.ensureTotalCapacity(2_000_000);

        typeSubscriptionCtx.*.lastIdMarked = 0;

        typeSubscriptionCtx.*.singleIdMarked = try ctx.allocator.alloc(u8, 2_000_000 * 8); // 16mb

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
            removed_entry.value.ids.deinit();
            removed_entry.value.idBitSet.deinit();
            removed_entry.value.idsList.deinit();
            ctx.allocator.destroy(removed_entry.value);
        }
    }
}
