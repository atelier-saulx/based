const std = @import("std");
const DbCtx = @import("./ctx.zig").DbCtx;
const Thread = std.Thread;
const Mutex = std.Thread.Mutex;
const Condition = std.Thread.Condition;
const utils = @import("../utils.zig");
const getQueryThreaded = @import("../query/thread/queryThread.zig").getQueryThreaded;
const modifyInternal = @import("../modify/modify.zig").modifyInternal;

const Queue = std.array_list.Managed([]u8);

pub const DbThread = struct {
    thread: Thread,
    id: usize,
    queryResults: []u8,
    lastQueryResultIndex: usize,
    // decompressor:
    // subscriptions:
};

pub const Threads = struct {
    mutex: Mutex = .{},
    threads: []*DbThread,

    pendingQueries: usize = 0,
    pendingModifies: usize = 0,

    wakeup: Condition = .{},
    queryDone: Condition = .{},
    modifyDone: Condition = .{},

    activeModifyQueue: *Queue,
    pendingModifyQueue: *Queue,

    activeQueryQueue: *Queue,
    pendingQueryQueue: *Queue,

    shutdown: bool = false,

    ctx: *DbCtx,

    allocator: std.mem.Allocator,

    pub fn waitForModify(self: *Threads) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        while (self.pendingModifies > 0) {
            self.modifyDone.wait(&self.mutex);
        }
    }

    pub fn waitForQueries(self: *Threads) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        while (self.pendingQueries > 0) {
            self.queryDone.wait(&self.mutex);
        }
    }

    pub fn query(
        self: *Threads,
        queryBuffer: []u8,
    ) !void {
        self.mutex.lock();
        defer self.mutex.unlock();
        // problem if node decides to de-alloc the query buffer
        try self.activeQueryQueue.append(queryBuffer);
        self.pendingQueries += 1;
        self.wakeup.signal(); // wake up one thread - we prop want to batch this is a heavy operation! might be able to make this better
    }

    pub fn modify(
        self: *Threads,
        modifyBuffer: []u8,
    ) !void {
        self.mutex.lock();
        defer self.mutex.unlock();
        // problem if node decides to de-alloc the query buffer
        try self.activeModifyQueue.append(modifyBuffer);
        self.pendingModifies += 1;
        self.wakeup.signal(); // wake up one thread - we prop want to batch this is a heavy operation! might be able to make this better
    }

    fn worker(self: *Threads, threadCtx: *DbThread) !void {
        while (true) {
            var queryBuf: ?[]u8 = null;
            var modifyBuf: ?[]u8 = null;

            {
                self.mutex.lock();
                defer self.mutex.unlock();

                while (true) {
                    if (self.shutdown) return;

                    // if modify is active dont do this
                    if (self.activeQueryQueue.items.len > 0) {
                        queryBuf = self.activeQueryQueue.swapRemove(0);
                        break;
                    }

                    if (self.activeModifyQueue.items.len > 0) {
                        modifyBuf = self.activeModifyQueue.items[0];
                        break;
                    }

                    self.wakeup.wait(&self.mutex);
                }
            }

            if (queryBuf) |q| {
                try getQueryThreaded(self.ctx, q, threadCtx);
                self.mutex.lock();
                self.pendingQueries -= 1;
                if (self.pendingQueries == 0) {
                    self.queryDone.signal();
                }
                self.mutex.unlock();
            }

            if (modifyBuf) |m| {
                if (threadCtx.id == 0) {
                    std.debug.print("go run mod on thread!", .{});
                    var res: u32 = 0;
                    // add dirty ranfges on db ctx
                    try modifyInternal(m, self.ctx, &.{}, &res);
                    _ = self.activeModifyQueue.swapRemove(0);
                    self.mutex.lock();
                    self.pendingModifies -= 1;
                    if (self.pendingModifies == 0) {
                        self.modifyDone.signal();
                    }
                    self.mutex.unlock();
                } else {
                    // add comtime and check for SUBS
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

        const activeModifyQueue = try allocator.create(Queue);
        activeModifyQueue.* = Queue.init(allocator);
        const pendingModifyQueuy = try allocator.create(Queue);
        pendingModifyQueuy.* = Queue.init(allocator);

        const activeQueryQueue = try allocator.create(Queue);
        activeQueryQueue.* = Queue.init(allocator);
        const pendingQueryQueuy = try allocator.create(Queue);
        pendingQueryQueuy.* = Queue.init(allocator);

        self.* = .{
            .allocator = allocator,
            .threads = try allocator.alloc(*DbThread, threadAmount),
            .ctx = ctx,

            .activeModifyQueue = activeModifyQueue,
            .pendingModifyQueue = pendingModifyQueuy,

            .activeQueryQueue = activeQueryQueue,
            .pendingQueryQueue = pendingQueryQueuy,
        };

        for (self.threads, 0..) |*t, id| {
            // std.debug.print("threadid: {any} \n", .{id});
            // check if that CTX is ok...
            const threadCtx = try allocator.create(DbThread);
            threadCtx.*.id = id;
            // threadCtx.*.inProgress = false;
            threadCtx.*.lastQueryResultIndex = 0;
            threadCtx.*.queryResults = try std.heap.raw_c_allocator.alloc(u8, 0);
            threadCtx.*.thread = try Thread.spawn(.{}, worker, .{ self, threadCtx });
            t.* = threadCtx;
        }

        return self;
    }

    pub fn deinit(self: *Threads) void {
        self.mutex.lock();
        self.shutdown = true;
        self.wakeup.broadcast();
        self.mutex.unlock();
        for (self.threads) |t| {
            // see if this is enough...
            t.thread.join();
            std.heap.raw_c_allocator.free(t.queryResults);
            self.allocator.destroy(t);
        }
        self.activeModifyQueue.*.deinit();
        self.pendingModifyQueue.*.deinit();
        self.activeQueryQueue.*.deinit();
        self.pendingQueryQueue.*.deinit();

        self.allocator.destroy(self.activeModifyQueue);
        self.allocator.destroy(self.pendingModifyQueue);
        self.allocator.destroy(self.activeQueryQueue);
        self.allocator.destroy(self.pendingQueryQueue);

        self.allocator.destroy(self);
    }
};

// make event loop on main thread (using a timer)
