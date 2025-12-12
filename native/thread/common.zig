const std = @import("std");
const deflate = @import("../deflate.zig");
const jemalloc = @import("../jemalloc.zig");
const results = @import("results.zig");
const Sort = @import("../sort/sort.zig");
const selva = @import("../selva/selva.zig").c;
const References = @import("../selva/references.zig");

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
    tmpSortIndexEdge: *selva.SelvaSortCtx,
    tmpSortIndex: *selva.SelvaSortCtx,

    pub fn init(id: usize) !*Thread {
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
        // derp
        thread.*.tmpSortIndexEdge = selva.selva_sort_init3(
            selva.SELVA_SORT_ORDER_I64_ASC,
            0,
            @sizeOf(References.ReferencesIteratorEdgesResult),
        ).?;
        thread.*.tmpSortIndex = selva.selva_sort_init3(selva.SELVA_SORT_ORDER_I64_ASC, 0, 0).?;
        return thread;
    }

    pub fn deinit(self: *Thread) void {
        self.thread.join();
        self.query.deinit();
        self.modify.deinit();
        deflate.destroyDecompressor(self.decompressor);
        deflate.deinitBlockState(&self.libdeflateBlockState);
        jemalloc.free(self);
    }
};
