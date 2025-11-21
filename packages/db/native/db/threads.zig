const std = @import("std");
const DbCtx = @import("./ctx.zig").DbCtx;
const Thread = std.Thread;
const Mutex = std.Thread.Mutex;
const Condition = std.Thread.Condition;
const utils = @import("../utils.zig");
const Query = @import("../query/query.zig");
const Modify = @import("../modify/modify.zig");
const selva = @import("../selva.zig").c;
const deflate = @import("../deflate.zig");
const writeInt = @import("../utils.zig").writeInt;
const jsBridge = @import("./jsBridge.zig");
const sort = @import("./sort.zig");

const Queue = std.array_list.Managed([]u8);

pub fn getResultSlice(
    comptime isQuery: bool,
    thread: *DbThread,
    size: usize,
    id: u32,
    subType: if (isQuery) Query.QueryType else Modify.ModifyType,
) ![]u8 {
    const offset = 9;
    const paddedSize = size + offset;
    var increasedSize: usize = if (isQuery) 1_000_000 else 100_000;
    if (isQuery) {
        if (thread.queryResults.len < thread.queryResultsIndex + paddedSize) {
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
        thread.queryResults[thread.queryResultsIndex + 8] = @intFromEnum(subType);
        const data = thread.queryResults[thread.queryResultsIndex + offset .. thread.queryResultsIndex + paddedSize];
        thread.*.queryResultsIndex = thread.queryResultsIndex + paddedSize;
        return data;
    } else {
        if (thread.modifyResults.len < thread.modifyResultsIndex + paddedSize) {
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
        thread.modifyResults[thread.modifyResultsIndex + 8] = @intFromEnum(subType);
        const data = thread.modifyResults[thread.modifyResultsIndex + offset .. thread.modifyResultsIndex + paddedSize];
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
    pendingModifies: usize,
    sortIndex: ?*sort.SortIndexMeta,
};

pub const Threads = struct {
    mutex: Mutex = .{},
    threads: []*DbThread,

    pendingQueries: usize = 0,
    pendingModifies: usize = 0,

    wakeup: Condition = .{},
    queryDone: Condition = .{},
    modifyDone: Condition = .{},

    sortDone: Condition = .{},
    makingSortIndexes: usize = 0,
    // makingSortIndexes = [std.Thread.getCpuCount() - 1].{[5]u8},

    modifyQueue: *Queue,
    nextModifyQueue: *Queue,

    queryQueue: *Queue,
    nextQueryQueue: *Queue,

    shutdown: bool = false,

    jsQueryBridgeStaged: bool = false,

    jsModifyBridgeStaged: bool = false,

    ctx: *DbCtx,

    allocator: std.mem.Allocator,

    pub fn waitForQuery(self: *Threads) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        while (self.pendingQueries > 0) {
            std.debug.print("wait for q\n", .{});
            self.queryDone.wait(&self.mutex);
            std.debug.print(" wait for q done\n", .{});
        }
    }

    pub fn waitForModify(self: *Threads) void {
        self.mutex.lock();
        defer self.mutex.unlock();
        while (self.pendingModifies > 0) {
            std.debug.print("wait for m\n", .{});
            self.modifyDone.wait(&self.mutex);
            std.debug.print(" wait for m done\n", .{});
        }
    }

    pub fn modifyIsReady(self: *Threads) bool {
        self.mutex.lock();
        defer self.mutex.unlock();
        if (self.pendingModifies > 0) {
            return false;
        }
        return true;
    }

    pub fn queryIsReady(self: *Threads) bool {
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

    fn modifyNotPending(self: *Threads) void {
        for (self.threads) |thread| {
            if (thread.pendingModifies != 0) {
                return;
            }
        }

        self.modifyDone.signal();

        if (!self.jsModifyBridgeStaged) {
            self.ctx.jsBridge.call(jsBridge.BridgeResponse.modify);
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

    fn worker(self: *Threads, threadCtx: *DbThread) !void {
        while (true) {
            var queryBuf: ?[]u8 = null;
            var modifyBuf: ?[]u8 = null;
            var modIndex: usize = 0;

            threadCtx.sortIndex = null;

            self.mutex.lock();

            if (self.shutdown) {
                self.mutex.unlock();
                return;
            }

            if (self.queryQueue.items.len > 0) {
                queryBuf = self.queryQueue.swapRemove(0);
                if (queryBuf) |q| {
                    const queryType: Query.QueryType = @enumFromInt(q[4]);
                    // make function for this
                    if (queryType == Query.QueryType.default) {
                        const typeId = utils.read(u16, q, 5);

                        std.debug.print("derp typeId {any} {any} \n", .{ typeId, q });

                        // index += 1;
                        // const typeId = utils.read(u16, q, index);
                        // index += 2;

                        // index += 4;
                        // index += 4;

                        // const filterSize = utils.read(u16, q, index);
                        // index += 2;
                        // index += 1;
                        // index += filterSize;

                        // const sortSize = utils.read(u16, q, index);
                        // index += 2;
                        // const sortBuf = q[index .. index + sortSize];
                        // index += sortSize;

                        // if (sortSize > 0) {
                        //     if (sort.getSortIndexFromBuffer(self.ctx, typeId, sortBuf)) |sortMetaIndex| {
                        //         threadCtx.sortIndex = sortMetaIndex;
                        //     } else {
                        //         threadCtx.sortIndex = try sort.createSortIndexFromBuffer(
                        //             self.ctx,
                        //             threadCtx.decompressor,
                        //             typeId,
                        //             sortBuf,
                        //         );
                        //     }
                        // }
                    }
                }
            } else if (self.modifyQueue.items.len > 0 and threadCtx.pendingModifies > 0) {
                modifyBuf = self.modifyQueue.items[0];
                modIndex = self.modifyQueue.items.len;
            } else {
                self.wakeup.wait(&self.mutex);
            }

            self.mutex.unlock();

            if (queryBuf) |q| {
                if (q[4] == 67) {
                    std.debug.print("SAVE COMMAND\n", .{});
                    const queryType: Query.QueryType = @enumFromInt(q[4]);
                    const data = try getResultSlice(
                        true,
                        threadCtx,
                        1,
                        utils.read(u32, q, 0),
                        queryType,
                    );
                    data[0] = 67;
                } else {
                    try Query.getQueryThreaded(self.ctx, q, threadCtx);
                }

                self.mutex.lock();
                self.pendingQueries -= 1;

                // If results size is too large move stuff to next query

                if (self.pendingQueries == 0) {
                    self.queryDone.signal();

                    if (!self.jsQueryBridgeStaged) {
                        self.jsQueryBridgeStaged = true;
                        self.ctx.jsBridge.call(jsBridge.BridgeResponse.query);
                    }

                    if (self.nextModifyQueue.items.len > 0) {
                        const prevModifyQueue = self.modifyQueue;
                        self.modifyQueue = self.nextModifyQueue;
                        self.nextModifyQueue = prevModifyQueue;
                        self.pendingModifies = self.modifyQueue.items.len;
                        for (self.threads) |thread| {
                            thread.*.pendingModifies = self.modifyQueue.items.len;
                        }
                        self.wakeup.broadcast();
                    } else {}
                }
                self.mutex.unlock();
            }

            if (modifyBuf) |m| {
                // special id is pos you can use it here [4] 🤪
                // add block amoutn to load in buffer
                // then check threads amount
                // % what your work is

                if (threadCtx.id == 0) {

                    // Modify worker
                    try Modify.modify(threadCtx, m, self.ctx);
                    self.mutex.lock();
                    _ = self.modifyQueue.swapRemove(0);
                    self.pendingModifies -= 1;
                    threadCtx.pendingModifies -= 1;
                    if (self.pendingModifies == 0) {
                        self.modifyNotPending();
                    }
                    self.mutex.unlock();
                } else {
                    // Subscription worker
                    self.mutex.lock();
                    threadCtx.pendingModifies -= 1;
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
            threadCtx.*.pendingModifies = 0;
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
