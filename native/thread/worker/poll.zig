const Thread = @import("../thread.zig");
const std = @import("std");
const common = @import("../common.zig");
const jemalloc = @import("../../jemalloc.zig");
const Node = @import("../../selva/node.zig");
const Subscription = @import("../../subscription/subscription.zig");
const t = @import("../../types.zig");

fn handleExpired(threads: *Thread.Threads) void {
    const res = Node.expireTick(threads.ctx);
    const expired = res.nodes[0..res.n];

    for (expired) |node| {
        var msg = jemalloc.create(t.ModifyDeleteHeader);
        msg.* = t.ModifyDeleteHeader{
            .op = t.Modify.delete,
            .type = Node.getNodeTypeId(node.?),
            .id = Node.getNodeId(node.?),
            .isTmp = false,
            ._padding = 0,
        };

        threads.modifyLocked(@ptrCast(&msg)) catch |e| {
            std.log.err("Dispatching expire delete failed: {any}", .{ e });
        };
    }
}

pub fn poll(threads: *Thread.Threads) !void {
    while (true) {
        std.Thread.sleep(common.SUB_EXEC_INTERVAL);
        const now: u64 = @truncate(@as(u128, @intCast(std.time.nanoTimestamp())));

        threads.mutex.lock();

        if (threads.shutdown) {
            threads.mutex.unlock();
            return;
        }

        handleExpired(threads);

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
