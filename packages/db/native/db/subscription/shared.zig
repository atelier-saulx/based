const types = @import("./types.zig");
const DbCtx = @import("../ctx.zig").DbCtx;
const std = @import("std");

const vectorLen = std.simd.suggestVectorLength(u8).?;

pub inline fn upsertSubType(ctx: *DbCtx, typeId: u16) !*types.TypeSubscriptionCtx {
    var typeSubscriptionCtx: *types.TypeSubscriptionCtx = undefined;

    if (!ctx.subscriptions.types.contains(typeId)) {
        typeSubscriptionCtx = try std.heap.raw_c_allocator.create(types.TypeSubscriptionCtx);

        typeSubscriptionCtx.*.idBitSet = try std.heap.raw_c_allocator.alloc(u1, 10_000_000 * 4); // 4mb (too much)

        typeSubscriptionCtx.*.idSubs = types.IdSubs.init(std.heap.raw_c_allocator);

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
            // have to destroy all using c_allocator
            // removed_entry.value.ids.deinit();
            // removed_entry.value.idBitSet.deinit();
            // removed_entry.value.idsList.deinit();
            std.heap.c_allocator.destroy(removed_entry.value);
        }
    }
}
