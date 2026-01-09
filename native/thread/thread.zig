const std = @import("std");
const jsBridge = @import("jsBridge.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;
const utils = @import("../utils.zig");
const Modify = @import("../modify/modify.zig");
const SelvaHash128 = @import("../string.zig").SelvaHash128;
const selva = @import("../selva/selva.zig").c;
const dump = @import("../selva/dump.zig");
const info = @import("../selva/info.zig");
const getQueryThreaded = @import("../query/query.zig").getQueryThreaded;
const common = @import("common.zig");
const t = @import("../types.zig");
const Subscription = @import("../subscription/subscription.zig");
const jemalloc = @import("../jemalloc.zig");

pub const Thread = common.Thread;
const Queue = std.array_list.Managed([]u8);

pub const Threads = struct {
    // get rid of all the auto init things
    mutex: std.Thread.Mutex = .{},
    threads: []*Thread,
    pendingQueries: usize = 0,
    pendingModifies: usize = 0,
    makingSortIndexes: usize = 0,
    wakeup: std.Thread.Condition = .{},
    queryDone: std.Thread.Condition = .{},
    modifyDone: std.Thread.Condition = .{},
    sortDone: std.Thread.Condition = .{},
    modifyQueue: *Queue,
    nextModifyQueue: *Queue,
    queryQueue: *Queue,
    nextQueryQueue: *Queue,
    shutdown: bool = false,
    jsQueryBridgeStaged: bool = false,
    jsModifyBridgeStaged: bool = false,
    ctx: *DbCtx,
    allocator: std.mem.Allocator,

    pub inline fn waitForQuery(self: *Threads) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        while (self.pendingQueries > 0) {
            self.queryDone.wait(&self.mutex);
        }
    }

    pub inline fn waitForModify(self: *Threads) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        while (self.pendingModifies > 0) {
            self.modifyDone.wait(&self.mutex);
        }
    }

    pub inline fn modifyIsReady(self: *Threads) bool {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.pendingModifies > 0) {
            return false;
        }
        return true;
    }

    pub inline fn queryIsReady(self: *Threads) bool {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.pendingQueries > 0) {
            return false;
        }
        return true;
    }

    pub fn query(
        self: *Threads,
        queryBuffer: []u8,
    ) !void {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.pendingModifies > 0) {
            try self.nextQueryQueue.append(queryBuffer);
        } else {
            try self.queryQueue.append(queryBuffer);
            self.pendingQueries += 1;
            self.wakeup.signal();
        }
    }

    pub fn modify(
        self: *Threads,
        modifyBuffer: []u8,
    ) !void {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.pendingQueries > 0) {
            try self.nextModifyQueue.append(modifyBuffer);
        } else {
            try self.modifyQueue.append(modifyBuffer);
            self.pendingModifies += 1;
            for (self.threads) |thread| {
                thread.*.pendingModifies += 1;
            }
            self.wakeup.broadcast();
        }
    }

    inline fn modifyNotPending(
        self: *Threads,
    ) void {
        for (self.threads) |thread| {
            if (thread.pendingModifies != 0) {
                return;
            }
        }

        while (self.modifyQueue.items.len > 0) {
            _ = self.modifyQueue.swapRemove(0);
        }

        for (self.threads) |thread| {
            thread.currentModifyIndex = 0;
        }

        self.modifyDone.signal();
        if (!self.jsModifyBridgeStaged) {
            self.ctx.jsBridge.call(t.BridgeResponse.modify, 0);
            self.jsModifyBridgeStaged = true;
        }
        if (self.nextQueryQueue.items.len > 0) {
            const prevQueryQueue = self.queryQueue;
            self.queryQueue = self.nextQueryQueue;
            self.nextQueryQueue = prevQueryQueue;
            self.pendingQueries = self.queryQueue.items.len;
            self.wakeup.broadcast();
        }
    }

    fn worker(self: *Threads, thread: *Thread) !void {
        while (true) {
            var queryBuf: ?[]u8 = null;
            var modifyBuf: ?[]u8 = null;
            var op: t.OpType = t.OpType.noOp;

            self.mutex.lock();

            if (self.shutdown) {
                self.mutex.unlock();
                return;
            }

            if (self.queryQueue.items.len > 0) {
                queryBuf = self.queryQueue.swapRemove(0);
                if (queryBuf) |q| {
                    op = @enumFromInt(q[4]);
                }
            } else if (self.modifyQueue.items.len > 0 and
                thread.pendingModifies > 0 and
                thread.currentModifyIndex < self.modifyQueue.items.len)
            {
                modifyBuf = self.modifyQueue.items[thread.currentModifyIndex];
                if (modifyBuf) |m| {
                    op = @enumFromInt(m[4]);
                }
            } else {
                self.wakeup.wait(&self.mutex);
            }

            self.mutex.unlock();

            if (queryBuf) |q| {
                switch (op) {
                    .blockHash => try info.blockHash(thread, self.ctx, q, op),
                    .saveBlock => try dump.saveBlock(thread, self.ctx, q, op),
                    .saveCommon => try dump.saveCommon(thread, self.ctx, q, op),
                    .noOp => {
                        std.log.err("NO-OP received for query incorrect \n", .{});
                    },
                    else => {
                        getQueryThreaded(self.ctx, q, thread) catch |err| {
                            std.log.err("Error query: {any}", .{err});
                            // write query error response
                        };
                    },
                }

                thread.query.commit();

                self.mutex.lock();

                self.pendingQueries -= 1;

                if (self.pendingQueries == 0) {
                    self.queryDone.signal();
                    if (!self.jsQueryBridgeStaged) {
                        self.jsQueryBridgeStaged = true;
                        for (self.threads) |tx| {
                            tx.flushed = false;
                        }
                        self.ctx.jsBridge.call(t.BridgeResponse.query, 0);
                    }
                    if (self.nextModifyQueue.items.len > 0) {
                        const prevModifyQueue = self.modifyQueue;
                        self.modifyQueue = self.nextModifyQueue;
                        self.nextModifyQueue = prevModifyQueue;
                        self.pendingModifies = self.modifyQueue.items.len;
                        for (self.threads) |threadIt| {
                            threadIt.*.pendingModifies = self.modifyQueue.items.len;
                        }
                        self.wakeup.broadcast();
                    } else {}
                } else if (thread.query.index > 100_000_000 and !self.jsQueryBridgeStaged) {
                    thread.mutex.lock();
                    self.ctx.jsBridge.call(t.BridgeResponse.flushQuery, thread.id);
                    thread.flushed = false;
                    self.mutex.unlock();
                    while (!thread.flushed) {
                        thread.flushDone.wait(&thread.mutex);
                    }
                    self.mutex.lock();
                    thread.mutex.unlock();
                }

                self.mutex.unlock();
            }

            if (modifyBuf) |m| {
                if (thread.id == 0) {
                    switch (op) {
                        .modify => try Modify.modify(thread, m, self.ctx, op),
                        .loadBlock => try dump.loadBlock(thread, self.ctx, m, op),
                        .unloadBlock => try dump.unloadBlock(thread, self.ctx, m, op),
                        .loadCommon => try dump.loadCommon(thread, self.ctx, m, op),
                        .createType => {
                            const typeCode = utils.read(u32, m, 0);
                            const resp = try thread.modify.result(4, typeCode, op);
                            const schema = m[5..m.len];
                            const err = selva.selva_db_create_type(
                                self.ctx.selva,
                                @truncate(typeCode),
                                schema.ptr,
                                schema.len,
                            );
                            utils.write(resp, err, 0);
                        },
                        .subscribe => try Subscription.subscribe(self.ctx, m, thread),
                        .unsubscribe => try Subscription.unsubscribe(self.ctx, m, thread),
                        .setSchemaIds => {
                            _ = try thread.modify.result(0, utils.read(u32, m, 0), op);
                            if (self.ctx.ids.len > 0) {
                                self.ctx.allocator.free(self.ctx.ids);
                                self.ctx.ids = &[_]u32{};
                            }
                            self.ctx.ids = try self.ctx.allocator.alloc(u32, (m.len - 5) / @sizeOf(u32));
                            const ids = m[5..m.len];
                            utils.byteCopy(self.ctx.ids, ids, 0);
                        },
                        else => {},
                    }
                    thread.modify.commit();

                    self.mutex.lock();
                    self.pendingModifies -= 1;
                    thread.pendingModifies -= 1;
                    thread.currentModifyIndex += 1;

                    if (self.pendingModifies == 0) {
                        self.modifyNotPending();
                    } else if (thread.modify.index > 50_000_000 and !self.jsModifyBridgeStaged) {
                        thread.mutex.lock();
                        self.ctx.jsBridge.call(t.BridgeResponse.flushModify, thread.id);
                        thread.flushed = false;
                        self.mutex.unlock();
                        while (!thread.flushed) {
                            thread.flushDone.wait(&thread.mutex);
                        }
                        self.mutex.lock();
                        thread.mutex.unlock();
                    }
                    self.mutex.unlock();
                } else {
                    // Subscription worker
                    self.mutex.lock();
                    thread.currentModifyIndex += 1;
                    thread.pendingModifies -= 1;
                    if (self.pendingModifies == 0) {
                        self.modifyNotPending();
                    }
                    self.mutex.unlock();
                }
            }
        }
    }

    pub fn init(
        allocator: std.mem.Allocator,
        threadAmount: usize,
        ctx: *DbCtx,
    ) !*Threads {
        const self = try allocator.create(Threads);

        const modifyQueue = try allocator.create(Queue);
        modifyQueue.* = Queue.init(allocator);
        const nextModifyQueue = try allocator.create(Queue);
        nextModifyQueue.* = Queue.init(allocator);

        const queryQueue = try allocator.create(Queue);
        queryQueue.* = Queue.init(allocator);
        const nextQueryQueue = try allocator.create(Queue);
        nextQueryQueue.* = Queue.init(allocator);

        self.* = .{
            .allocator = allocator,
            .threads = try allocator.alloc(*Thread, threadAmount),
            .ctx = ctx,
            .modifyQueue = modifyQueue,
            .nextModifyQueue = nextModifyQueue,
            .queryQueue = queryQueue,
            .nextQueryQueue = nextQueryQueue,
        };

        for (self.threads, 0..) |*threadContainer, id| {
            const thread = try Thread.init(allocator, id);
            thread.*.thread = try std.Thread.spawn(.{}, worker, .{ self, thread });
            threadContainer.* = thread;
        }

        return self;
    }

    pub fn deinit(self: *Threads) void {
        self.mutex.lock();
        self.shutdown = true;
        for (self.threads) |threadContainer| {
            threadContainer.mutex.lock();
            threadContainer.flushed = true;
            threadContainer.flushDone.signal();
            threadContainer.mutex.unlock();
        }
        self.wakeup.broadcast();
        self.mutex.unlock();
        for (self.threads) |threadContainer| {
            threadContainer.deinit();
        }
        self.modifyQueue.*.deinit();
        self.nextModifyQueue.*.deinit();
        self.queryQueue.*.deinit();
        self.nextQueryQueue.*.deinit();
        self.allocator.destroy(self.modifyQueue);
        self.allocator.destroy(self.nextModifyQueue);
        self.allocator.destroy(self.queryQueue);
        self.allocator.destroy(self.nextQueryQueue);
        self.allocator.destroy(self);
    }
};
