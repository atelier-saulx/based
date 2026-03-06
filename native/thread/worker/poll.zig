const Thread = @import("../thread.zig");
const std = @import("std");
const utils = @import("../../utils.zig");
const common = @import("../common.zig");
const jemalloc = @import("../../jemalloc.zig");
const Node = @import("../../selva/node.zig");
const Subscription = @import("../../subscription/subscription.zig");
const t = @import("../../types.zig");

const expireMax = 256;

fn handleExpired(threads: *Thread.Threads, msg: []u8) void {
    var count: u32 = 0;

    while (count < expireMax) {
        const res = Node.expirePop(threads.ctx);
        if (res.id == 0) {
            break;
        }

        utils.write(msg, t.ModifyDeleteHeader{
            .op = t.Modify.delete,
            .type = res.type,
            .id = res.id,
            .isTmp = false,
            ._padding = 0,
        }, utils.sizeOf(t.ModifyHeader) + count * utils.sizeOf(t.ModifyDeleteHeader));
        count += 1;
    }

    if (count > 0) {
        utils.write(msg, t.ModifyHeader{
            .opId = 0,
            .opType = t.OpType.modify,
            .schema = 0,
            .count = count,
        }, 0);
        threads.modifyLocked(msg[0..(utils.sizeOf(t.ModifyHeader) + count * utils.sizeOf(t.ModifyDeleteHeader))]) catch |e| {
            std.log.err("Dispatching expire delete(s) failed: {any}", .{ e });
        };
    }
}

pub fn poll(threads: *Thread.Threads) !void {
    const delMsg = jemalloc.alloc(u8, utils.sizeOf(t.ModifyHeader) + expireMax * utils.sizeOf(t.ModifyDeleteHeader));
    defer jemalloc.free(delMsg);

    while (true) {
        std.Thread.sleep(common.SUB_EXEC_INTERVAL);
        const now: u64 = @truncate(@as(u128, @intCast(std.time.nanoTimestamp())));

        threads.mutex.lock();

        if (threads.shutdown) {
            threads.mutex.unlock();
            return;
        }

        handleExpired(threads, delMsg);

        for (threads.threads) |thread| {
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
