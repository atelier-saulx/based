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

        for (threads.threads) |thread| {
            const elapsed = now - thread.lastModifyTime;
            if (elapsed > common.SUB_EXEC_INTERVAL) {
                thread.lastModifyTime = now;
                try Subscription.fireIdSubscription(threads, thread);
            }
        }

        threads.mutex.unlock();
    }
}
