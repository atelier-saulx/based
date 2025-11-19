const std = @import("std");
const DbCtx = @import("./ctx.zig").DbCtx;
const Thread = std.Thread;
const Mutex = std.Thread.Mutex;
const Condition = std.Thread.Condition;
const utils = @import("../utils.zig");

pub const DbThread = struct {
    thread: Thread,
    id: usize,
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

        try self.queryQueue.append(queryBuffer);
        self.cond.signal(); // Wake up one thread

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
                        queryBuf = self.queryQueue.orderedRemove(0);
                        break;
                    }

                    // 3. Nothing to do? Sleep.
                    self.cond.wait(&self.mutex);
                }
            }

            if (queryBuf) |_| {
                const x = try self.ctx.allocator.alloc(u8, 8);

                utils.writeInt(u64, x, 0, threadCtx.id);

                // std.debug.print(
                // "go call query! {any} this is my threadCtx {any} x: {any} \n",
                // .{ q, threadCtx.id, x },
                // );

                self.ctx.queryCallback.call(x);
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
            std.debug.print("threadid: {any} \n", .{id});
            // check if that CTX is ok...
            const threadCtx = try allocator.create(DbThread);
            threadCtx.*.id = id;
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
