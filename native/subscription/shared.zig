const jemalloc = @import("../jemalloc.zig");
const Subscription = @import("common.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;
const std = @import("std");

pub inline fn upsertSubType(ctx: *DbCtx, typeId: u16) !*Subscription.TypeSubscriptionCtx {
    var typeSubs: *Subscription.TypeSubscriptionCtx = undefined;
    if (!ctx.subscriptions.types.contains(typeId)) {
        // single id
        typeSubs = jemalloc.create(Subscription.TypeSubscriptionCtx);
        typeSubs.maxId = 0;
        typeSubs.minId = std.math.maxInt(u32);
        typeSubs.bitSetMin = std.math.maxInt(u32);
        typeSubs.bitSetSize = 10;
        typeSubs.bitSetRatio = 5;
        typeSubs.idBitSet = jemalloc.alloc(u1, typeSubs.bitSetSize);
        @memset(typeSubs.idBitSet, 0);
        typeSubs.idSubs = Subscription.IdSubs.init(std.heap.raw_c_allocator);

        try ctx.subscriptions.types.put(typeId, typeSubs);
    } else {
        typeSubs = ctx.subscriptions.types.get(typeId).?;
    }
    return typeSubs;
}

pub inline fn removeSubTypeIfEmpty(
    ctx: *DbCtx,
    typeId: u16,
    typeSubs: *Subscription.TypeSubscriptionCtx,
) void {
    if (typeSubs.idSubs.count() == 0 and typeSubs.multiSubsSize == 0) {
        if (ctx.subscriptions.types.fetchRemove(typeId)) |removed_entry| {
            removed_entry.value.idSubs.deinit();
            jemalloc.free(removed_entry.value.idBitSet);
            jemalloc.free(removed_entry.value);
        }
    }
}
