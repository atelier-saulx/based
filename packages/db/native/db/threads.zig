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
    lastQueryResultIndex: u32,
    // decompressor:
    // subscriptions:
};

pub const Threads = struct {
    mutex: Mutex = .{},
    threads: []DbThread,
    cond: Condition = .{},

    queryDone: Condition = .{},

    shutdown: bool = false,
    ctx: *DbCtx,
    queryQueue: std.ArrayList([]u8),
    modifyQueue: std.ArrayList([]u8),
    allocator: std.mem.Allocator,

    pub fn query(
        self: *Threads,
        queryBuffer: []u8,
    ) !void {
        self.mutex.lock();
        defer self.mutex.unlock();
        // problem if node decides to de-alloc the query buffer
        try self.queryQueue.append(queryBuffer);

        // this is the problem heavy!
        self.cond.signal(); // Wake up one thread - we prop want to batch this is a heavy operation!

        // self.ctx.queryCallback.call(&.{});
        // t.func(t.ctx);
    }

    // modify

    fn worker(self: *Threads, threadCtx: *DbThread) !void {
        while (true) {
            var queryBuf: ?[]u8 = null;

            {
                self.mutex.lock();
                defer self.mutex.unlock();

                while (true) {
                    if (self.shutdown) return;

                    // modify times...
                    // if (self.queryQueue[thread_id].items.len > 0) {
                    //     queryBuf = self.local_queues[thread_id].orderedRemove(0);
                    //     break;
                    // }

                    if (self.queryQueue.items.len > 0) {
                        queryBuf = self.queryQueue.swapRemove(0);
                        break;
                    }

                    // 3. Nothing to do? Sleep.
                    self.cond.wait(&self.mutex);
                }
            }

            if (queryBuf) |_| {
                // const result = try getQueryThreaded(self.ctx, q);
                // this has to return the query
                // const r = try std.heap.raw_c_allocator.alloc(u8, 20);

                if (threadCtx.queryResults.len < threadCtx.lastQueryResultIndex + 20) {
                    threadCtx.queryResults = try std.heap.raw_c_allocator.realloc(
                        threadCtx.queryResults,
                        threadCtx.queryResults.len + 1_000_000,
                    );
                }

                threadCtx.*.lastQueryResultIndex = threadCtx.*.lastQueryResultIndex + 20;
                // std.debug.print("yo yo yo {any} \n", .{threadCtx.*.lastQueryResultIndex});

                // self.ctx.queryCallback.call(result);
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
            .threads = try allocator.alloc(DbThread, threadAmount),
            .queryQueue = std.ArrayList([]u8).init(allocator),
            .modifyQueue = std.ArrayList([]u8).init(allocator),
            .ctx = ctx,
        };

        for (self.threads, 0..) |*t, id| {
            // std.debug.print("threadid: {any} \n", .{id});
            // check if that CTX is ok...
            const threadCtx = try allocator.create(DbThread);
            threadCtx.*.id = id;
            threadCtx.*.lastQueryResultIndex = 0;
            threadCtx.*.queryResults = try std.heap.raw_c_allocator.alloc(u8, 0);
            threadCtx.*.thread = try Thread.spawn(.{}, worker, .{ self, threadCtx });
            t.* = threadCtx.*;
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
            // or t.detach
        }
        self.queryQueue.deinit();
        self.modifyQueue.deinit();
        // self.allocator.free(self.modifyQueue);
    }
};
