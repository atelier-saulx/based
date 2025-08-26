const std = @import("std");
const sort = @import("./sort.zig");
const selva = @import("../selva.zig");
const valgrind = @import("../valgrind.zig");
const config = @import("config");
const c = @import("../c.zig");
const napi = @import("../napi.zig");
const SelvaError = @import("../errors.zig").SelvaError;

const rand = std.crypto.random;

const ThreadCtx = struct {
    decompressor: *selva.libdeflate_decompressor,
    libdeflateBlockState: *selva.libdeflate_block_state,
};

pub fn getThreadId() u64 {
    return selva.selva_get_thread_id();
}

pub const DbCtx = struct {
    id: u32,
    initialized: bool,
    allocator: std.mem.Allocator,
    arena: *std.heap.ArenaAllocator,
    threadCtx: std.AutoHashMap(u64, ThreadCtx),
    sortIndexes: sort.TypeSortIndexes,
    selva: ?*selva.SelvaDb,

    pub fn deinit(self: *DbCtx, backing_allocator: std.mem.Allocator) void {
        self.arena.deinit();
        backing_allocator.destroy(self.arena);
    }
};

const base_allocator = std.heap.raw_c_allocator;
var db_backing_allocator: std.mem.Allocator = undefined;
var valgrind_wrapper_instance: valgrind.ValgrindAllocator = undefined; // this exists in the final program memory :(

pub fn init() void {
    if (config.enable_debug) {
        // do a check here...
        valgrind_wrapper_instance = valgrind.ValgrindAllocator.init(base_allocator);
        db_backing_allocator = valgrind_wrapper_instance.allocator();
    } else {
        db_backing_allocator = base_allocator;
    }
}

pub fn createDbCtx() !*DbCtx {
    var arena = try db_backing_allocator.create(std.heap.ArenaAllocator);
    errdefer db_backing_allocator.destroy(arena);
    arena.* = std.heap.ArenaAllocator.init(db_backing_allocator);
    const allocator = arena.allocator();
    const b = try allocator.create(DbCtx);
    const threadCtx = std.AutoHashMap(u64, ThreadCtx).init(base_allocator);
    errdefer {
        arena.deinit();
        db_backing_allocator.destroy(arena);
        threadCtx.deinit();
    }
    b.* = .{
        .id = rand.int(u32),
        .arena = arena,
        .allocator = allocator,
        .threadCtx = threadCtx,
        .sortIndexes = sort.TypeSortIndexes.init(allocator),
        .initialized = false,
        .selva = null,
    };
    _ = createThreadCtx(b, getThreadId()) catch null;

    return b;
}

pub fn destroyDbCtx(ctx: *DbCtx) void {
    ctx.initialized = false;

    var it = ctx.sortIndexes.iterator();
    while (it.next()) |index| {
        var mainIt = index.value_ptr.*.main.iterator();
        while (mainIt.next()) |main| {
            selva.selva_sort_destroy(main.value_ptr.*.index);
        }
        var fieldIt = index.value_ptr.*.field.iterator();
        while (fieldIt.next()) |field| {
            selva.selva_sort_destroy(field.value_ptr.*.index);
        }
    }

    var iterator = ctx.threadCtx.iterator();
    while (iterator.next()) |tctx| {
        selva.libdeflate_block_state_deinit(tctx.value_ptr.*.libdeflateBlockState);
        selva.libdeflate_free_decompressor(tctx.value_ptr.*.decompressor);
    }
    ctx.threadCtx.deinit();

    selva.selva_db_destroy(ctx.selva);
    ctx.selva = null;
    ctx.arena.deinit();
}

pub fn createThreadCtx(ctx: *DbCtx, threadId: u64) !void {
    const blockState = try base_allocator.create(selva.libdeflate_block_state);
    blockState.* = selva.libdeflate_block_state_init(305000);
    try ctx.*.threadCtx.put(threadId, .{
        .decompressor = selva.libdeflate_alloc_decompressor().?, // never fails
        .libdeflateBlockState = blockState,
    });
}

pub fn destroyThreadCtx(ctx: *DbCtx, threadId: u64) !void {
    if (ctx.threadCtx.fetchRemove(threadId)) |tctx| {
        selva.libdeflate_block_state_deinit(tctx.value.libdeflateBlockState);
        selva.libdeflate_free_decompressor(tctx.value.decompressor);
    }
}

pub fn getThreadCtx(ctx: *DbCtx) !ThreadCtx {
    const tctx = ctx.threadCtx.get(getThreadId());
    if (tctx) |v| {
        return v;
    }
    return SelvaError.DB_NOT_CREATED;
}
