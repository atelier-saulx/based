const std = @import("std");
const Thread = @import("../thread/thread.zig");
const common = @import("common.zig");
const Worker = @import("../thread/common.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;
const Sort = @import("sort.zig");
const t = @import("../types.zig");

pub const Decay = struct {
    coeff: f64,
    freshness: f64,
    useCounter: common.SortUseCounter,
};

pub const DECAY_INTERVAL_MS =  2 * Worker.SUB_EXEC_INTERVAL;
const DECAY_MS: f64 = 3.6e+6;
const FRESH_START: f64 = 1.0;

fn calcCoeff(comptime sampleInterval: f64, comptime period: f64) f64 {
    return std.math.exp(-(sampleInterval / period));
}

pub fn init() Decay {
    const coeff = comptime calcCoeff(DECAY_INTERVAL_MS, DECAY_MS);
    return Decay{
        .coeff = coeff,
        .useCounter = common.SortUseCounter.init(0),
        .freshness = FRESH_START,
    };
}

fn sortIndexDecay(dbCtx: *DbCtx, typeId: t.TypeId, comptime T: type, iter: std.AutoHashMap(T, *common.SortIndexMeta).Iterator) void {
    var it = iter;

    while (it.next()) |entry| {
        const sortIndex = entry.value_ptr.*;
        const sample: f64 = @floatFromInt(sortIndex.decay.useCounter.swap(0, std.builtin.AtomicOrder.acq_rel));
        sortIndex.decay.freshness = sortIndex.decay.coeff * sortIndex.decay.freshness + (1.0 - sortIndex.decay.coeff) * sample;
        //std.log.err("{any} use: {any} freshness: {any}", .{ entry.key_ptr.*, sample, sortIndex.decay.freshness });
        if (sortIndex.decay.freshness < 0.5) {
            //std.log.err("delete {any}.{any}", .{typeId, sortIndex.field});
            Sort.destroySortIndex(dbCtx, typeId, sortIndex.field, sortIndex.start, sortIndex.langCode);
        }
    }
}

pub fn decay(threads: *Thread.Threads) void {
    var it = threads.ctx.sortIndexes.iterator();
    while (it.next()) |entry| {
        const typeId = entry.key_ptr.*;
        const typeIndex = entry.value_ptr.*;

        sortIndexDecay(threads.ctx, typeId, u16, typeIndex.main.iterator());
        sortIndexDecay(threads.ctx, typeId, u8, typeIndex.field.iterator());
        sortIndexDecay(threads.ctx, typeId, u16, typeIndex.text.iterator());
    }
}

