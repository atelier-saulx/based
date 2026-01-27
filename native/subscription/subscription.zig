const std = @import("std");
const errors = @import("../errors.zig");
const Subscription = @import("common.zig");
const utils = @import("../utils.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;
const napi = @import("../napi.zig");
const Id = @import("singleId.zig");

pub fn fireIdSubscription(threads: *Thread.Threads, thread: *Thread.Thread) !void {
    if (thread.subscriptions.lastIdMarked > 0) {
        var i: usize = 0;
        while (i < thread.subscriptions.lastIdMarked) {
            const subId = thread.subscriptions.singleIdMarked[i];
            if (thread.subscriptions.subsHashMap.get(subId)) |sub| {
                sub.*.marked = Subscription.SubStatus.all;
                if (threads.pendingModifies > 0) {
                    try threads.nextQueryQueue.append(sub.*.query);
                } else {
                    try threads.queryQueue.append(sub.*.query);
                    threads.pendingQueries += 1;
                }
            }
            i += 1;
        }
        thread.subscriptions.lastIdMarked = 0;
        if (threads.pendingModifies == 0) {
            threads.wakeup.signal();
        }
    }
}

pub fn subscribe(
    thread: *Thread.Thread,
    buffer: []u8,
    subHeader: *const t.SubscriptionHeader,
    subSize: u32,
) !void {
    var index: usize = 0;
    const fields = utils.sliceNext(subHeader.fieldsLen, buffer, &index);
    const partialFields = utils.sliceNext(subHeader.partialLen * 2, buffer, &index);
    const query = utils.sliceNext(buffer.len - subSize, buffer, &index);
    index = 0;
    const subId = utils.readNext(u32, query, &index);
    const queryType: t.OpType = @enumFromInt(query[index]);
    switch (queryType) {
        .id, .idFilter => {
            const header = utils.readNext(t.QueryHeaderSingle, query, &index);
            try Id.addIdSubscription(thread, query, partialFields, fields, subId, &header, subHeader);
        },
        else => {
            // multi - has to be scheduled for the specific thread handle this when flushing
            // query -> [4] - select THREAD
            // not handled yet
        },
    }
}

pub fn unsubscribe(
    dbCtx: *DbCtx,
    buffer: []u8,
    thread: *Thread.Thread,
) !void {
    // only needs SUB-ID
    std.debug.print("unsubscribe {any} {any} {any}   \n", .{ dbCtx, buffer, thread });
}
