const std = @import("std");
const jsBridge = @import("./jsBridge.zig");
const dump = @import("./dump.zig");
const sort = @import("./sort.zig");
const DbCtx = @import("./ctx.zig").DbCtx;
const utils = @import("../utils.zig");
const Modify = @import("../modify/modify.zig");
const selva = @import("../selva.zig").c;
const db = @import("db.zig");
const getQueryThreaded = @import("../query/query.zig").getQueryThreaded;
const SelvaHash128 = @import("../selva.zig").SelvaHash128;
const deflate = @import("../deflate.zig");
const t = @import("../types.zig");

const write = utils.write;
const read = utils.read;
const readNext = utils.readNext;
const Thread = std.Thread;
const Mutex = std.Thread.Mutex;
const Condition = std.Thread.Condition;
const Queue = std.array_list.Managed([]u8);

pub fn appendToResult(comptime isQuery: bool, thread: *DbThread, size: usize) ![]u8 {
    const paddedSize: u32 = @truncate(size); // zero padding for growth
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
        const currentSize = read(u32, thread.queryResults, thread.queryResultsIndexHeader);
        write(u32, thread.queryResults, currentSize + paddedSize, thread.queryResultsIndexHeader);
        const data = thread.queryResults[thread.queryResultsIndex .. thread.queryResultsIndex + paddedSize];
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
        const currentSize = read(u32, thread.modifyResults, thread.modifyResultsIndexHeader);
        write(u32, thread.modifyResults, currentSize + paddedSize, thread.modifyResultsIndexHeader);
        const data = thread.modifyResults[thread.modifyResultsIndex .. thread.modifyResultsIndex + paddedSize];
        thread.*.modifyResultsIndex = thread.modifyResultsIndex + paddedSize;
        return data;
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
        if (thread.queryResults.len < thread.queryResultsIndex + paddedSize) {
            if (paddedSize > 1_000_000) {
                increasedSize = (@divTrunc(paddedSize, increasedSize) + 1) * increasedSize;
            }
            thread.queryResults = try std.heap.raw_c_allocator.realloc(
                thread.queryResults,
                thread.queryResults.len + increasedSize,
            );
        }
        thread.queryResultsIndexHeader = thread.queryResultsIndex;
        write(u32, thread.queryResults, paddedSize, thread.queryResultsIndex);
        write(u32, thread.queryResults, id, thread.queryResultsIndex + 4);
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
        thread.modifyResultsIndexHeader = thread.modifyResultsIndex;
        write(u32, thread.modifyResults, paddedSize, thread.modifyResultsIndex);
        write(u32, thread.modifyResults, id, thread.modifyResultsIndex + 4);
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
                        var index: usize = 5;
                        const header = readNext(t.QueryDefaultHeader, q, &index);
                        if (header.sortSize != 0) {
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
<<<<<<< HEAD
                        const data = try newResult(true, threadCtx, 20, 0, op);
=======
                        const id = read(u32, q, 0);
                        const data = try getResultSlice(true, threadCtx, 20, id, op);
>>>>>>> f3525494edc554aaf8d06511019423b7ab0bda39
                        const start = read(u32, q, 0);
                        const typeCode = read(u16, q, 4);
                        const typeEntry = selva.selva_get_type_by_index(self.ctx.selva.?, typeCode);
                        var err: c_int = selva.SELVA_EINTYPE;

                        if (typeEntry) |te| {
                            var hash: SelvaHash128 = 0;
                            err = db.getNodeBlockHash(self.ctx, te, start, &hash);
                            _ = selva.memcpy(data[4..20].ptr, &hash, @sizeOf(@TypeOf(hash)));
                        }
                        _ = selva.memcpy(data[0..4].ptr, &err, @sizeOf(@TypeOf(err)));
                    },
                    t.OpType.saveBlock => {
                        std.debug.print("SAVE BLOCK\n", .{});
<<<<<<< HEAD
                        const data = try newResult(true, threadCtx, 26, 0, op);
=======
                        const id = read(u32, q, 0);
                        const data = try getResultSlice(true, threadCtx, 26, id, op);
>>>>>>> f3525494edc554aaf8d06511019423b7ab0bda39
                        const typeCode = read(u16, q, 9);
                        const start = read(u32, q, 5);
                        const filename = q[11..q.len];
                        _ = selva.memcpy(data[4..10].ptr, q[5..11].ptr, 6);
                        var hash: SelvaHash128 = 0;
                        const err = dump.saveBlock(self.ctx, typeCode, start, filename, &hash);
                        _ = selva.memcpy(data[0..4].ptr, &err, @sizeOf(@TypeOf(err)));
                        _ = selva.memcpy(data[10..16].ptr, &hash, @sizeOf(@TypeOf(hash)));
                    },
                    t.OpType.saveCommon => {
                        std.debug.print("SAVE COMMON\n", .{});
<<<<<<< HEAD
                        const data = try newResult(true, threadCtx, 4, 0, op);
=======
                        const id = read(u32, q, 0);
                        const data = try getResultSlice(true, threadCtx, 4, id, op);
>>>>>>> f3525494edc554aaf8d06511019423b7ab0bda39
                        const filename = q[5..q.len];
                        const err = dump.saveCommon(self.ctx, filename);
                        _ = selva.memcpy(data[0..4].ptr, &err, @sizeOf(@TypeOf(err)));
                    },
                    else => {
                        try getQueryThreaded(self.ctx, q, threadCtx, sortIndex);
                    },
                }

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
                            std.debug.print("LOAD\n", .{});
                            const data = try newResult(false, threadCtx, 20 + 492, read(u32, m, 0), op);
                            const start: u32 = read(u32, m, 5);
                            const typeCode: u16 = read(u16, m, 9);
                            const filename = m[11..m.len];

                            const errlog = data[16..data.len];
                            var hash: SelvaHash128 = 0;
                            const err = dump.loadBlock(self.ctx, typeCode, start, filename, errlog, &hash);
                            _ = selva.memcpy(data[0..4].ptr, &err, @sizeOf(@TypeOf(err)));
                            _ = selva.memcpy(data[4..10].ptr, m[5..11].ptr, 6);
                            _ = selva.memcpy(data[10..16].ptr, &hash, @sizeOf(@TypeOf(hash)));
                        },
                        t.OpType.unloadBlock => {
                            std.debug.print("UNLOAD\n", .{});
                            const data = try newResult(false, threadCtx, 20, read(u32, m, 0), op);
                            const start: u32 = read(u32, m, 5);
                            const typeCode: u16 = read(u16, m, 9);
                            const filename = m[11..m.len];

                            var hash: SelvaHash128 = 0;
                            const err = dump.unloadBlock(self.ctx, typeCode, start, filename, &hash);
                            _ = selva.memcpy(data[0..4].ptr, &err, @sizeOf(@TypeOf(err)));
                            _ = selva.memcpy(data[4..10].ptr, m[5..11].ptr, 6);
                            _ = selva.memcpy(data[10..16].ptr, &hash, @sizeOf(@TypeOf(hash)));
                        },
                        t.OpType.loadCommon => {
                            std.debug.print("LOAD COMMON\n", .{});
                            const data = try newResult(false, threadCtx, 20 + 492, read(u32, m, 0), op);
                            const filename = m[5..m.len];

                            const errlog = data[5..data.len];
                            const err = dump.loadCommon(self.ctx, filename, errlog);
                            _ = selva.memcpy(data[0..4].ptr, &err, @sizeOf(@TypeOf(err)));
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
