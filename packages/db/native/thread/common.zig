const std = @import("std");
const deflate = @import("../deflate.zig");
const results = @import("./results.zig");

pub const Thread = struct {
    thread: std.Thread,
    id: usize,
    decompressor: *deflate.Decompressor,
    libdeflateBlockState: deflate.BlockState,
    pendingModifies: usize,
    mutex: std.Thread.Mutex,
    flushDone: std.Thread.Condition,
    flushed: bool,
    modify: *results.Result,
    query: *results.Result,

    pub inline fn waitForFlush(self: *Thread) void {
        self.*.mutex.lock();
        while (!self.flushed) {
            self.flushDone.wait(&self.mutex);
        }
        self.*.mutex.unlock();
    }

    pub fn init(id: usize) !*Thread {
        const thread = try std.heap.raw_c_allocator.create(Thread);
        thread.*.id = id;
        thread.*.decompressor = deflate.createDecompressor();
        thread.*.libdeflateBlockState = deflate.initBlockState(305000);
        thread.*.pendingModifies = 0;
        thread.*.flushed = false;
        thread.*.mutex = .{};
        thread.*.flushDone = .{};
        thread.*.query = try results.Result.init();
        thread.*.modify = try results.Result.init();
        return thread;
    }

    pub fn deinit(self: *Thread) void {
        self.thread.join();
        self.query.deinit();
        self.modify.deinit();
        std.heap.raw_c_allocator.destroy(self);
    }
};
