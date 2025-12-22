const std = @import("std");
const deflate = @import("../deflate.zig");
const jemalloc = @import("../jemalloc.zig");
const results = @import("results.zig");
const Sort = @import("../sort/sort.zig");
const selva = @import("../selva/selva.zig").c;
const References = @import("../selva/references.zig");
const Subscription = @import("../subscription/common.zig");
const EdgeResultSize = @sizeOf(References.ReferencesIteratorEdgesResult);

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
    currentModifyIndex: usize = 0,
    tmpSortIntEdge: *selva.SelvaSortCtx,
    tmpSortInt: *selva.SelvaSortCtx,
    tmpSortDoubleEdge: *selva.SelvaSortCtx,
    tmpSortDouble: *selva.SelvaSortCtx,
    tmpSortBinaryEdge: *selva.SelvaSortCtx,
    tmpSortBinary: *selva.SelvaSortCtx,
    subscriptions: *Subscription.SubscriptionCtx,

    pub fn init(allocator: std.mem.Allocator, id: usize) !*Thread {
        const thread = jemalloc.create(Thread);
        thread.*.id = id;
        thread.*.decompressor = deflate.createDecompressor();
        thread.*.libdeflateBlockState = deflate.initBlockState(305000);
        thread.*.pendingModifies = 0;
        thread.*.flushed = false;
        thread.*.mutex = .{};
        thread.*.flushDone = .{};
        thread.*.query = try results.Result.init();
        thread.*.modify = try results.Result.init();
        thread.*.currentModifyIndex = 0;

        // maybe we can make this with comtime loop
        thread.*.tmpSortIntEdge = selva.selva_sort_init3(selva.SELVA_SORT_ORDER_I64_ASC, 0, EdgeResultSize).?;
        thread.*.tmpSortInt = selva.selva_sort_init3(selva.SELVA_SORT_ORDER_I64_ASC, 0, 0).?;

        thread.*.tmpSortDoubleEdge = selva.selva_sort_init3(selva.SELVA_SORT_ORDER_DOUBLE_ASC, 0, EdgeResultSize).?;
        thread.*.tmpSortDouble = selva.selva_sort_init3(selva.SELVA_SORT_ORDER_DOUBLE_ASC, 0, 0).?;

        thread.*.tmpSortBinaryEdge = selva.selva_sort_init3(selva.SELVA_SORT_ORDER_BUFFER_ASC, 0, EdgeResultSize).?;
        thread.*.tmpSortBinary = selva.selva_sort_init3(selva.SELVA_SORT_ORDER_BUFFER_ASC, 0, 0).?;

        const subscriptions = try allocator.create(Subscription.SubscriptionCtx);
        subscriptions.*.types = Subscription.TypeSubMap.init(allocator);
        subscriptions.*.lastIdMarked = 0;
        subscriptions.*.singleIdMarked = jemalloc.alloc(u64, Subscription.BLOCK_SIZE);
        subscriptions.*.subsHashMap = Subscription.SubHashMap.init(allocator);

        thread.*.subscriptions = subscriptions;

        return thread;
    }

    pub fn deinit(self: *Thread) void {
        // maybe some comptime stuff...
        selva.selva_sort_destroy(self.tmpSortIntEdge);
        selva.selva_sort_destroy(self.tmpSortInt);

        selva.selva_sort_destroy(self.tmpSortDoubleEdge);
        selva.selva_sort_destroy(self.tmpSortDouble);

        selva.selva_sort_destroy(self.tmpSortBinaryEdge);
        selva.selva_sort_destroy(self.tmpSortBinary);

        self.thread.join();
        self.query.deinit();
        self.modify.deinit();
        deflate.destroyDecompressor(self.decompressor);
        deflate.deinitBlockState(&self.libdeflateBlockState);
        jemalloc.free(self);

        jemalloc.free(self.subscriptions.singleIdMarked);
    }
};
