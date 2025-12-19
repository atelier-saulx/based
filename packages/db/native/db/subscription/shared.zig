const types = @import("./types.zig");
const DbCtx = @import("../ctx.zig").DbCtx;
const std = @import("std");

const vectorLen = std.simd.suggestVectorLength(u8).?;

pub inline fn upsertSubType(ctx: *DbCtx, typeId: u16) !*types.TypeSubscriptionCtx {
    var typeSubs: *types.TypeSubscriptionCtx = undefined;
    if (!ctx.subscriptions.types.contains(typeId)) {
        // single id
        typeSubs = try std.heap.raw_c_allocator.create(types.TypeSubscriptionCtx);
        typeSubs.maxId = 0;
        typeSubs.minId = std.math.maxInt(u32);
        typeSubs.bitSetMin = std.math.maxInt(u32);
        typeSubs.bitSetSize = 10;
        typeSubs.bitSetRatio = 5;
        typeSubs.idBitSet = try std.heap.raw_c_allocator.alloc(u1, typeSubs.bitSetSize);
        @memset(typeSubs.idBitSet, 0);
        typeSubs.idSubs = types.IdSubs.init(std.heap.raw_c_allocator);
        // multi id
        typeSubs.multiSubsSize = 0;
        // typeSubs.multiSubsSizeBits = 0;
        // typeSubs.multiSubs = try std.heap.raw_c_allocator.alloc(u8, 0); // re-alloc sporadicly (8 bytes)
        // typeSubs.multiSubsStageMarked = try std.heap.raw_c_allocator.alloc(u8, 0);
        // @memset(typeSubs.multiSubsStageMarked, 255);

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
    if (typeSubs.idSubs.count() == 0 and typeSubs.multiSubsSize == 0) {
        if (ctx.subscriptions.types.fetchRemove(typeId)) |removed_entry| {
            // std.debug.print("REMOVE SUB TYPE... \n", .{});
            removed_entry.value.idSubs.deinit();
            std.heap.raw_c_allocator.free(removed_entry.value.idBitSet);

            // std.heap.raw_c_allocator.free(removed_entry.value.multiSubsStageMarked);
            // std.heap.raw_c_allocator.free(removed_entry.value.multiSubs);

            std.heap.raw_c_allocator.destroy(removed_entry.value);
        }
    }
}
