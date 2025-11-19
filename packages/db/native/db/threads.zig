const std = @import("std");
const DbCtx = @import("./ctx.zig").DbCtx;
const Thread = std.Thread;
const Mutex = std.Thread.Mutex;
const Condition = std.Thread.Condition;
const utils = @import("../utils.zig");
const getQueryThreaded = @import("../query/thread/queryThread.zig").getQueryThreaded;

pub const DbThread = struct {
    thread: Thread,
    id: usize,
    queryResults: []u8,
    lastQueryResultIndex: usize,
    // inProgress: bool,
    // decompressor:
    // subscriptions:
};

pub const Threads = struct {
    mutex: Mutex = .{},
    threads: []*DbThread,
    cond: Condition = .{},
    pendingWork: usize = 0,
    queryDone: Condition = .{},

    shutdown: bool = false,
    ctx: *DbCtx,
    queryQueue: std.ArrayList([]u8),
    modifyQueue: std.ArrayList([]u8),
    allocator: std.mem.Allocator,

    pub fn waitForAll(self: *Threads) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        // std.debug.print("wait ?{any} \n", .{self.pendingWork});
        while (self.pendingWork > 0) {
            self.queryDone.wait(&self.mutex);
        }
        // std.debug.print(". DONE ?{any} \n", .{self.pendingWork});
    }

    pub fn query(
        self: *Threads,
        queryBuffer: []u8,
    ) !void {
        self.mutex.lock();
        defer self.mutex.unlock();
        // problem if node decides to de-alloc the query buffer
        try self.queryQueue.append(queryBuffer);
        self.pendingWork += 1;

        // if modifyInProgress WAIT
        // then send signal
        // set state to HANDLING MODIFY
        // and set state to HANDELING QUERY

        self.cond.signal(); // Wake up one thread - we prop want to batch this is a heavy operation! might be able to make this better
    }

    fn worker(self: *Threads, threadCtx: *DbThread) !void {
        while (true) {
            var queryBuf: ?[]u8 = null;

            {
                self.mutex.lock();
                defer self.mutex.unlock();

                while (true) {
                    if (self.shutdown) return;

                    if (self.queryQueue.items.len > 0) {
                        // orderedRemove
                        queryBuf = self.queryQueue.swapRemove(0);
                        // threadCtx.*.inProgress = true;
                        break;
                    }

                    // threadCtx.*.inProgress = false;
                    // self.pendingWork -= 1;
                    // if (self.pendingWork == 0) {
                    //     self.queryDone.signal(); // or broadcast() if multiple listeners
                    // }

                    // 3. Nothing to do? Sleep.
                    self.cond.wait(&self.mutex);
                }
            }

            if (queryBuf) |q| {
                // const result = try getQueryThreaded(self.ctx, q);
                // this has to return the query
                // const r = try std.heap.raw_c_allocator.alloc(u8, 20);
                // threadCtx.*.inProgress = true;
                try getQueryThreaded(self.ctx, q, threadCtx);

                // threadCtx.*.inProgress = false;

                self.mutex.lock();
                self.pendingWork -= 1;

                if (self.pendingWork == 0) {
                    self.queryDone.signal(); // or broadcast() if multiple listeners
                }
                self.mutex.unlock();
            }
        }
    }

    pub fn init(
        allocator: std.mem.Allocator,
        threadAmount: usize,
        ctx: *DbCtx,
    ) !*Threads {
        const self = try allocator.create(Threads);
        self.* = .{
            .allocator = allocator,
            .threads = try allocator.alloc(*DbThread, threadAmount),
            .queryQueue = std.ArrayList([]u8).init(allocator),
            .modifyQueue = std.ArrayList([]u8).init(allocator),
            .ctx = ctx,
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
        self.cond.broadcast();
        self.mutex.unlock();
        for (self.threads) |t| {
            // see if this is enough...
            t.thread.join();
            self.allocator.destroy(t);
            // or t.detach
        }
        self.queryQueue.deinit();
        self.modifyQueue.deinit();
        // self.allocator.free(self.modifyQueue);
    }
};
