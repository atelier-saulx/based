const Thread = @import("../thread.zig");
const t = @import("../../types.zig");
const info = @import("../../selva/info.zig");
const dump = @import("../../selva/dump.zig");
const std = @import("std");
const getQueryThreaded = @import("../../query/query.zig").getQueryThreaded;
const Modify = @import("../../modify/modify.zig");
const Subscription = @import("../../subscription/subscription.zig");
const utils = @import("../../utils.zig");
const selva = @import("../../selva/selva.zig").c;
const jemalloc = @import("../../jemalloc.zig");
const common = @import("../common.zig");
const modifyNotPending = @import("./modifyNotPending.zig").modifyNotPending;

pub fn worker(threads: *Thread.Threads, thread: *common.Thread) !void {
    while (true) {
        var queryBuf: ?[]u8 = null;
        var modifyBuf: ?[]u8 = null;
        var op: t.OpType = t.OpType.noOp;

        threads.mutex.lock();

        if (threads.shutdown) {
            threads.mutex.unlock();
            return;
        }

        if (threads.queryQueue.items.len > 0) {
            queryBuf = threads.queryQueue.swapRemove(0);
            if (queryBuf) |q| {
                op = @enumFromInt(q[4]);
            }
        } else if (threads.modifyQueue.items.len > 0 and
            thread.pendingModifies > 0 and
            thread.currentModifyIndex < threads.modifyQueue.items.len)
        {
            // double check
            modifyBuf = threads.modifyQueue.items[thread.currentModifyIndex];
            if (modifyBuf) |m| {
                op = @enumFromInt(m[4]);
            }
        } else {
            threads.wakeup.wait(&threads.mutex);
        }

        threads.mutex.unlock();

        if (queryBuf) |q| {
            switch (op) {
                .blockHash => try info.blockHash(thread, threads.ctx, q, op),
                .saveBlock => try dump.saveBlock(thread, threads.ctx, q, op),
                .saveAllBlocks => try dump.saveAllBlocks(threads, thread, q, op),
                .noOp => {
                    std.log.err("NO-OP received for query incorrect\n", .{});
                },
                else => {
                    getQueryThreaded(threads.ctx, q, thread) catch |err| {
                        std.log.err("Error query: {any}\n", .{err});
                        // write query error response
                    };
                },
            }

            // prob dont need this... add it specificly
            thread.query.commit();

            threads.mutex.lock();

            threads.pendingQueries -= 1;

            if (threads.pendingQueries == 0) {
                threads.queryDone.signal();
                if (!threads.jsQueryBridgeStaged) {
                    threads.jsQueryBridgeStaged = true;
                    for (threads.threads) |tx| {
                        tx.flushed = false;
                    }
                    threads.ctx.jsBridge.call(t.BridgeResponse.query, 0);
                }
                if (threads.nextModifyQueue.items.len > 0) {
                    const prevModifyQueue = threads.modifyQueue;
                    threads.modifyQueue = threads.nextModifyQueue;
                    threads.nextModifyQueue = prevModifyQueue;
                    threads.pendingModifies = threads.modifyQueue.items.len * threads.threads.len;
                    for (threads.threads) |threadIt| {
                        threadIt.*.pendingModifies = threads.modifyQueue.items.len;
                    }
                    threads.wakeup.broadcast();
                } else {}
            } else if (thread.query.index > 100_000_000 and !threads.jsQueryBridgeStaged) {
                thread.mutex.lock();
                threads.ctx.jsBridge.call(t.BridgeResponse.flushQuery, thread.id);
                thread.flushed = false;
                threads.mutex.unlock();
                while (!thread.flushed) {
                    thread.flushDone.wait(&thread.mutex);
                }
                threads.mutex.lock();
                thread.mutex.unlock();
            }

            threads.mutex.unlock();
        }

        if (modifyBuf) |m| {
            if (thread.id == 0) {
                switch (op) {
                    .emptyMod => {
                        // does nothing but does trigger flush marked subs and maybe more in the future
                    },
                    .modify => try Modify.modify(thread, m, threads.ctx, op),
                    .loadBlock => try dump.loadBlock(thread, threads.ctx, m, op),
                    .unloadBlock => try dump.unloadBlock(thread, threads.ctx, m, op),
                    .loadCommon => try dump.loadCommon(thread, threads.ctx, m, op),

                    .createType => {
                        const typeCode = utils.read(u32, m, 0);
                        const resp = try thread.modify.result(4, typeCode, op);
                        const schema = m[5..m.len];
                        const err = selva.selva_db_create_type(
                            threads.ctx.selva,
                            @truncate(typeCode),
                            schema.ptr,
                            schema.len,
                        );
                        utils.write(resp, err, 0);
                    },
                    // .subscribe => {
                    // _ = try thread.modify.result(0, utils.read(u32, m, 0), op);
                    // },
                    // .unsubscribe => try Subscription.unsubscribe(threads.ctx, m, thread),
                    .setSchemaIds => {
                        _ = try thread.modify.result(0, utils.read(u32, m, 0), op);
                        if (threads.ctx.ids.len > 0) {
                            jemalloc.free(threads.ctx.ids);
                            threads.ctx.ids = &[_]u32{};
                        }
                        threads.ctx.ids = jemalloc.alloc(u32, (m.len - 5) / @sizeOf(u32));
                        const ids = m[5..m.len];
                        utils.byteCopy(threads.ctx.ids, ids, 0);
                    },
                    else => {},
                }
                thread.modify.commit();
                threads.mutex.lock();
                threads.pendingModifies -= 1;
                thread.pendingModifies -= 1;
                thread.currentModifyIndex += 1;
                if (threads.pendingModifies == 0) {
                    modifyNotPending(threads);
                } else if (thread.modify.index > 50_000_000 and !threads.jsModifyBridgeStaged) {
                    thread.mutex.lock();
                    threads.ctx.jsBridge.call(t.BridgeResponse.flushModify, thread.id);
                    thread.flushed = false;
                    threads.mutex.unlock();
                    while (!thread.flushed) {
                        thread.flushDone.wait(&thread.mutex);
                    }
                    threads.mutex.lock();
                    thread.mutex.unlock();
                }
                threads.mutex.unlock();
            } else {
                switch (op) {
                    .emptyMod => {},
                    .modify => {
                        try Modify.subscription(thread, m);
                    },
                    .subscribe => {
                        var index: usize = 0;
                        const subSize = utils.readNext(u32, m, &index);
                        const subHeader = utils.readNext(t.SubscriptionHeader, m, &index);
                        const len = threads.threads.len;
                        if (subHeader.typeId % len == thread.id) {
                            // This can be a bit more efficient
                            // std.debug.print("subscribe on type {d} on thread {d}\n", .{ subHeader.typeId, thread.id });
                            try Subscription.subscribe(thread, m[index..m.len], &subHeader, subSize);
                        }
                    },
                    else => {},
                }

                const now: u64 = @truncate(@as(u128, @intCast(std.time.nanoTimestamp())));
                const elapsed = now - thread.lastModifyTime;

                threads.mutex.lock();

                if (elapsed > common.SUB_EXEC_INTERVAL) {
                    thread.lastModifyTime = now;
                    try Subscription.fireIdSubscription(false, threads, thread);
                }

                threads.pendingModifies -= 1;
                thread.currentModifyIndex += 1;
                thread.pendingModifies -= 1;
                if (threads.pendingModifies == 0) {
                    modifyNotPending(threads);
                }
                threads.mutex.unlock();
            }
        }
    }
}
