const Thread = @import("../thread.zig");
const std = @import("std");
const utils = @import("../../utils.zig");
const common = @import("../common.zig");
const jemalloc = @import("../../jemalloc.zig");
const Node = @import("../../selva/node.zig");
const Subscription = @import("../../subscription/subscription.zig");
const SortIndexDecay = @import("../../sort/decay.zig");
const t = @import("../../types.zig");

fn dispatchExpire(threads: *Thread.Threads, msg: []u8) void {
    utils.write(msg, t.ModifyHeader{
        .opId = 0,
        .opType = t.OpType.expire,
        .schema = 0,
        .count = 0,
    }, 0);
    threads.modifyLocked(msg) catch |e| {
        std.log.err("Dispatching expire delete(s) failed: {any}", .{e});
    };
}

pub fn poll(threads: *Thread.Threads) !void {
    var prevSortIndexDecay = std.time.milliTimestamp();
    const expireMsg = jemalloc.alloc(u8, utils.sizeOf(t.ModifyHeader));
    defer jemalloc.free(expireMsg);

    while (true) {
        std.Thread.sleep(common.SUB_EXEC_INTERVAL * 100_000);
        const now = std.time.milliTimestamp();

        threads.mutex.lock();

        if (threads.shutdown) {
            threads.mutex.unlock();
            return;
        }

        dispatchExpire(threads, expireMsg);

        if (now - prevSortIndexDecay >= SortIndexDecay.DECAY_INTERVAL_MS) {
            SortIndexDecay.decay(threads);
            prevSortIndexDecay = now;
        }

        for (threads.threads) |thread| {
            thread.runId = thread.runId +% 1;
            const elapsed = now - thread.lastModifyTime;
            if (elapsed > common.SUB_EXEC_INTERVAL) {
                thread.lastModifyTime = now;
                Subscription.fireIdSubscription(threads, thread) catch |e| {
                    threads.mutex.unlock();
                    return e;
                };
            }
        }

        threads.mutex.unlock();
    }
}
