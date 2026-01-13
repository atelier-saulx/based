const Thread = @import("../thread.zig");
const std = @import("std");
const common = @import("./common.zig");

fn poll(threads: *Thread.Threads) !void {
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

            std.debug.print("FIRE SUBS {any} \n", .{@divFloor(elapsed, 1000_000_000)});
            // just fire from all

            // try Subscription.fireIdSubscription(self, self.threads[self.threads.len - 1]);
            // if (self.pendingModifies == 0) {
            // self.wakeup.signal();
            // }
            // self.wakeup.signal();
        }

        threads.mutex.unlock();
    }
}
