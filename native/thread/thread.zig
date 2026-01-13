const jsBridge = @import("jsBridge.zig");
const DbCtx = @import("../db/ctx.zig").DbCtx;
const utils = @import("../utils.zig");
const Modify = @import("../modify/modify.zig");
const SelvaHash128 = @import("../string.zig").SelvaHash128;
const selva = @import("../selva/selva.zig").c;
const common = @import("common.zig");
const t = @import("../types.zig");
const jemalloc = @import("../jemalloc.zig");
const std = @import("std");
const worker = @import("./worker/worker.zig").worker;

pub const Thread = common.Thread;
const Queue = std.array_list.Managed([]u8);

pub const Threads = struct {
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
    lastModifyTime: u64 = 0,
    // lastModfiyTimeThread: std.Thread,
    emptyMod: []u8,

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
            .emptyMod = try allocator.alloc(u8, 5),
            // .lastModfiyTimeThread
            // .lastModfiyTimeThread = try std.Thread.spawn(.{}, poll, .{self}),
            .lastModifyTime = 0,
            .allocator = allocator,
            .threads = try allocator.alloc(*Thread, threadAmount),
            .ctx = ctx,
            .modifyQueue = modifyQueue,
            .nextModifyQueue = nextModifyQueue,
            .queryQueue = queryQueue,
            .nextQueryQueue = nextQueryQueue,
        };
        self.*.emptyMod[4] = @intFromEnum(t.OpType.emptyMod);
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
        // self.lastModfiyTimeThread.join();
        for (self.threads) |threadContainer| {
            threadContainer.deinit();
        }
        self.allocator.free(self.emptyMod);
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
