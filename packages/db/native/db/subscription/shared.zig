const types = @import("./types.zig");
const DbCtx = @import("../ctx.zig").DbCtx;
const std = @import("std");

const vectorLen = std.simd.suggestVectorLength(u8).?;

pub inline fn upsertSubType(ctx: *DbCtx, typeId: u16) !*types.TypeSubscriptionCtx {
    var typeSubscriptionCtx: *types.TypeSubscriptionCtx = undefined;

    if (!ctx.subscriptions.types.contains(typeId)) {
        typeSubscriptionCtx = try ctx.allocator.create(types.TypeSubscriptionCtx);

        typeSubscriptionCtx.*.lastId = 0;

        // DEFAULT_LEN for bitmap? ASK YUZI
        // 4MB - make this dynamic (add till max first)
        // init this smaller.... 4mb per type is quite significant if you dont use it
        typeSubscriptionCtx.*.idBitSet = try std.heap.c_allocator.alloc(u1, 10_000_000 * 4); // 4mb

        // maybe do scaling blocksize? start with e.g. 100 then go 1000 etc log to 100k
        typeSubscriptionCtx.*.idsList = try std.heap.c_allocator.alloc(u32, types.BLOCK_SIZE);
        typeSubscriptionCtx.*.ids = try std.heap.c_allocator.alloc([]u8, types.BLOCK_SIZE);

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
