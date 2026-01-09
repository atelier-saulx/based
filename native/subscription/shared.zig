const jemalloc = @import("../jemalloc.zig");
const Subscription = @import("common.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;
const std = @import("std");
const Thread = @import("../thread/thread.zig");

pub inline fn upsertSubType(
    thread: *Thread.Thread,
    typeId: u16,
) !*Subscription.TypeSubscriptionCtx {
    var typeSubs: *Subscription.TypeSubscriptionCtx = undefined;
    if (!thread.subscriptions.types.contains(typeId)) {
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

        try thread.subscriptions.types.put(typeId, typeSubs);
    } else {
        typeSubs = thread.subscriptions.types.get(typeId).?;
    }
    return typeSubs;
}

pub inline fn removeSubTypeIfEmpty(
    thread: *Thread.Thread,
    typeId: u16,
    typeSubs: *Subscription.TypeSubscriptionCtx,
) void {
    if (typeSubs.idSubs.count() == 0 and typeSubs.multiSubsSize == 0) {
        if (thread.subscriptions.types.fetchRemove(typeId)) |removed_entry| {
            removed_entry.value.idSubs.deinit();
            jemalloc.free(removed_entry.value.idBitSet);
            jemalloc.free(removed_entry.value);
        }
    }
}
