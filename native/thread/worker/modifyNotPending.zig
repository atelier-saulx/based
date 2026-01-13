const Thread = @import("../thread.zig");
const t = @import("../../types.zig");
const std = @import("std");

pub inline fn modifyNotPending(
    threads: *Thread.Threads,
) void {
    while (threads.modifyQueue.items.len > 0) {
        _ = threads.modifyQueue.swapRemove(0);
    }
    for (threads.threads) |thread| {
        thread.currentModifyIndex = 0;
    }

    threads.modifyDone.signal();
    if (!threads.jsModifyBridgeStaged) {
        // allways thread zero
        threads.ctx.jsBridge.call(t.BridgeResponse.modify, 0);
        threads.jsModifyBridgeStaged = true;
    }
    if (threads.nextQueryQueue.items.len > 0) {
        const prevQueryQueue = threads.queryQueue;
        threads.queryQueue = threads.nextQueryQueue;
        threads.nextQueryQueue = prevQueryQueue;
        threads.pendingQueries = threads.queryQueue.items.len;
        threads.wakeup.broadcast();
    }
}
