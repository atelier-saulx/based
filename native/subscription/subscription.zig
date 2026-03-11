const std = @import("std");
const errors = @import("../errors.zig");
const Subscription = @import("common.zig");
const utils = @import("../utils.zig");
const Thread = @import("../thread/thread.zig");
const t = @import("../types.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;
const napi = @import("../napi.zig");
const Id = @import("singleId.zig");
const Fields = @import("../selva/fields.zig");
const Node = @import("../selva/node.zig");
const shared = @import("./shared.zig");
const radix = @import("./radix.zig");
const jemalloc = @import("../jemalloc.zig");

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

pub fn subscribe(thread: *Thread.Thread, buf: []u8, threads: *Thread.Threads) !void {
    var i: usize = 4;
    const subHeader = utils.readNext(t.SubscriptionHeader, buf, &i);
    if (subHeader.typeId % threads.threads.len != thread.id) return;
    const fields = utils.sliceNext(subHeader.fieldsLen, buf, &i);
    const partialFields = utils.sliceNext(subHeader.partialLen * 2, buf, &i);
    const query = buf[i..];
    i = 0;
    const subId = utils.readNext(u32, query, &i);
    const queryType: t.OpType = @enumFromInt(query[i]);

    switch (queryType) {
        .id, .idFilter => {
            const header = utils.readNext(t.QueryHeaderSingle, query, &i);
            try Id.addIdSubscription(thread, query, partialFields, fields, subId, &header, &subHeader);
        },
        .alias => {
            std.debug.print("disabled alias sub, TODO\n", .{});
            // var header = utils.readNext(t.QueryHeaderSingle, query, &i);
            // const typeEntry = try Node.getType(db, header.typeId);
            // const aliasValue = utils.sliceNext(header.aliasSize, query, &i);
            // // TODO: this part only needs to happen in query
            // if (Fields.getAliasByName(typeEntry, header.prop, aliasValue)) |node| {
            //     header.id = Node.getNodeId(node);
            // }
            // try Id.addIdSubscription(thread, query, partialFields, fields, subId, &header, &subHeader);
            // // add the alias store
            // const typeSubs = try shared.upsertSubType(thread, header.typeId);
            // if (typeSubs.aliasSubs.contains(header.prop)) {
            //     const aliasSubs = typeSubs.aliasSubs.get(header.prop).?;
            //     try aliasSubs.insert(aliasValue, subId);
            // } else {
            //     const memory_block = jemalloc.alloc(u8, 4096);
            //     const aliasSubs = jemalloc.create(radix.RadixTree);
            //     aliasSubs.* = try radix.RadixTree.init(memory_block);
            //     try typeSubs.aliasSubs.put(header.prop, aliasSubs);
            //     try aliasSubs.insert(aliasValue, subId);
            // }
        },
        else => {
            // multi - has to be scheduled for the specific thread handle this when flushing
            // query -> [4] - select THREAD
            // not handled yet
        },
    }
}

pub fn unsubscribe(
    thread: *Thread.Thread,
    buf: []u8,
    db: *DbCtx,
) !void {
    const subId = utils.read(u32, buf, 0);
    if (thread.subscriptions.subsHashMap.get(subId)) |sub| {
        Id.removeIdSubscription(db, thread, subId, sub.typeId, sub.id);
        // remove alias
    }
}
