const Thread = @import("../thread.zig");
const std = @import("std");
const common = @import("../common.zig");
const Subscription = @import("../../subscription/subscription.zig");

pub fn poll(threads: *Thread.Threads) !void {
    while (true) {
        std.Thread.sleep(common.SUB_EXEC_INTERVAL);
        const now: u64 = @truncate(@as(u128, @intCast(std.time.nanoTimestamp())));
        threads.mutex.lock();
        if (threads.shutdown) {
            threads.mutex.unlock();
            return;
        }
        const elapsed = now - threads.lastModifyTime;

        if (elapsed > common.SUB_EXEC_INTERVAL) {
            threads.lastModifyTime = now;
            try Subscription.fireIdSubscription(threads, threads.threads[threads.threads.len - 1]);
            for (threads.threads) |thread| {
                try Subscription.fireIdSubscription(threads, thread);
            }
        }

        threads.mutex.unlock();
    }
}
