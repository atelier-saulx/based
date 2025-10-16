const types = @import("./types.zig");
const DbCtx = @import("../ctx.zig").DbCtx;
const std = @import("std");

const vectorLen = std.simd.suggestVectorLength(u8).?;

pub inline fn upsertSubType(ctx: *DbCtx, typeId: u16) !*types.TypeSubscriptionCtx {
    var typeSubs: *types.TypeSubscriptionCtx = undefined;
    if (!ctx.subscriptions.types.contains(typeId)) {
        typeSubs = try std.heap.raw_c_allocator.create(types.TypeSubscriptionCtx);
        typeSubs.*.maxId = 0;
        typeSubs.*.minId = std.math.maxInt(u32);
        typeSubs.*.bitSetMin = std.math.maxInt(u32);
        typeSubs.*.bitSetSize = 10;
        typeSubs.*.bitSetRatio = 5;
        typeSubs.*.idBitSet = try std.heap.raw_c_allocator.alloc(
            u1,
            typeSubs.*.bitSetSize,
        );
        @memset(typeSubs.*.idBitSet, 0);
        typeSubs.*.idSubs = types.IdSubs.init(std.heap.raw_c_allocator);
        try ctx.subscriptions.types.put(typeId, typeSubs);
    } else {
        typeSubs = ctx.subscriptions.types.get(typeId).?;
    }
    return typeSubs;
}

pub inline fn removeSubTypeIfEmpty(
    ctx: *DbCtx,
    typeId: u16,
    typeSubs: *types.TypeSubscriptionCtx,
) void {
    if (typeSubs.idSubs.count() == 0) {
        if (ctx.subscriptions.types.fetchRemove(typeId)) |removed_entry| {
            std.debug.print("REMOVE SUB TYPE... \n", .{});
            removed_entry.value.idSubs.deinit();
            std.heap.raw_c_allocator.free(removed_entry.value.idBitSet);
            std.heap.raw_c_allocator.destroy(removed_entry.value);
        }
    }
}
