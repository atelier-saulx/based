const std = @import("std");
const errors = @import("../errors.zig");
const Subscription = @import("common.zig");
const utils = @import("../utils.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;
const napi = @import("../napi.zig");
const Id = @import("./singleId.zig");

pub fn fireIdSubscription(threads: *Thread.Threads, thread: *Thread.Thread) !void {
    if (thread.subscriptions.lastIdMarked > 0) {
        var i: usize = 0;
        while (i < thread.subscriptions.lastIdMarked) {
            const subId = thread.subscriptions.singleIdMarked[i];
            if (thread.subscriptions.subsHashMap.get(subId)) |sub| {
                sub.*.marked = Subscription.SubStatus.all;

                if (threads.pendingModifies > 0) {
                    std.debug.print("BLA => q mod is pending \n", .{});
                    try threads.nextQueryQueue.append(sub.*.query);
                } else {
                    try threads.queryQueue.append(sub.*.query);
                    threads.pendingQueries += 1;
                    // threads.wakeup.signal();
                }
                // try threads.query(sub.*.query);
            }
            i += 1;
        }
        thread.subscriptions.lastIdMarked = 0;
    } else {
        // _ = try thread.query.result(0, utils.read(u32, q, 0), op);
    }
}

pub fn subscribe(
    thread: *Thread.Thread,
    buffer: []u8,
) !void {
    var index: usize = 0;
    const subSize = utils.readNext(u32, buffer, &index);
    const subHeader = utils.readNext(t.SubscriptionHeader, buffer, &index);
    const fields = utils.sliceNext(subHeader.fieldsLen, buffer, &index);
    const partialFields = utils.sliceNext(subHeader.partialLen * 2, buffer, &index);
    const query = utils.sliceNext(buffer.len - subSize, buffer, &index);
    index = 0;
    const subId = utils.readNext(u32, query, &index);
    const queryType: t.OpType = @enumFromInt(query[index]);
    // here we allrdy get the thread so we need a fn that goes before this and assigns to the correct thread
    switch (queryType) {
        .id, .idFilter => {
            const header = utils.readNext(t.QueryHeaderSingle, query, &index);
            try Id.addIdSubscription(thread, query, partialFields, fields, subId, &header, &subHeader);
        },
        else => {
            // not handled yet
        },
    }
}

pub fn unsubscribe(
    dbCtx: *DbCtx,
    buffer: []u8,
    thread: *Thread.Thread,
) !void {
    // needs to find the correct thread
    // only needs SUB-ID
    std.debug.print("unsubscribe {any} {any} {any}   \n", .{ dbCtx, buffer, thread });
    // ----

}
