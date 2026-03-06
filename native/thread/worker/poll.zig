const Thread = @import("../thread.zig");
const std = @import("std");
const utils = @import("../../utils.zig");
const common = @import("../common.zig");
const jemalloc = @import("../../jemalloc.zig");
const Node = @import("../../selva/node.zig");
const Subscription = @import("../../subscription/subscription.zig");
const t = @import("../../types.zig");

fn handleExpired(threads: *Thread.Threads) void {
    const res = Node.expireTick(threads.ctx);
    const expired = res.nodes[0..res.n];

    for (expired) |node| {

        const msg = jemalloc.alloc(u8, utils.sizeOf(t.ModifyHeader) + utils.sizeOf(t.ModifyDeleteHeader));
        utils.write(msg, t.ModifyHeader{
            .opId = 0,
            .opType = t.OpType.modify,
            .schema = 0,
            .count = 1,
        }, 0);
        utils.write(msg, t.ModifyDeleteHeader{
            .op = t.Modify.delete,
            .type = Node.getNodeTypeId(node.?),
            .id = Node.getNodeId(node.?),
            .isTmp = false,
            ._padding = 0,
        }, utils.sizeOf(t.ModifyHeader));

        threads.modifyLocked(msg) catch |e| {
            std.log.err("Dispatching expire delete failed: {any}", .{ e });
        };
        // TODO Lol we just leaked that buffer
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
                // TODO If this throws the mutex is never released
                try Subscription.fireIdSubscription(threads, thread);
            }
        }

        threads.mutex.unlock();
    }
}
