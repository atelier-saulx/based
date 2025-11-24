const std = @import("std");
const jsBridge = @import("./jsBridge.zig");
const sort = @import("./sort.zig");
const DbCtx = @import("./ctx.zig").DbCtx;
const utils = @import("../utils.zig");
const Modify = @import("../modify/modify.zig");
const SelvaHash128 = @import("../string.zig").SelvaHash128;
const selva = @import("../selva/selva.zig").c;
const db = @import("../selva/db.zig");
const dump = @import("../selva/dump.zig");
const info = @import("../selva/info.zig");
const getQueryThreaded = @import("../query/query.zig").getQueryThreaded;
const deflate = @import("../deflate.zig");
const t = @import("../types.zig");

const write = utils.write;
const read = utils.read;
const readNext = utils.readNext;
const Thread = std.Thread;
const Mutex = std.Thread.Mutex;
const Condition = std.Thread.Condition;
const Queue = std.array_list.Managed([]u8);

// TODO make 1 struct

pub inline fn sliceFromResult(comptime isQuery: bool, thread: *DbThread, size: usize) ![]u8 {
    const paddedSize: u32 = @truncate(size); // zero padding for growth
    var increasedSize: usize = if (isQuery) 1_000_000 else 100_000;
    if (isQuery) {
        const newLen = thread.queryResultsIndex + paddedSize;
        if (thread.queryResults.len < newLen) {
            if (paddedSize > 1_000_000) {
                increasedSize = (@divTrunc(paddedSize, increasedSize) + 1) * increasedSize;
            }
            thread.queryResults = try std.heap.raw_c_allocator.realloc(
                thread.queryResults,
                thread.queryResults.len + increasedSize,
            );
        }
        const data = thread.queryResults[thread.queryResultsIndex..newLen];
        thread.*.queryResultsIndex = newLen;
        return data;
    } else {
        const newLen = thread.modifyResultsIndex + paddedSize;
        if (thread.modifyResults.len < thread.modifyResultsIndex + paddedSize) {
            if (paddedSize > 100_000) {
                increasedSize = (@divTrunc(paddedSize, increasedSize) + 1) * increasedSize;
            }
            thread.modifyResults = try std.heap.raw_c_allocator.realloc(
                thread.modifyResults,
                thread.modifyResults.len + increasedSize,
            );
        }
        const data = thread.modifyResults[thread.modifyResultsIndex..newLen];
        thread.*.modifyResultsIndex = newLen;
        return data;
    }
}

pub inline fn appendToResult(comptime isQuery: bool, thread: *DbThread, value: anytype) !void {
    const T = @TypeOf(value);
    const size = utils.sizeOf(T);
    utils.writeAs(T, try sliceFromResult(isQuery, thread, size), value, 0);
}

pub inline fn appendToResultAs(comptime T: type, comptime isQuery: bool, thread: *DbThread, value: T) !usize {
    const size = utils.sizeOf(T);
    utils.writeAs(T, try sliceFromResult(isQuery, thread, size), value, 0);
    return size;
}

pub fn commitResult(comptime isQuery: bool, thread: *DbThread) void {
    if (isQuery) {
        utils.writeAs(
            u32,
            thread.queryResults,
            thread.queryResultsIndex - thread.queryResultsIndexHeader,
            thread.queryResultsIndexHeader,
        );
    } else {
        utils.writeAs(
            u32,
            thread.modifyResults,
            thread.modifyResultsIndex - thread.modifyResultsIndexHeader,
            thread.modifyResultsIndexHeader,
        );
    }
}

pub fn newResult(
    comptime isQuery: bool,
    thread: *DbThread,
    size: usize,
    id: u32,
    subType: t.OpType,
) ![]u8 {
    const offset = 9;
    const paddedSize: u32 = @truncate(size + offset);
    var increasedSize: usize = if (isQuery) 1_000_000 else 100_000;
    if (isQuery) {
        const newLen = thread.queryResultsIndex + paddedSize;
        if (thread.queryResults.len < newLen) {
            if (paddedSize > 1_000_000) {
                increasedSize = (@divTrunc(paddedSize, increasedSize) + 1) * increasedSize;
            }
            thread.queryResults = try std.heap.raw_c_allocator.realloc(
                thread.queryResults,
                thread.queryResults.len + increasedSize,
            );
        }
        thread.queryResultsIndexHeader = thread.queryResultsIndex;
        utils.writeAs(u32, thread.queryResults, id, thread.queryResultsIndexHeader + 4);
        thread.queryResults[thread.queryResultsIndex + 8] = @intFromEnum(subType);
        const data = thread.queryResults[thread.queryResultsIndex + offset .. newLen];
        thread.*.queryResultsIndex = newLen;
        return data;
    } else {
        const newLen = thread.modifyResultsIndex + paddedSize;
        if (thread.modifyResults.len < newLen) {
            if (paddedSize > 100_000) {
                increasedSize = (@divTrunc(paddedSize, increasedSize) + 1) * increasedSize;
            }
            thread.modifyResults = try std.heap.raw_c_allocator.realloc(
                thread.modifyResults,
                thread.modifyResults.len + increasedSize,
            );
        }
        thread.modifyResultsIndexHeader = thread.modifyResultsIndex;
        utils.writeAs(u32, thread.modifyResults, id, thread.modifyResultsIndexHeader + 4);
        thread.modifyResults[thread.modifyResultsIndex + 8] = @intFromEnum(subType);
        const data = thread.modifyResults[thread.modifyResultsIndex + offset .. newLen];
        thread.*.modifyResultsIndex = newLen;
        return data;
    }
}

pub const DbThread = struct {
    thread: Thread,
    id: usize,
    queryResults: []u8,
    queryResultsIndex: usize,
    queryResultsIndexHeader: usize,
    modifyResults: []u8,
    modifyResultsIndex: usize,
    modifyResultsIndexHeader: usize,
    decompressor: *deflate.Decompressor,
    libdeflateBlockState: deflate.BlockState,
    pendingModifies: usize,
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

    fn modifyNotPending(
        self: *Threads,
    ) void {
        for (self.threads) |thread| {
            if (thread.pendingModifies != 0) {
                return;
            }
        }
        self.modifyDone.signal();
        if (!self.jsModifyBridgeStaged) {
            self.ctx.jsBridge.call(t.BridgeResponse.modify);
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
            var op: t.OpType = undefined;
            var sortIndex: ?*sort.SortIndexMeta = null;

            self.mutex.lock();

            if (self.shutdown) {
                self.mutex.unlock();
                return;
            }

            if (self.queryQueue.items.len > 0) {
                queryBuf = self.queryQueue.swapRemove(0);
                if (queryBuf) |q| {
                    op = @enumFromInt(q[4]);
                    if (op == t.OpType.default) {
                        var index: usize = 4;
                        const header = readNext(t.QueryHeader, q, &index);
                        if (header.sort) {
                            const sortHeader = readNext(t.SortHeader, q, &index);
                            if (sort.getSortIndex(
                                self.ctx.sortIndexes.get(header.typeId),
                                sortHeader.prop,
                                sortHeader.start,
                                sortHeader.lang,
                            )) |sortMetaIndex| {
                                sortIndex = sortMetaIndex;
                            } else {
                                // needs multi threading ofc
                                // add comtime dont create all
                                // can now store sort indexes for refs as well!
                                sortIndex = try sort.createSortIndex(
                                    self.ctx,
                                    threadCtx.decompressor,
                                    header.typeId,
                                    &sortHeader,
                                    true,
                                    false,
                                );
                            }
                        }
                    }
                }
            } else if (self.modifyQueue.items.len > 0 and threadCtx.pendingModifies > 0) {
                modifyBuf = self.modifyQueue.items[0];
                if (modifyBuf) |m| {
                    op = @enumFromInt(m[4]);
                }
            } else {
                self.wakeup.wait(&self.mutex);
            }

            self.mutex.unlock();

            if (queryBuf) |q| {
                switch (op) {
                    t.OpType.blockHash => {
                        try info.blockHash(threadCtx, self.ctx, q, op);
                    },
                    t.OpType.saveBlock => {
                        try dump.saveBlock(threadCtx, self.ctx, q, op);
                    },
                    t.OpType.saveCommon => {
                        try dump.saveCommon(threadCtx, self.ctx, q, op);
                    },
                    else => {
                        getQueryThreaded(self.ctx, q, threadCtx, sortIndex) catch |err| {
                            std.log.err("Error query: {any}", .{err});
                            // write query error response
                        };
                    },
                }

                commitResult(true, threadCtx);
                self.mutex.lock();
                self.pendingQueries -= 1;

                // If results size is too large move stuff to next query

                if (self.pendingQueries == 0) {
                    self.queryDone.signal();
                    if (!self.jsQueryBridgeStaged) {
                        self.jsQueryBridgeStaged = true;
                        self.ctx.jsBridge.call(t.BridgeResponse.query);
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
                if (threadCtx.id == 0) {
                    switch (op) {
                        t.OpType.modify => {
                            try Modify.modify(threadCtx, m, self.ctx, op);
                        },
                        t.OpType.loadBlock => {
                            try dump.loadBlock(threadCtx, self.ctx, m, op);
                        },
                        t.OpType.unloadBlock => {
                            try dump.unloadBlock(threadCtx, self.ctx, m, op);
                        },
                        t.OpType.loadCommon => {
                            try dump.loadCommon(threadCtx, self.ctx, m, op);
                        },
                        t.OpType.createType => {
                            const data = try newResult(false, threadCtx, 4, read(u32, m, 0), op);
                            const typeCode = read(u32, m, 0);
                            const schema = m[5..m.len];
                            const err = selva.selva_db_create_type(self.ctx.selva, @truncate(typeCode), schema.ptr, schema.len);
                            _ = selva.memcpy(data[0..4].ptr, &err, @sizeOf(@TypeOf(err)));
                        },
                        else => {},
                    }

                    commitResult(false, threadCtx);

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

        for (self.threads, 0..) |*threadContainer, id| {
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
            threadContainer.* = threadCtx;
        }

        return self;
    }

    pub fn deinit(self: *Threads) void {
        self.mutex.lock();
        self.shutdown = true;
        self.wakeup.broadcast();
        self.mutex.unlock();
        for (self.threads) |threadContainer| {
            threadContainer.thread.join();
            std.heap.raw_c_allocator.free(threadContainer.queryResults);
            std.heap.raw_c_allocator.free(threadContainer.modifyResults);
            self.allocator.destroy(threadContainer);
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
