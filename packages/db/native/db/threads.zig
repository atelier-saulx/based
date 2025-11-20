const std = @import("std");
const DbCtx = @import("./ctx.zig").DbCtx;
const Thread = std.Thread;
const Mutex = std.Thread.Mutex;
const Condition = std.Thread.Condition;
const utils = @import("../utils.zig");
const getQueryThreaded = @import("../query/query.zig").getQueryThreaded;
const modifyInternal = @import("../modify/modify.zig").modifyInternal;
const selva = @import("../selva.zig").c;
const Queue = std.array_list.Managed([]u8);
const deflate = @import("../deflate.zig");
const writeInt = @import("../utils.zig").writeInt;
const napi = @import("../napi.zig");

const jsResponseFunctions = enum(u32) {
    query = 1,
    modify = 2,
};

pub fn getResultSlice(comptime isQuery: bool, thread: *DbThread, size: usize, id: u32) ![]u8 {
    const paddedSize = size + 8;
    if (isQuery) {
        if (thread.queryResults.len < thread.queryResultsIndex + paddedSize) {
            var increasedSize: usize = 1_000_000;
            if (paddedSize > 1_000_000) {
                increasedSize = (@divTrunc(paddedSize, increasedSize) + 1) * increasedSize;
            }
            thread.queryResults = try std.heap.raw_c_allocator.realloc(
                thread.queryResults,
                thread.queryResults.len + increasedSize,
            );
        }
        writeInt(u32, thread.queryResults, thread.queryResultsIndex, paddedSize);
        writeInt(u32, thread.queryResults, thread.queryResultsIndex + 4, id);
        const data = thread.queryResults[thread.queryResultsIndex + 8 .. thread.queryResultsIndex + paddedSize];
        thread.*.queryResultsIndex = thread.queryResultsIndex + paddedSize;
        return data;
    } else {
        if (thread.modifyResults.len < thread.modifyResultsIndex + paddedSize) {
            var increasedSize: usize = 100_000;
            if (paddedSize > 100_000) {
                increasedSize = (@divTrunc(paddedSize, increasedSize) + 1) * increasedSize;
            }
            thread.modifyResults = try std.heap.raw_c_allocator.realloc(
                thread.modifyResults,
                thread.modifyResults.len + increasedSize,
            );
        }
        writeInt(u32, thread.modifyResults, thread.modifyResultsIndex, paddedSize);
        writeInt(u32, thread.modifyResults, thread.modifyResultsIndex + 4, id);
        const data = thread.modifyResults[thread.modifyResultsIndex + 8 .. thread.modifyResultsIndex + paddedSize];
        thread.*.modifyResultsIndex = thread.modifyResultsIndex + paddedSize;
        return data;
    }
}

pub const DbThread = struct {
    thread: Thread,
    id: usize,
    queryResults: []u8,
    queryResultsIndex: usize,
    modifyResults: []u8,
    modifyResultsIndex: usize,
    decompressor: *deflate.Decompressor,
    libdeflateBlockState: deflate.BlockState,
};

pub const Threads = struct {
    mutex: Mutex = .{},
    threads: []*DbThread,

    pendingQueries: usize = 0,
    pendingModifies: usize = 0,

    wakeup: Condition = .{},
    queryDone: Condition = .{},
    modifyDone: Condition = .{},

    modifyQueue: *Queue,
    nextModifyQueue: *Queue,

    queryQueue: *Queue,
    nextQueryQueue: *Queue,

    shutdown: bool = false,

    ctx: *DbCtx,

    allocator: std.mem.Allocator,

    pub fn waitForModify(self: *Threads) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        std.debug.print("waiting mod \n", .{});
        while (self.pendingModifies > 0) {
            self.modifyDone.wait(&self.mutex);
        }
        std.debug.print("  waiting mod done \n", .{});
    }

    pub fn waitForQueries(self: *Threads) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        std.debug.print("waiting q \n", .{});
        while (self.pendingQueries > 0) {
            self.queryDone.wait(&self.mutex);
        }
        std.debug.print("  waiting q done \n", .{});
    }

    pub fn query(
        self: *Threads,
        queryBuffer: []u8,
    ) !void {
        self.mutex.lock();
        defer self.mutex.unlock();
        // std.debug.print("stage query! mod {any} q {any} \n", .{ self.pendingModifies, self.pendingQueries });
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
        // std.debug.print("stage modify! mod {any} q {any} \n", .{ self.pendingModifies, self.pendingQueries });
        if (self.pendingQueries > 0) {
            try self.nextModifyQueue.append(modifyBuffer);
        } else {
            try self.modifyQueue.append(modifyBuffer);
            self.pendingModifies += 1;
            self.wakeup.signal();
        }
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
                    if (self.queryQueue.items.len > 0) {
                        queryBuf = self.queryQueue.swapRemove(0);
                        break;
                    }

                    if (self.modifyQueue.items.len > 0) {
                        modifyBuf = self.modifyQueue.items[0];
                        break;
                    }

                    self.wakeup.wait(&self.mutex);
                }
            }

            if (queryBuf) |q| {
                // add time measurement
                try getQueryThreaded(self.ctx, q, threadCtx);
                self.mutex.lock();
                self.pendingQueries -= 1;
                if (self.pendingQueries == 0) {
                    self.queryDone.signal();
                    // prob want to call with the call thing
                    self.ctx.jsBridge.call(@intFromEnum(jsResponseFunctions.query), &.{});
                    if (self.nextModifyQueue.items.len > 0) {
                        const prevModifyQueue = self.modifyQueue;
                        self.modifyQueue = self.nextModifyQueue;
                        self.nextModifyQueue = prevModifyQueue;
                        self.pendingModifies = self.modifyQueue.items.len;
                        self.wakeup.broadcast();
                    }
                }
                self.mutex.unlock();
            }

            if (modifyBuf) |m| {
                if (threadCtx.id == 0) {
                    // time measurement?
                    // std.debug.print("Go run mod on thread! \n", .{});
                    var res: u32 = 0;
                    // add dirty ranfges on db ctx
                    try modifyInternal(threadCtx, m, self.ctx, &res);
                    // check how we want to do this to send back information

                    self.mutex.lock();
                    _ = self.modifyQueue.swapRemove(0);
                    self.pendingModifies -= 1;

                    if (self.pendingModifies == 0) {
                        self.modifyDone.signal();
                        // prob want to call with the call thing
                        // just use the bridge with id to select the correct stuff
                        self.ctx.jsBridge.call(@intFromEnum(jsResponseFunctions.modify), &.{});
                        if (self.nextQueryQueue.items.len > 0) {
                            const prevQueryQueue = self.queryQueue;
                            self.queryQueue = self.nextQueryQueue;
                            self.nextQueryQueue = prevQueryQueue;
                            self.pendingQueries = self.queryQueue.items.len;
                            self.wakeup.broadcast();
                        }
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
            .threads = try allocator.alloc(*DbThread, threadAmount),
            .ctx = ctx,
            .modifyQueue = modifyQueue,
            .nextModifyQueue = nextModifyQueue,
            .queryQueue = queryQueue,
            .nextQueryQueue = nextQueryQueue,
        };

        for (self.threads, 0..) |*t, id| {
            const threadCtx = try allocator.create(DbThread);
            threadCtx.*.id = id;
            threadCtx.*.queryResultsIndex = 0;
            threadCtx.*.queryResults = try std.heap.raw_c_allocator.alloc(u8, 0);
            threadCtx.*.modifyResultsIndex = 0;
            threadCtx.*.modifyResults = try std.heap.raw_c_allocator.alloc(u8, 0);
            threadCtx.*.thread = try Thread.spawn(.{}, worker, .{ self, threadCtx });
            threadCtx.*.decompressor = deflate.createDecompressor();
            threadCtx.*.libdeflateBlockState = deflate.initBlockState(305000);
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
            std.heap.raw_c_allocator.free(t.modifyResults);
            self.allocator.destroy(t);
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

// make event loop on main thread (using a timer)
